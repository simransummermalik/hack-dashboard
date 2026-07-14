"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { members, taskAssignees, taskLinks, taskReviews, tasks } from "@/db/schema";
import { requireCurrentMember } from "@/lib/current-member";
import {
  AuthorizationError,
  requireCanEditTask,
  requireCanWriteReview,
  requireCanOverrideReviewGate,
  requireMember,
} from "@/lib/authorization";
import { createTaskRecord, addManualReviewer, getTaskAssigneeIds } from "@/lib/task-core";
import { summarizeReviews, type ReviewRow } from "@/lib/reviews";
import { recordAudit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notifications";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/constants";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const taskInputSchema = z.object({
  title: z.string().trim().min(2, "Title is required.").max(300),
  description: z.string().trim().max(20000).default(""),
  categoryId: z.string().uuid().nullable(),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: z.string().nullable(),
  assigneeIds: z.array(z.string().uuid()).default([]),
  links: z.array(z.object({ label: z.string().min(1), url: z.string().url() })).default([]),
  reviewExempt: z.boolean().default(false),
  reviewExemptReasonId: z.string().uuid().nullable().optional(),
});

export async function createTask(input: z.infer<typeof taskInputSchema>): Promise<ActionResult & { taskId?: string }> {
  const actor = await requireCurrentMember();
  requireMember(actor);

  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid task." };
  }
  const data = parsed.data;

  const { taskId, reviewerMemberIds } = await createTaskRecord({
    title: data.title,
    description: data.description,
    creatorId: actor.id,
    categoryId: data.categoryId,
    priority: data.priority,
    dueDate: data.dueDate,
    assigneeIds: data.assigneeIds,
    links: data.links,
    reviewExempt: data.reviewExempt,
    reviewExemptReasonId: data.reviewExemptReasonId ?? null,
  });

  await recordAudit({
    actorId: actor.id,
    action: "task_created",
    entityType: "task",
    entityId: taskId,
    after: { title: data.title, priority: data.priority, reviewExempt: data.reviewExempt },
  });

  const notifications = [
    ...data.assigneeIds
      .filter((id) => id !== actor.id)
      .map((memberId) => ({
        memberId,
        type: "task_assigned" as const,
        title: "You were assigned a task",
        body: data.title,
        link: `/tasks/${taskId}`,
        entityType: "task" as const,
        entityId: taskId,
      })),
    ...reviewerMemberIds
      .filter((id) => id !== actor.id)
      .map((memberId) => ({
        memberId,
        type: "review_requested" as const,
        title: "A new task needs your review",
        body: data.title,
        link: `/tasks/${taskId}`,
        entityType: "task" as const,
        entityId: taskId,
      })),
  ];
  await notifyMany(notifications);

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/reviews");
  return { ok: true, taskId };
}

const updateTaskSchema = taskInputSchema.omit({ reviewExempt: true, reviewExemptReasonId: true });

