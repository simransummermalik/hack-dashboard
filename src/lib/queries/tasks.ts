import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, members, taskAssignees, taskLinks, taskReviews, tasks } from "@/db/schema";
import { summarizeReviews, type ReviewRow, type ReviewSummary } from "@/lib/reviews";

export interface TaskListItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  categoryName: string | null;
  creatorName: string;
  creatorId: string;
  assigneeNames: string[];
  assigneeIds: string[];
  reviewSummary: ReviewSummary;
  createdAt: string;
  updatedAt: string;
}

/** Loads every task plus enough joined data to render the board/list/dashboard views. */
export async function listTasksWithContext(): Promise<TaskListItem[]> {
  const allTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      categoryName: categories.name,
      creatorId: tasks.creatorId,
      creatorName: members.fullName,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .innerJoin(members, eq(tasks.creatorId, members.id));

  if (allTasks.length === 0) return [];

  const taskIds = allTasks.map((t) => t.id);

  const [assigneeRows, reviewRows] = await Promise.all([
    db
      .select({ taskId: taskAssignees.taskId, memberId: taskAssignees.memberId, memberName: members.fullName })
      .from(taskAssignees)
      .innerJoin(members, eq(taskAssignees.memberId, members.id))
      .where(inArray(taskAssignees.taskId, taskIds)),
    db
      .select({
        taskId: taskReviews.taskId,
        memberId: taskReviews.memberId,
        memberName: members.fullName,
        memberActive: members.active,
        status: taskReviews.status,
        comment: taskReviews.comment,
      })
      .from(taskReviews)
      .innerJoin(members, eq(taskReviews.memberId, members.id))
      .where(inArray(taskReviews.taskId, taskIds)),
  ]);

  const assigneesByTask = new Map<string, { id: string; name: string }[]>();
  for (const row of assigneeRows) {
    const list = assigneesByTask.get(row.taskId) ?? [];
    list.push({ id: row.memberId, name: row.memberName });
    assigneesByTask.set(row.taskId, list);
  }

  const reviewsByTask = new Map<string, ReviewRow[]>();
  for (const row of reviewRows) {
    const list = reviewsByTask.get(row.taskId) ?? [];
    list.push({
      memberId: row.memberId,
      memberName: row.memberName,
      memberActive: row.memberActive,
      status: row.status,
      comment: row.comment,
    });
    reviewsByTask.set(row.taskId, list);
  }

  return allTasks.map((t) => {
    const assignees = assigneesByTask.get(t.id) ?? [];
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      categoryName: t.categoryName,
      creatorId: t.creatorId,
      creatorName: t.creatorName,
      assigneeIds: assignees.map((a) => a.id),
      assigneeNames: assignees.map((a) => a.name),
      reviewSummary: summarizeReviews(reviewsByTask.get(t.id) ?? []),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  });
}

export interface TaskDetail extends TaskListItem {
  description: string;
  reviewExempt: boolean;
  reviewExemptReasonId: string | null;
  completedAt: string | null;
  completionOverrideBy: string | null;
  completionOverrideReason: string | null;
  sourceIdeaId: string | null;
  sourceMeetingActionItemId: string | null;
  links: { id: string; label: string; url: string }[];
  reviews: ReviewRow[];
}

export async function getTaskDetail(taskId: string): Promise<TaskDetail | null> {
  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      categoryName: categories.name,
      creatorId: tasks.creatorId,
      creatorName: members.fullName,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      reviewExempt: tasks.reviewExempt,
      reviewExemptReasonId: tasks.reviewExemptReasonId,
      completedAt: tasks.completedAt,
      completionOverrideBy: tasks.completionOverrideBy,
      completionOverrideReason: tasks.completionOverrideReason,
      sourceIdeaId: tasks.sourceIdeaId,
      sourceMeetingActionItemId: tasks.sourceMeetingActionItemId,
    })
    .from(tasks)
    .leftJoin(categories, eq(tasks.categoryId, categories.id))
    .innerJoin(members, eq(tasks.creatorId, members.id))
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) return null;

  const [assigneeRows, reviewRows, linkRows] = await Promise.all([
    db
      .select({ memberId: taskAssignees.memberId, memberName: members.fullName })
      .from(taskAssignees)
      .innerJoin(members, eq(taskAssignees.memberId, members.id))
      .where(eq(taskAssignees.taskId, taskId)),
    db
      .select({
        memberId: taskReviews.memberId,
        memberName: members.fullName,
        memberActive: members.active,
        status: taskReviews.status,
        comment: taskReviews.comment,
      })
      .from(taskReviews)
      .innerJoin(members, eq(taskReviews.memberId, members.id))
      .where(eq(taskReviews.taskId, taskId)),
    db.select().from(taskLinks).where(eq(taskLinks.taskId, taskId)),
  ]);

  const reviews: ReviewRow[] = reviewRows.map((r) => ({
    memberId: r.memberId,
    memberName: r.memberName,
    memberActive: r.memberActive,
    status: r.status,
    comment: r.comment,
  }));

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    categoryName: task.categoryName,
    creatorId: task.creatorId,
    creatorName: task.creatorName,
    assigneeIds: assigneeRows.map((a) => a.memberId),
    assigneeNames: assigneeRows.map((a) => a.memberName),
    reviewSummary: summarizeReviews(reviews),
    reviews,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    reviewExempt: task.reviewExempt,
    reviewExemptReasonId: task.reviewExemptReasonId,
    completedAt: task.completedAt?.toISOString() ?? null,
    completionOverrideBy: task.completionOverrideBy,
    completionOverrideReason: task.completionOverrideReason,
    sourceIdeaId: task.sourceIdeaId,
    sourceMeetingActionItemId: task.sourceMeetingActionItemId,
    links: linkRows.map((l) => ({ id: l.id, label: l.label, url: l.url })),
  };
}
