import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, members } from "@/db/schema";

export interface AuditEntry {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: string;
}

/** Actions surfaced in member-facing activity feeds (login/logout noise is excluded). */
export const FEED_VISIBLE_ACTIONS = [
  "task_created",
  "task_updated",
  "task_status_changed",
  "task_completed",
  "task_completion_overridden",
  "review_submitted",
  "review_updated",
  "idea_created",
  "idea_updated",
  "idea_voted",
  "idea_converted_to_task",
  "meeting_created",
  "meeting_updated",
  "meeting_action_item_converted",
  "grant_created",
  "grant_updated",
  "expense_created",
  "expense_approved",
  "expense_rejected",
  "comment_created",
  "member_created",
  "member_deactivated",
  "member_reactivated",
];

export async function listRecentActivity(limit = 15): Promise<AuditEntry[]> {
  const rows = await db
    .select()
    .from(auditLog)
    .where(inArray(auditLog.action, FEED_VISIBLE_ACTIONS))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return hydrateActorNames(rows);
}

export async function listFullAuditLog(limit = 200): Promise<AuditEntry[]> {
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
  return hydrateActorNames(rows);
}

export async function listActivityForEntity(entityType: string, entityId: string): Promise<AuditEntry[]> {
  const rows = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)))
    .orderBy(desc(auditLog.createdAt));
  return hydrateActorNames(rows);
}

async function hydrateActorNames(
  rows: Array<typeof auditLog.$inferSelect>
): Promise<AuditEntry[]> {
  const actorIds = Array.from(new Set(rows.map((r) => r.actorId).filter((id): id is string => Boolean(id))));
  const actors = actorIds.length > 0 ? await db.select({ id: members.id, fullName: members.fullName }).from(members).where(inArray(members.id, actorIds)) : [];
  const nameById = new Map(actors.map((a) => [a.id, a.fullName]));

  return rows.map((r) => ({
    id: r.id,
    actorName: r.actorId ? nameById.get(r.actorId) ?? "Former member" : "System",
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    before: r.before,
    after: r.after,
    metadata: r.metadata,
    createdAt: r.createdAt.toISOString(),
  }));
}
