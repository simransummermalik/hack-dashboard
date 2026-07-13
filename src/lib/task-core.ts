// Deliberately no "server-only" guard here: this module is shared between
// Next.js server actions and the standalone seed script (scripts/seed.ts),
// which runs outside the Next.js build and would throw on that import.
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { members, taskAssignees, taskLinks, taskReviews, tasks } from "@/db/schema";

export interface CreateTaskInput {
  title: string;
  description: string;
  creatorId: string;
  categoryId: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status?: "backlog" | "planned" | "in_progress" | "blocked" | "ready_for_review" | "completed" | "archived";
  dueDate: string | null;
  assigneeIds: string[];
  links: Array<{ label: string; url: string }>;
  reviewExempt: boolean;
  reviewExemptReasonId: string | null;
}

export interface CreatedTask {
  taskId: string;
  reviewerMemberIds: string[];
}

/**
 * Creates a task and, unless exempted, generates one pending review record
 * for every currently-active member (per the mandatory review policy).
 * Pure DB operation — callers (server actions, seed script) are responsible
 * for authorization and side effects like notifications/audit logging.
 */
export async function createTaskRecord(input: CreateTaskInput): Promise<CreatedTask> {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .insert(tasks)
      .values({
        title: input.title,
        description: input.description,
        creatorId: input.creatorId,
        categoryId: input.categoryId,
        priority: input.priority,
        status: input.status ?? "backlog",
        dueDate: input.dueDate,
        reviewExempt: input.reviewExempt,
        reviewExemptReasonId: input.reviewExemptReasonId,
      })
      .returning({ id: tasks.id });

    if (!task) throw new Error("Failed to create task");

    if (input.assigneeIds.length > 0) {
      await tx.insert(taskAssignees).values(
        input.assigneeIds.map((memberId) => ({ taskId: task.id, memberId }))
      );
    }

    if (input.links.length > 0) {
      await tx.insert(taskLinks).values(
        input.links.map((link) => ({
          taskId: task.id,
          label: link.label,
          url: link.url,
          createdBy: input.creatorId,
        }))
      );
    }

    let reviewerMemberIds: string[] = [];
    if (!input.reviewExempt) {
      const activeMembers = await tx
        .select({ id: members.id })
        .from(members)
        .where(eq(members.active, true));

      reviewerMemberIds = activeMembers.map((m) => m.id);

      if (reviewerMemberIds.length > 0) {
        await tx.insert(taskReviews).values(
          reviewerMemberIds.map((memberId) => ({
            taskId: task.id,
            memberId,
            status: "pending" as const,
          }))
        );
      }
    }

    return { taskId: task.id, reviewerMemberIds };
  });
}

/** Manually add a review requirement for one member on an existing task (admin action). */
export async function addManualReviewer(taskId: string, memberId: string): Promise<void> {
  await db
    .insert(taskReviews)
    .values({ taskId, memberId, status: "pending", addedManually: true })
    .onConflictDoNothing();
}

export async function getTaskAssigneeIds(taskId: string): Promise<string[]> {
  const rows = await db
    .select({ memberId: taskAssignees.memberId })
    .from(taskAssignees)
    .where(eq(taskAssignees.taskId, taskId));
  return rows.map((r) => r.memberId);
}

export async function getActiveMemberIds(): Promise<string[]> {
  const rows = await db.select({ id: members.id }).from(members).where(eq(members.active, true));
  return rows.map((r) => r.id);
}

export async function getMembersByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(members).where(inArray(members.id, ids));
}
