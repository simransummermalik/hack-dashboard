import "server-only";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";

export type AuditAction =
  | "login_success"
  | "login_failed"
  | "login_locked_out"
  | "logout"
  | "member_created"
  | "member_updated"
  | "member_role_changed"
  | "member_deactivated"
  | "member_reactivated"
  | "member_code_reset"
  | "task_created"
  | "task_updated"
  | "task_status_changed"
  | "task_assignees_changed"
  | "task_completed"
  | "task_completion_overridden"
  | "task_review_added_manually"
  | "review_submitted"
  | "review_updated"
  | "idea_created"
  | "idea_updated"
  | "idea_voted"
  | "idea_converted_to_task"
  | "meeting_created"
  | "meeting_updated"
  | "meeting_attendance_updated"
  | "meeting_action_item_converted"
  | "grant_created"
  | "grant_updated"
  | "expense_created"
  | "expense_updated"
  | "expense_approved"
  | "expense_rejected"
  | "comment_created"
  | "comment_updated"
  | "category_created"
  | "category_updated"
  | "settings_updated"
  | "review_exemption_reason_created"
  | "review_exemption_reason_updated"
  | "admin_announcement_sent";

export interface AuditEntryInput {
  actorId: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Records an immutable audit log entry. This table is insert-only — no
 * application code should ever update or delete rows here.
 */
export async function recordAudit(entry: AuditEntryInput): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before === undefined ? null : (entry.before as object),
    after: entry.after === undefined ? null : (entry.after as object),
    metadata: entry.metadata === undefined ? null : entry.metadata,
  });
}
