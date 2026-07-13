export const TASK_STATUSES = [
  "backlog",
  "planned",
  "in_progress",
  "blocked",
  "ready_for_review",
  "completed",
  "archived",
] as const;

export const TASK_STATUS_LABELS: Record<(typeof TASK_STATUSES)[number], string> = {
  backlog: "Backlog",
  planned: "Planned",
  in_progress: "In Progress",
  blocked: "Blocked",
  ready_for_review: "Ready for Review",
  completed: "Completed",
  archived: "Archived",
};

/** Board columns shown on the Jira-style task board (archived is hidden from the board). */
export const BOARD_STATUSES = TASK_STATUSES.filter((s) => s !== "archived");

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const TASK_PRIORITY_LABELS: Record<(typeof TASK_PRIORITIES)[number], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const DEFAULT_TASK_CATEGORIES = [
  "Event Planning",
  "Sponsorship",
  "Marketing",
  "Technology",
  "Judging",
  "Participant Support",
  "Club Administration",
  "Outreach",
  "Finance",
  "General",
];

export const REVIEW_STATUSES = [
  "pending",
  "approved",
  "no_concerns",
  "changes_requested",
  "not_applicable",
] as const;

export const REVIEW_STATUS_LABELS: Record<(typeof REVIEW_STATUSES)[number], string> = {
  pending: "Pending",
  approved: "Reviewed — Approved",
  no_concerns: "Reviewed — No Concerns",
  changes_requested: "Reviewed — Changes Requested",
  not_applicable: "Not Applicable",
};

export const IDEA_STATUSES = [
  "new",
  "discussing",
  "needs_research",
  "approved",
  "rejected",
  "planned",
  "implemented",
] as const;

export const IDEA_STATUS_LABELS: Record<(typeof IDEA_STATUSES)[number], string> = {
  new: "New",
  discussing: "Discussing",
  needs_research: "Needs Research",
  approved: "Approved",
  rejected: "Rejected",
  planned: "Planned",
  implemented: "Implemented",
};

export const DEFAULT_IDEA_CATEGORIES = [
  "Event",
  "Partnership",
  "Community",
  "Fundraising",
  "Technology",
  "Other",
];

export const ATTENDANCE_STATUSES = ["attending", "maybe", "not_attending", "no_response"] as const;

export const ATTENDANCE_STATUS_LABELS: Record<(typeof ATTENDANCE_STATUSES)[number], string> = {
  attending: "Attending",
  maybe: "Maybe",
  not_attending: "Not Attending",
  no_response: "No Response",
};

export const GRANT_STATUSES = [
  "potential",
  "applying",
  "submitted",
  "awarded",
  "rejected",
  "active",
  "closed",
] as const;

export const GRANT_STATUS_LABELS: Record<(typeof GRANT_STATUSES)[number], string> = {
  potential: "Potential",
  applying: "Applying",
  submitted: "Submitted",
  awarded: "Awarded",
  rejected: "Rejected",
  active: "Active",
  closed: "Closed",
};

export const EXPENSE_STATUSES = [
  "proposed",
  "awaiting_approval",
  "approved",
  "purchased",
  "reimbursed",
  "rejected",
] as const;

export const EXPENSE_STATUS_LABELS: Record<(typeof EXPENSE_STATUSES)[number], string> = {
  proposed: "Proposed",
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
  purchased: "Purchased",
  reimbursed: "Reimbursed",
  rejected: "Rejected",
};

export const DEFAULT_FINANCE_CATEGORIES = [
  "Events",
  "Equipment",
  "Marketing",
  "Travel",
  "Food",
  "Prizes",
  "Software/Subscriptions",
  "Supplies",
  "Other",
];

export const ROLE_LABELS: Record<"admin" | "officer" | "member", string> = {
  admin: "Admin",
  officer: "Officer",
  member: "Member",
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  task_assigned: "Task Assigned",
  review_requested: "Review Requested",
  review_changes_requested: "Changes Requested",
  comment_added: "New Comment",
  mention: "Mentioned You",
  deadline_upcoming: "Upcoming Deadline",
  task_overdue: "Task Overdue",
  meeting_upcoming: "Upcoming Meeting",
  meeting_action_item: "New Action Item",
  grant_deadline: "Grant Deadline",
  expense_awaiting_approval: "Expense Awaiting Approval",
  admin_announcement: "Announcement",
  review_reminder: "Review Reminder",
};
