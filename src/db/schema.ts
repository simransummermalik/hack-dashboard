import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  date,
  time,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const memberRoleEnum = pgEnum("member_role", ["admin", "officer", "member"]);

export const categoryKindEnum = pgEnum("category_kind", ["task", "idea", "finance"]);

export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);

export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "planned",
  "in_progress",
  "blocked",
  "ready_for_review",
  "completed",
  "archived",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "no_concerns",
  "changes_requested",
  "not_applicable",
]);

export const ideaStatusEnum = pgEnum("idea_status", [
  "new",
  "discussing",
  "needs_research",
  "approved",
  "rejected",
  "planned",
  "implemented",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "attending",
  "maybe",
  "not_attending",
  "no_response",
]);

export const grantStatusEnum = pgEnum("grant_status", [
  "potential",
  "applying",
  "submitted",
  "awarded",
  "rejected",
  "active",
  "closed",
]);

export const expenseStatusEnum = pgEnum("expense_status", [
  "proposed",
  "awaiting_approval",
  "approved",
  "purchased",
  "reimbursed",
  "rejected",
]);

export const entityTypeEnum = pgEnum("entity_type", [
  "task",
  "idea",
  "meeting",
  "grant",
  "expense",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "task_assigned",
  "review_requested",
  "review_changes_requested",
  "comment_added",
  "mention",
  "deadline_upcoming",
  "task_overdue",
  "meeting_upcoming",
  "meeting_action_item",
  "grant_deadline",
  "expense_awaiting_approval",
  "admin_announcement",
  "review_reminder",
]);

// ---------------------------------------------------------------------------
// Members & auth
// ---------------------------------------------------------------------------

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  normalizedName: text("normalized_name").notNull(), // lowercase/trimmed, used for login lookup
  codeHash: text("code_hash").notNull(),
  email: text("email"), // optional — used only for outbound email notifications
  role: memberRoleEnum("role").notNull().default("member"),
  active: boolean("active").notNull().default(true),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  normalizedNameIdx: uniqueIndex("members_normalized_name_idx").on(t.normalizedName),
}));

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull(),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => ({
  tokenHashIdx: uniqueIndex("sessions_token_hash_idx").on(t.tokenHash),
  memberIdx: index("sessions_member_idx").on(t.memberId),
}));

export const loginAttempts = pgTable("login_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  normalizedName: text("normalized_name").notNull(),
  ip: text("ip").notNull(),
  success: boolean("success").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  lookupIdx: index("login_attempts_lookup_idx").on(t.normalizedName, t.ip, t.createdAt),
}));

// ---------------------------------------------------------------------------
// Categories (task / idea / finance) & org settings
// ---------------------------------------------------------------------------

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: categoryKindEnum("kind").notNull(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  kindNameIdx: uniqueIndex("categories_kind_name_idx").on(t.kind, t.name),
}));

export const reviewExemptionReasons = pgTable("review_exemption_reasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgSettings = pgTable("org_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => members.id),
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  creatorId: uuid("creator_id").notNull().references(() => members.id),
  categoryId: uuid("category_id").references(() => categories.id),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  status: taskStatusEnum("status").notNull().default("backlog"),
  dueDate: date("due_date"),
  reviewExempt: boolean("review_exempt").notNull().default(false),
  reviewExemptReasonId: uuid("review_exempt_reason_id").references(() => reviewExemptionReasons.id),
  sourceIdeaId: uuid("source_idea_id"),
  sourceMeetingActionItemId: uuid("source_meeting_action_item_id"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completionOverrideBy: uuid("completion_override_by").references(() => members.id),
  completionOverrideReason: text("completion_override_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("tasks_status_idx").on(t.status),
  creatorIdx: index("tasks_creator_idx").on(t.creatorId),
  dueDateIdx: index("tasks_due_date_idx").on(t.dueDate),
}));

export const taskAssignees = pgTable("task_assignees", {
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: uniqueIndex("task_assignees_pk").on(t.taskId, t.memberId),
}));

export const taskLinks = pgTable("task_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  url: text("url").notNull(),
  createdBy: uuid("created_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskReviews = pgTable("task_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  status: reviewStatusEnum("status").notNull().default("pending"),
  comment: text("comment"),
  addedManually: boolean("added_manually").notNull().default(false),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  taskMemberIdx: uniqueIndex("task_reviews_task_member_idx").on(t.taskId, t.memberId),
  memberIdx: index("task_reviews_member_idx").on(t.memberId),
}));

// ---------------------------------------------------------------------------
// Ideas
// ---------------------------------------------------------------------------

export const ideas = pgTable("ideas", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  submittedBy: uuid("submitted_by").notNull().references(() => members.id),
  categoryId: uuid("category_id").references(() => categories.id),
  estimatedCostCents: integer("estimated_cost_cents"),
  estimatedEffort: text("estimated_effort"),
  proposedTimeline: text("proposed_timeline"),
  benefits: text("benefits"),
  risks: text("risks"),
  status: ideaStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("ideas_status_idx").on(t.status),
}));

export const ideaVotes = pgTable("idea_votes", {
  ideaId: uuid("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: uniqueIndex("idea_votes_pk").on(t.ideaId, t.memberId),
}));

