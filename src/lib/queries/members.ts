import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { members, taskAssignees, taskReviews } from "@/db/schema";
import type { Role } from "@/lib/authorization";

export interface MemberSummary {
  id: string;
  fullName: string;
  role: Role;
  active: boolean;
}

export async function listActiveMembers(): Promise<MemberSummary[]> {
  return db
    .select({ id: members.id, fullName: members.fullName, role: members.role, active: members.active })
    .from(members)
    .where(eq(members.active, true))
    .orderBy(asc(members.fullName));
}

export async function listAllMembers(): Promise<MemberSummary[]> {
  return db
    .select({ id: members.id, fullName: members.fullName, role: members.role, active: members.active })
    .from(members)
    .orderBy(asc(members.fullName));
}

export interface MemberDirectoryEntry extends MemberSummary {
  tasksAssigned: number;
  reviewsCompleted: number;
  reviewsWaiting: number;
}

export async function getMemberDirectory(): Promise<MemberDirectoryEntry[]> {
  const all = await listAllMembers();
  if (all.length === 0) return [];
  const ids = all.map((m) => m.id);

  const [assignmentRows, reviewRows] = await Promise.all([
    db.select({ memberId: taskAssignees.memberId }).from(taskAssignees).where(inArray(taskAssignees.memberId, ids)),
    db
      .select({ memberId: taskReviews.memberId, status: taskReviews.status })
      .from(taskReviews)
      .where(inArray(taskReviews.memberId, ids)),
  ]);

  const assignedCount = new Map<string, number>();
  for (const row of assignmentRows) {
    assignedCount.set(row.memberId, (assignedCount.get(row.memberId) ?? 0) + 1);
  }

  const completedCount = new Map<string, number>();
  const waitingCount = new Map<string, number>();
  for (const row of reviewRows) {
    if (row.status === "pending") {
      waitingCount.set(row.memberId, (waitingCount.get(row.memberId) ?? 0) + 1);
    } else {
      completedCount.set(row.memberId, (completedCount.get(row.memberId) ?? 0) + 1);
    }
  }

  return all.map((m) => ({
    ...m,
    tasksAssigned: assignedCount.get(m.id) ?? 0,
    reviewsCompleted: completedCount.get(m.id) ?? 0,
    reviewsWaiting: waitingCount.get(m.id) ?? 0,
  }));
}
