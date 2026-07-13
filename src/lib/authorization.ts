/**
 * Central authorization rules. Every protected server action must call one
 * of these instead of trusting client-supplied role/ownership claims.
 */

export type Role = "admin" | "officer" | "member";

export interface ActingMember {
  id: string;
  role: Role;
  active: boolean;
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function isAdmin(m: ActingMember): boolean {
  return m.role === "admin";
}

export function isOfficerOrAdmin(m: ActingMember): boolean {
  return m.role === "admin" || m.role === "officer";
}

export function requireActive(m: ActingMember) {
  if (!m.active) {
    throw new AuthorizationError("Your account has been deactivated. Contact an admin.");
  }
}

export function requireAdmin(m: ActingMember) {
  requireActive(m);
  if (!isAdmin(m)) throw new AuthorizationError("This action requires admin privileges.");
}

export function requireOfficerOrAdmin(m: ActingMember) {
  requireActive(m);
  if (!isOfficerOrAdmin(m)) throw new AuthorizationError("This action requires officer or admin privileges.");
}

/** Any active member may create tasks, ideas, comments, etc. */
export function requireMember(m: ActingMember) {
  requireActive(m);
}

/**
 * A record may be edited by its creator/owner, any officer, or an admin.
 * Plain members may only edit records they own.
 */
export function canEditOwnedRecord(m: ActingMember, ownerId: string): boolean {
  if (!m.active) return false;
  if (isOfficerOrAdmin(m)) return true;
  return m.id === ownerId;
}

export function requireCanEditOwnedRecord(m: ActingMember, ownerId: string) {
  requireActive(m);
  if (!canEditOwnedRecord(m, ownerId)) {
    throw new AuthorizationError("Only the creator, an officer, or an admin can edit this.");
  }
}

/** A member may update a task if they created it or are assigned to it (or are officer/admin). */
export function canEditTask(
  m: ActingMember,
  task: { creatorId: string; assigneeIds: string[] }
): boolean {
  if (!m.active) return false;
  if (isOfficerOrAdmin(m)) return true;
  return m.id === task.creatorId || task.assigneeIds.includes(m.id);
}

export function requireCanEditTask(
  m: ActingMember,
  task: { creatorId: string; assigneeIds: string[] }
) {
  requireActive(m);
  if (!canEditTask(m, task)) {
    throw new AuthorizationError("Only the creator, an assignee, an officer, or an admin can edit this task.");
  }
}

/** Only the reviewing member themself (or an admin adding on their behalf) may write a review row. */
export function requireCanWriteReview(
  m: ActingMember,
  reviewMemberId: string
) {
  requireActive(m);
  if (m.id !== reviewMemberId) {
    throw new AuthorizationError("You can only submit or edit your own review.");
  }
}

export function requireCanOverrideReviewGate(m: ActingMember) {
  requireActive(m);
  if (!isAdmin(m)) {
    throw new AuthorizationError("Only an admin can override the review requirement.");
  }
}
