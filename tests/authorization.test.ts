import { describe, it, expect } from "vitest";
import {
  isAdmin,
  isOfficerOrAdmin,
  requireActive,
  requireAdmin,
  requireOfficerOrAdmin,
  requireMember,
  canEditOwnedRecord,
  requireCanEditOwnedRecord,
  canEditTask,
  requireCanEditTask,
  requireCanWriteReview,
  requireCanOverrideReviewGate,
  AuthorizationError,
  type ActingMember,
} from "@/lib/authorization";

const admin: ActingMember = { id: "admin-1", role: "admin", active: true };
const officer: ActingMember = { id: "officer-1", role: "officer", active: true };
const member: ActingMember = { id: "member-1", role: "member", active: true };
const inactiveMember: ActingMember = { id: "member-2", role: "member", active: false };

describe("role checks", () => {
  it("identifies admins and officer-or-admin correctly", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(officer)).toBe(false);
    expect(isOfficerOrAdmin(officer)).toBe(true);
    expect(isOfficerOrAdmin(member)).toBe(false);
  });
});

describe("requireActive / requireAdmin / requireOfficerOrAdmin / requireMember", () => {
  it("throws for a deactivated account regardless of role", () => {
    expect(() => requireActive(inactiveMember)).toThrow(AuthorizationError);
    expect(() => requireMember(inactiveMember)).toThrow(AuthorizationError);
  });

  it("requireAdmin rejects officers and members", () => {
    expect(() => requireAdmin(admin)).not.toThrow();
    expect(() => requireAdmin(officer)).toThrow(AuthorizationError);
    expect(() => requireAdmin(member)).toThrow(AuthorizationError);
  });

  it("requireOfficerOrAdmin rejects plain members", () => {
    expect(() => requireOfficerOrAdmin(officer)).not.toThrow();
    expect(() => requireOfficerOrAdmin(admin)).not.toThrow();
    expect(() => requireOfficerOrAdmin(member)).toThrow(AuthorizationError);
  });
});

describe("canEditOwnedRecord / requireCanEditOwnedRecord", () => {
  it("lets the owner, officers, and admins edit; blocks other members", () => {
    expect(canEditOwnedRecord(member, member.id)).toBe(true);
    expect(canEditOwnedRecord(officer, member.id)).toBe(true);
    expect(canEditOwnedRecord(admin, member.id)).toBe(true);
    expect(canEditOwnedRecord({ id: "other-member", role: "member", active: true }, member.id)).toBe(false);
  });

  it("blocks a deactivated owner from editing their own record", () => {
    expect(canEditOwnedRecord(inactiveMember, inactiveMember.id)).toBe(false);
  });

  it("requireCanEditOwnedRecord throws AuthorizationError for unauthorized members", () => {
    const stranger: ActingMember = { id: "stranger", role: "member", active: true };
    expect(() => requireCanEditOwnedRecord(stranger, member.id)).toThrow(AuthorizationError);
    expect(() => requireCanEditOwnedRecord(member, member.id)).not.toThrow();
  });
});

describe("canEditTask / requireCanEditTask", () => {
  const task = { creatorId: member.id, assigneeIds: ["assignee-1"] };

  it("allows creator, assignees, officers, and admins", () => {
    expect(canEditTask(member, task)).toBe(true); // creator
    expect(canEditTask({ id: "assignee-1", role: "member", active: true }, task)).toBe(true);
    expect(canEditTask(officer, task)).toBe(true);
    expect(canEditTask(admin, task)).toBe(true);
  });

  it("blocks a member who is neither creator nor assignee", () => {
    const outsider: ActingMember = { id: "outsider", role: "member", active: true };
    expect(canEditTask(outsider, task)).toBe(false);
    expect(() => requireCanEditTask(outsider, task)).toThrow(AuthorizationError);
  });
});

describe("requireCanWriteReview", () => {
  it("only allows a member to write their own review row", () => {
    expect(() => requireCanWriteReview(member, member.id)).not.toThrow();
    expect(() => requireCanWriteReview(member, "someone-else")).toThrow(AuthorizationError);
  });

  it("does not let an admin submit a review on another member's behalf", () => {
    expect(() => requireCanWriteReview(admin, member.id)).toThrow(AuthorizationError);
  });
});

describe("requireCanOverrideReviewGate", () => {
  it("is admin-only", () => {
    expect(() => requireCanOverrideReviewGate(admin)).not.toThrow();
    expect(() => requireCanOverrideReviewGate(officer)).toThrow(AuthorizationError);
    expect(() => requireCanOverrideReviewGate(member)).toThrow(AuthorizationError);
  });
});