export const ideaTaskLinks = pgTable("idea_task_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  ideaId: uuid("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  meetingDate: date("meeting_date").notNull(),
  startTime: time("start_time"),
  endTime: time("end_time"),
  location: text("location"),
  organizerId: uuid("organizer_id").notNull().references(() => members.id),
  agenda: text("agenda").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  dateIdx: index("meetings_date_idx").on(t.meetingDate),
}));

export const meetingAttendees = pgTable("meeting_attendees", {
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  status: attendanceStatusEnum("status").notNull().default("no_response"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
}, (t) => ({
  pk: uniqueIndex("meeting_attendees_pk").on(t.meetingId, t.memberId),
}));

export const meetingDecisions = pgTable("meeting_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  createdBy: uuid("created_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meetingActionItems = pgTable("meeting_action_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  ownerId: uuid("owner_id").references(() => members.id),
  dueDate: date("due_date"),
  convertedTaskId: uuid("converted_task_id").references(() => tasks.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meetingLinks = pgTable("meeting_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  url: text("url").notNull(),
  createdBy: uuid("created_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Finance: grants & expenses
// ---------------------------------------------------------------------------

export const grants = pgTable("grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  fundingOrg: text("funding_org").notNull(),
  totalAwardedCents: integer("total_awarded_cents").notNull().default(0),
  amountReceivedCents: integer("amount_received_cents").notNull().default(0),
  startDate: date("start_date"),
  spendingDeadline: date("spending_deadline"),
  restrictions: text("restrictions"),
  notes: text("notes"),
  status: grantStatusEnum("status").notNull().default("potential"),
  createdBy: uuid("created_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const grantLinks = pgTable("grant_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  grantId: uuid("grant_id").notNull().references(() => grants.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  url: text("url").notNull(),
  createdBy: uuid("created_by").notNull().references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  expenseDate: date("expense_date").notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  grantId: uuid("grant_id").references(() => grants.id),
  requestedBy: uuid("requested_by").notNull().references(() => members.id),
  approvedBy: uuid("approved_by").references(() => members.id),
  status: expenseStatusEnum("status").notNull().default("proposed"),
  receiptUrl: text("receipt_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  grantIdx: index("expenses_grant_idx").on(t.grantId),
  statusIdx: index("expenses_status_idx").on(t.status),
}));

// ---------------------------------------------------------------------------
// Comments & mentions (generic, polymorphic over entity_type/entity_id)
// ---------------------------------------------------------------------------

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  authorId: uuid("author_id").notNull().references(() => members.id),
  body: text("body").notNull(),
  edited: boolean("edited").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("comments_entity_idx").on(t.entityType, t.entityId),
}));

export const commentMentions = pgTable("comment_mentions", {
  commentId: uuid("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: uniqueIndex("comment_mentions_pk").on(t.commentId, t.memberId),
}));

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  link: text("link"),
  entityType: entityTypeEnum("entity_type"),
  entityId: uuid("entity_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  memberReadIdx: index("notifications_member_read_idx").on(t.memberId, t.read),
}));

// ---------------------------------------------------------------------------
// Audit log (immutable — insert only, no update/delete in app code)
// ---------------------------------------------------------------------------

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => members.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("audit_log_entity_idx").on(t.entityType, t.entityId),
  actorIdx: index("audit_log_actor_idx").on(t.actorId),
  createdAtIdx: index("audit_log_created_at_idx").on(t.createdAt),
}));

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const membersRelations = relations(members, ({ many }) => ({
  createdTasks: many(tasks),
  sessions: many(sessions),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  creator: one(members, { fields: [tasks.creatorId], references: [members.id] }),
  category: one(categories, { fields: [tasks.categoryId], references: [categories.id] }),
  assignees: many(taskAssignees),
  reviews: many(taskReviews),
  links: many(taskLinks),
}));

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, { fields: [taskAssignees.taskId], references: [tasks.id] }),
  member: one(members, { fields: [taskAssignees.memberId], references: [members.id] }),
}));

export const taskReviewsRelations = relations(taskReviews, ({ one }) => ({
  task: one(tasks, { fields: [taskReviews.taskId], references: [tasks.id] }),
  member: one(members, { fields: [taskReviews.memberId], references: [members.id] }),
}));

export const ideasRelations = relations(ideas, ({ one, many }) => ({
  submitter: one(members, { fields: [ideas.submittedBy], references: [members.id] }),
  category: one(categories, { fields: [ideas.categoryId], references: [categories.id] }),
  votes: many(ideaVotes),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  organizer: one(members, { fields: [meetings.organizerId], references: [members.id] }),
  attendees: many(meetingAttendees),
  decisions: many(meetingDecisions),
  actionItems: many(meetingActionItems),
}));

export const grantsRelations = relations(grants, ({ many }) => ({
  expenses: many(expenses),
  links: many(grantLinks),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  grant: one(grants, { fields: [expenses.grantId], references: [grants.id] }),
  requester: one(members, { fields: [expenses.requestedBy], references: [members.id] }),
  approver: one(members, { fields: [expenses.approvedBy], references: [members.id] }),
}));