export async function updateTask(taskId: string, input: z.infer<typeof updateTaskSchema>): Promise<ActionResult> {
  const actor = await requireCurrentMember();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return { ok: false, error: "Task not found." };
  const assigneeIds = await getTaskAssigneeIds(taskId);

  try {
    requireCanEditTask(actor, { creatorId: task.creatorId, assigneeIds });
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid task." };
  const data = parsed.data;

  await db.transaction(async (tx) => {
    await tx
      .update(tasks)
      .set({
        title: data.title,
        description: data.description,
        categoryId: data.categoryId,
        priority: data.priority,
        dueDate: data.dueDate,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
    if (data.assigneeIds.length > 0) {
      await tx.insert(taskAssignees).values(data.assigneeIds.map((memberId) => ({ taskId, memberId })));
    }

    await tx.delete(taskLinks).where(eq(taskLinks.taskId, taskId));
    if (data.links.length > 0) {
      await tx.insert(taskLinks).values(
        data.links.map((l) => ({ taskId, label: l.label, url: l.url, createdBy: actor.id }))
      );
    }
  });

  const newAssignees = data.assigneeIds.filter((id) => !assigneeIds.includes(id) && id !== actor.id);
  await notifyMany(
    newAssignees.map((memberId) => ({
      memberId,
      type: "task_assigned" as const,
      title: "You were assigned a task",
      body: data.title,
      link: `/tasks/${taskId}`,
      entityType: "task" as const,
      entityId: taskId,
    }))
  );

  await recordAudit({
    actorId: actor.id,
    action: "task_updated",
    entityType: "task",
    entityId: taskId,
    before: { title: task.title, priority: task.priority, dueDate: task.dueDate },
    after: { title: data.title, priority: data.priority, dueDate: data.dueDate },
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

async function loadReviewRows(taskId: string): Promise<ReviewRow[]> {
  const rows = await db
    .select({
      memberId: taskReviews.memberId,
      memberName: members.fullName,
      memberActive: members.active,
      status: taskReviews.status,
      comment: taskReviews.comment,
    })
    .from(taskReviews)
    .innerJoin(members, eq(taskReviews.memberId, members.id))
    .where(eq(taskReviews.taskId, taskId));
  return rows;
}

export async function changeTaskStatus(
  taskId: string,
  newStatus: (typeof TASK_STATUSES)[number],
  overrideReason?: string
): Promise<ActionResult> {
  const actor = await requireCurrentMember();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return { ok: false, error: "Task not found." };
  const assigneeIds = await getTaskAssigneeIds(taskId);

  try {
    requireCanEditTask(actor, { creatorId: task.creatorId, assigneeIds });
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: err.message };
    throw err;
  }

  let usedOverride = false;

  if (newStatus === "completed" && !task.reviewExempt) {
    const reviewRows = await loadReviewRows(taskId);
    const summary = summarizeReviews(reviewRows);
    if (!summary.canComplete) {
      const trimmedReason = overrideReason?.trim();
      if (!trimmedReason) {
        return {
          ok: false,
          error: `Cannot complete: ${summary.blockingReasons.join("; ")}. An admin can override this with a written explanation.`,
        };
      }
      try {
        requireCanOverrideReviewGate(actor);
      } catch (err) {
        if (err instanceof AuthorizationError) return { ok: false, error: err.message };
        throw err;
      }
      usedOverride = true;
    }
  }

  const now = new Date();
  await db
    .update(tasks)
    .set({
      status: newStatus,
      updatedAt: now,
      completedAt: newStatus === "completed" ? now : null,
      completionOverrideBy: usedOverride ? actor.id : null,
      completionOverrideReason: usedOverride ? overrideReason!.trim() : null,
    })
    .where(eq(tasks.id, taskId));

  await recordAudit({
    actorId: actor.id,
    action: "task_status_changed",
    entityType: "task",
    entityId: taskId,
    before: { status: task.status },
    after: { status: newStatus },
  });

  if (usedOverride) {
    await recordAudit({
      actorId: actor.id,
      action: "task_completion_overridden",
      entityType: "task",
      entityId: taskId,
      metadata: { reason: overrideReason!.trim() },
    });
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

const reviewSchema = z.object({
  status: z.enum(["approved", "no_concerns", "changes_requested", "not_applicable"]),
  comment: z.string().trim().max(5000).optional(),
});

export async function submitReview(taskId: string, input: z.infer<typeof reviewSchema>): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireCanWriteReview(actor, actor.id);

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid review." };

  const [existing] = await db
    .select()
    .from(taskReviews)
    .where(and(eq(taskReviews.taskId, taskId), eq(taskReviews.memberId, actor.id)))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "You are not required to review this task." };
  }

  const wasPending = existing.status === "pending";

  await db
    .update(taskReviews)
    .set({
      status: parsed.data.status,
      comment: parsed.data.comment || null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(taskReviews.id, existing.id));

  await recordAudit({
    actorId: actor.id,
    action: wasPending ? "review_submitted" : "review_updated",
    entityType: "task_review",
    entityId: existing.id,
    before: { status: existing.status, comment: existing.comment },
    after: { status: parsed.data.status, comment: parsed.data.comment ?? null },
    metadata: { taskId },
  });

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (task && parsed.data.status === "changes_requested") {
    await notify({
      memberId: task.creatorId,
      type: "review_changes_requested",
      title: "Changes requested on your task",
      body: `${actor.fullName} requested changes on "${task.title}".`,
      link: `/tasks/${taskId}`,
      entityType: "task",
      entityId: taskId,
    });
  }

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/reviews");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addManualReviewerAction(taskId: string, memberId: string): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  try {
    requireCanOverrideReviewGate(actor); // admin only, reuses the same admin-only gate
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: err.message };
    throw err;
  }

  await addManualReviewer(taskId, memberId);

  const [task] = await db.select({ title: tasks.title }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
  await notify({
    memberId,
    type: "review_requested",
    title: "A task needs your review",
    body: task?.title ?? "",
    link: `/tasks/${taskId}`,
    entityType: "task",
    entityId: taskId,
  });

  await recordAudit({
    actorId: actor.id,
    action: "task_review_added_manually",
    entityType: "task",
    entityId: taskId,
    metadata: { reviewerMemberId: memberId },
  });

  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function remindMissingReviewers(taskId: string): Promise<ActionResult & { remindedCount?: number }> {
  const actor = await requireCurrentMember();
  requireMember(actor);

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return { ok: false, error: "Task not found." };

  const pendingReviewers = await db
    .select({ memberId: taskReviews.memberId, active: members.active })
    .from(taskReviews)
    .innerJoin(members, eq(taskReviews.memberId, members.id))
    .where(and(eq(taskReviews.taskId, taskId), eq(taskReviews.status, "pending"), eq(members.active, true)));

  await notifyMany(
    pendingReviewers.map((r) => ({
      memberId: r.memberId,
      type: "review_reminder" as const,
      title: "Reminder: a task is waiting on your review",
      body: task.title,
      link: `/tasks/${taskId}`,
      entityType: "task" as const,
      entityId: taskId,
    }))
  );

  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, remindedCount: pendingReviewers.length };
}

/** Any active member can claim a task that currently has nobody assigned. */
export async function claimTask(taskId: string): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireMember(actor);

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return { ok: false, error: "Task not found." };
  if (task.status === "completed" || task.status === "archived") {
    return { ok: false, error: "This task is no longer open." };
  }

  const currentAssignees = await getTaskAssigneeIds(taskId);
  if (currentAssignees.length > 0) {
    return { ok: false, error: "Someone already claimed this task." };
  }

  await db.insert(taskAssignees).values({ taskId, memberId: actor.id }).onConflictDoNothing();

  await recordAudit({
    actorId: actor.id,
    action: "task_assignees_changed",
    entityType: "task",
    entityId: taskId,
    after: { claimedBy: actor.id },
  });

  if (task.creatorId !== actor.id) {
    await notify({
      memberId: task.creatorId,
      type: "task_assigned",
      title: "Someone claimed your task",
      body: `${actor.fullName} claimed "${task.title}".`,
      link: `/tasks/${taskId}`,
      entityType: "task",
      entityId: taskId,
    });
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
