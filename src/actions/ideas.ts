"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { ideaTaskLinks, ideaVotes, ideas, tasks } from "@/db/schema";
import { requireCurrentMember } from "@/lib/current-member";
import { AuthorizationError, requireCanEditOwnedRecord, requireMember, requireOfficerOrAdmin } from "@/lib/authorization";
import { createTaskRecord } from "@/lib/task-core";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { IDEA_STATUSES } from "@/lib/constants";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ideaInputSchema = z.object({
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(20000).default(""),
  categoryId: z.string().uuid().nullable(),
  estimatedCostCents: z.number().int().min(0).nullable(),
  estimatedEffort: z.string().trim().max(500).nullable(),
  proposedTimeline: z.string().trim().max(500).nullable(),
  benefits: z.string().trim().max(5000).nullable(),
  risks: z.string().trim().max(5000).nullable(),
});

export async function createIdea(input: z.infer<typeof ideaInputSchema>): Promise<ActionResult & { ideaId?: string }> {
  const actor = await requireCurrentMember();
  requireMember(actor);

  const parsed = ideaInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid idea." };

  const [created] = await db
    .insert(ideas)
    .values({ ...parsed.data, submittedBy: actor.id })
    .returning({ id: ideas.id });

  if (!created) return { ok: false, error: "Failed to create idea." };

  await recordAudit({
    actorId: actor.id,
    action: "idea_created",
    entityType: "idea",
    entityId: created.id,
    after: { title: parsed.data.title },
  });

  revalidatePath("/ideas");
  revalidatePath("/dashboard");
  return { ok: true, ideaId: created.id };
}

const ideaUpdateSchema = ideaInputSchema.extend({
  status: z.enum(IDEA_STATUSES),
});

export async function updateIdea(ideaId: string, input: z.infer<typeof ideaUpdateSchema>): Promise<ActionResult> {
  const actor = await requireCurrentMember();

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
  if (!idea) return { ok: false, error: "Idea not found." };

  try {
    requireCanEditOwnedRecord(actor, idea.submittedBy);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = ideaUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid idea." };

  await db
    .update(ideas)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(ideas.id, ideaId));

  await recordAudit({
    actorId: actor.id,
    action: "idea_updated",
    entityType: "idea",
    entityId: ideaId,
    before: { status: idea.status },
    after: { status: parsed.data.status },
  });

  revalidatePath("/ideas");
  revalidatePath(`/ideas/${ideaId}`);
  return { ok: true };
}

export async function toggleIdeaVote(ideaId: string): Promise<ActionResult & { voted?: boolean }> {
  const actor = await requireCurrentMember();
  requireMember(actor);

  const [existing] = await db
    .select()
    .from(ideaVotes)
    .where(and(eq(ideaVotes.ideaId, ideaId), eq(ideaVotes.memberId, actor.id)))
    .limit(1);

  if (existing) {
    await db.delete(ideaVotes).where(and(eq(ideaVotes.ideaId, ideaId), eq(ideaVotes.memberId, actor.id)));
    revalidatePath("/ideas");
    revalidatePath(`/ideas/${ideaId}`);
    return { ok: true, voted: false };
  }

  await db.insert(ideaVotes).values({ ideaId, memberId: actor.id }).onConflictDoNothing();

  await recordAudit({
    actorId: actor.id,
    action: "idea_voted",
    entityType: "idea",
    entityId: ideaId,
  });

  revalidatePath("/ideas");
  revalidatePath(`/ideas/${ideaId}`);
  return { ok: true, voted: true };
}

const convertSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(2),
        description: z.string().trim().default(""),
        categoryId: z.string().uuid().nullable(),
        priority: z.enum(["low", "medium", "high", "urgent"]),
        dueDate: z.string().nullable(),
        assigneeIds: z.array(z.string().uuid()).default([]),
      })
    )
    .min(1),
});

export async function convertIdeaToTasks(
  ideaId: string,
  input: z.infer<typeof convertSchema>
): Promise<ActionResult & { taskIds?: string[] }> {
  const actor = await requireCurrentMember();
  requireOfficerOrAdmin(actor);

  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
  if (!idea) return { ok: false, error: "Idea not found." };

  const parsed = convertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid task list." };

  const taskIds: string[] = [];
  for (const t of parsed.data.tasks) {
    const { taskId } = await createTaskRecord({
      title: t.title,
      description: t.description,
      creatorId: actor.id,
      categoryId: t.categoryId,
      priority: t.priority,
      dueDate: t.dueDate,
      assigneeIds: t.assigneeIds,
      links: [],
      reviewExempt: false,
      reviewExemptReasonId: null,
    });
    await db.update(tasks).set({ sourceIdeaId: ideaId }).where(eq(tasks.id, taskId));
    await db.insert(ideaTaskLinks).values({ ideaId, taskId });
    taskIds.push(taskId);
  }

  if (idea.status === "new" || idea.status === "discussing" || idea.status === "needs_research" || idea.status === "approved") {
    await db.update(ideas).set({ status: "planned", updatedAt: new Date() }).where(eq(ideas.id, ideaId));
  }

  await recordAudit({
    actorId: actor.id,
    action: "idea_converted_to_task",
    entityType: "idea",
    entityId: ideaId,
    metadata: { taskIds },
  });

  await notify({
    memberId: idea.submittedBy,
    type: "admin_announcement",
    title: "Your idea was converted into tasks",
    body: idea.title,
    link: `/ideas/${ideaId}`,
    entityType: "idea",
    entityId: ideaId,
  });

  revalidatePath("/ideas");
  revalidatePath(`/ideas/${ideaId}`);
  revalidatePath("/tasks");
  return { ok: true, taskIds };
}
