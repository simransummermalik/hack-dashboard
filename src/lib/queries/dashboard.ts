import "server-only";
import { listTasksWithContext, type TaskListItem } from "./tasks";
import { listMeetings } from "./meetings";
import { listIdeas } from "./ideas";
import { getFinanceSummary } from "./finance";
import { listRecentActivity } from "./audit";
import { listPendingReviewsForMember, type PendingReviewItem } from "./reviews";
import { isOverdue } from "@/lib/utils";

export interface DashboardData {
  myTasks: TaskListItem[];
  needsMyReview: PendingReviewItem[];
  upcomingMeetings: Awaited<ReturnType<typeof listMeetings>>;
  recentIdeas: Awaited<ReturnType<typeof listIdeas>>;
  financeSummary: Awaited<ReturnType<typeof getFinanceSummary>>["summary"];
  recentActivity: Awaited<ReturnType<typeof listRecentActivity>>;
  overdueTasks: TaskListItem[];
  blockedByMissingReviews: TaskListItem[];
}

export async function getDashboardData(memberId: string): Promise<DashboardData> {
  const [allTasks, allMeetings, allIdeas, finance, activity, needsMyReview] = await Promise.all([
    listTasksWithContext(),
    listMeetings(),
    listIdeas(),
    getFinanceSummary(),
    listRecentActivity(10),
    listPendingReviewsForMember(memberId),
  ]);

  const activeTasks = allTasks.filter((t) => t.status !== "completed" && t.status !== "archived");

  const myTasks = activeTasks
    .filter((t) => t.assigneeIds.includes(memberId) || t.creatorId === memberId)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in14Days = new Date(today);
  in14Days.setDate(in14Days.getDate() + 14);

  const upcomingMeetings = allMeetings
    .filter((m) => new Date(m.meetingDate) >= today)
    .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate))
    .slice(0, 5);

  const recentIdeas = allIdeas.slice(0, 5);

  const overdueTasks = activeTasks.filter(
    (t) => (t.assigneeIds.includes(memberId) || t.creatorId === memberId) && isOverdue(t.dueDate, t.status)
  );

  const blockedByMissingReviews = activeTasks.filter(
    (t) =>
      (t.assigneeIds.includes(memberId) || t.creatorId === memberId) &&
      t.status === "ready_for_review" &&
      !t.reviewSummary.canComplete
  );

  return {
    myTasks: myTasks.slice(0, 8),
    needsMyReview,
    upcomingMeetings,
    recentIdeas,
    financeSummary: finance.summary,
    recentActivity: activity,
    overdueTasks,
    blockedByMissingReviews,
  };
}
