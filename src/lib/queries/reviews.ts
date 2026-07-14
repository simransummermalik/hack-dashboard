import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { members, taskReviews, tasks } from "@/db/schema";
import { listTasksWithContext, type TaskListItem } from "./tasks";

export interface PendingReviewItem extends TaskListItem {
  reviewId: string;
}

/**
 * Tasks where the given member has a pending (not yet submitted) review.
 * Pass `preloadedTasks` when the caller already has a fresh
 * `listTasksWithContext()` result (e.g. the dashboard) to avoid querying
 * the same task/assignee/review data twice in one request.
 */
export async function listPendingReviewsForMember(
  memberId: string,
  preloadedTasks?: TaskListItem[]
): Promise<PendingReviewItem[]> {
  const pending = await db
    .select({ taskId: taskReviews.taskId, reviewId: taskReviews.id })
    .from(taskReviews)
    .where(and(eq(taskReviews.memberId, memberId), eq(taskReviews.status, "pending")));

  if (pending.length === 0) return [];
  const taskIdToReviewId = new Map(pending.map((p) => [p.taskId, p.reviewId]));

  const allTasks = preloadedTasks ?? (await listTasksWithContext());
  return allTasks
    .filter((t) => taskIdToReviewId.has(t.id))
    .map((t) => ({ ...t, reviewId: taskIdToReviewId.get(t.id)! }));
}

export interface OrgMissingReviewsRow {
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  memberId: string;
  memberName: string;
}

/** Org-wide list of every pending review from a currently-active member, for the admin "missing reviews" page. */
export async function listOrgWideMissingReviews(): Promise<OrgMissingReviewsRow[]> {
  const rows = await db
    .select({
      taskId: tasks.id,
      taskTitle: tasks.title,
      taskStatus: tasks.status,
      memberId: members.id,
      memberName: members.fullName,
    })
    .from(taskReviews)
    .innerJoin(tasks, eq(taskReviews.taskId, tasks.id))
    .innerJoin(members, eq(taskReviews.memberId, members.id))
    .where(and(eq(taskReviews.status, "pending"), eq(members.active, true)));

  return rows;
}
