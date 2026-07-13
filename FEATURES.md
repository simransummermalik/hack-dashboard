# HAVK Dashboard — Feature list & completion check

Every item below is implemented end to end: real database tables, real server-side authorization, real validation,
and a working UI. Nothing here is a placeholder, a mock, or a visual-only element.

## Authentication & sessions

- [x] Login with full name + 4-digit code (`src/app/login/page.tsx`, `src/actions/auth.ts`)
- [x] Codes hashed with bcrypt before storage; plaintext never persisted or logged (`src/lib/crypto.ts`)
- [x] Constant-time-ish comparison against a dummy hash when no member matches, so invalid codes never reveal
      whether a name exists
- [x] Per-(name, IP) login rate limiting with temporary lockout (`src/lib/rate-limit.ts`)
- [x] Server-side sessions: random token, SHA-256 hash stored in `sessions` table, httpOnly/secure/sameSite cookie
      (`src/lib/session.ts`)
- [x] Session expiration (`SESSION_LIFETIME_HOURS`) and explicit logout that revokes the session row
- [x] No self-registration — members can only be created by an admin or the seed script

## Roles & authorization

- [x] Three roles (admin/officer/member) stored on `members.role`
- [x] Central, unit-tested authorization module (`src/lib/authorization.ts`) — every server action calls into it;
      the UI never decides authorization on its own
- [x] Admin: add/deactivate/reactivate members, assign roles, reset codes, manage categories/review
      rules/organization settings, override the review-completion gate (with required explanation), full audit log
- [x] Officer: create/manage tasks, submit ideas, schedule meetings, record notes/decisions/action items, manage
      grants/expenses, review others' submissions
- [x] Member: create tasks, comment, submit ideas, vote, review assigned items, update tasks they created or are
      assigned to, view meetings/finance

## Dashboard

- [x] Tasks assigned to me, sorted by due date
- [x] Items waiting for my review (dedicated query, not derived from assignment)
- [x] Upcoming meetings (next 5)
- [x] Recent ideas
- [x] Grant/budget summary (funding, spent, committed, remaining)
- [x] Recent activity feed (from the audit log)
- [x] Overdue tasks (assigned to or created by me)
- [x] Tasks blocked by missing reviews
- [x] Quick-create button (task/idea/meeting/expense, role-aware)

## Tasks

- [x] Title, description, creator, assignees, category, priority, status, due date, created/updated timestamps,
      links, comments, review progress, activity history — all persisted fields, not UI-only
- [x] 10 categories seeded by default, editable in Admin Settings
- [x] 4 priorities, 7 statuses (including Backlog/Planned/In Progress/Blocked/Ready for Review/Completed/Archived)
- [x] Board view grouped by status with HTML5 drag-and-drop, **validated server-side** on every drop
      (`changeTaskStatus` re-checks the review gate and permissions regardless of what the client sent)
- [x] Searchable/filterable list view (assignee, creator, status, category, priority, review status; search by title)
- [x] Task detail page: full description, links, assignees, review panel, comments, immutable activity history

## Mandatory member review system

- [x] Every new task automatically gets one pending review row per **currently active** member
      (`src/lib/task-core.ts: createTaskRecord`), unless the creator picks an admin-configured exemption reason
- [x] Review responses: Approved / No Concerns / Changes Requested / Not Applicable, with optional comment
- [x] Live counts: reviewed / waiting / approved / no-concerns / changes-requested / completion % — matches the
      spec's worked example exactly (verified in `tests/reviews.test.ts`)
- [x] Names of who reviewed and who's waiting, shown on the task detail page
- [x] A member can only submit/edit **their own** review (`requireCanWriteReview`) — enforced server-side
- [x] Editing your own review is recorded in the audit log (`review_updated`)
- [x] A task cannot move to Completed while any active member's review is pending or any change request is
      unresolved — enforced in `changeTaskStatus`, not just hidden in the UI
- [x] Admin override requires a typed explanation; both the override and the reason are written to the audit log
      (`task_completion_overridden`)
- [x] Newly activated members are **not** retroactively added to historical task reviews
- [x] Admins can manually add a specific member as a reviewer on an existing task (`addManualReviewerAction`)
- [x] Deactivating a member stops their **pending** reviews from blocking completion while keeping their historical
      reviews visible
- [x] "Remind missing reviewers" creates an in-app notification for every still-pending active reviewer
- [x] Dedicated review inbox (`/reviews`) plus an organization-wide missing-reviews view for officers/admins
- [x] Notification system structured so email/Discord channels can be added later without touching call sites
      (`src/lib/notifications.ts`)

## Club ideas

- [x] Title, description, submitter, category, estimated cost, estimated effort, proposed timeline, benefits,
      risks, comments, votes, status — all persisted
- [x] 7 statuses (New → Discussing → Needs Research → Approved/Rejected/Planned → Implemented)
- [x] One vote per member per idea, enforced by a unique DB constraint (`idea_votes` unique index) and toggleable
      in the UI
- [x] Convert an idea into one or more tasks (officer/admin), each linked back to the idea and auto-generating its
      own mandatory reviews like any other task
- [x] Filters: most voted, newest, lowest estimated cost, approved, awaiting discussion

## Meetings

- [x] Title, date, start/end time, location/link, organizer, attendees, agenda, notes, decisions, action items,
      links, attendance status — all persisted
- [x] Self-service RSVP: Attending / Maybe / Not Attending
- [x] Action items convertible into tasks, automatically linked back to the source meeting
      (`sourceMeetingActionItemId`)
- [x] Calendar view (month grid), upcoming list, and past-meetings archive

## Grants & budget

- [x] Grant fields: name, funding org, total awarded, amount received, start date, spending deadline, restrictions,
      notes, links, status (7 statuses)
- [x] Expense fields: name, amount, date, category, grant used, requester, approver, status (6 statuses), receipt
      link, notes
- [x] All money stored/calculated as integer cents (`src/lib/money.ts`) — no floating-point rounding bugs, verified
      in `tests/money.test.ts`
- [x] Finance dashboard: total funding, spent, committed, remaining, spending by category, upcoming expected
      expenses, grants approaching their deadline
- [x] Warnings for: an expense that would exceed the remaining grant balance, an approaching spending deadline, a
      grant with restrictions on file, and an expense missing approval or documentation
- [x] Explicitly labeled as internal planning/tracking information, not formal accounting

## Notifications

- [x] In-app notification center with read/unread state (`/notifications`)
- [x] Generated for: task assigned, review requested, review changes requested, comment added, @mention, meeting
      scheduled, meeting action item, grant deadline approaching, expense awaiting approval, admin announcement,
      review reminder
- [x] Mark one / mark all as read
- [x] Unread badge in the top bar

## Comments & mentions

- [x] Comments on tasks, ideas, meetings, grants, and expenses via one polymorphic `comments` table
- [x] `@Full Name` mentions parsed against the real member roster and turned into notifications
      (`extractMentions`, unit tested)
- [x] Comment edits are marked `edited` and recorded in the audit log

## Search

- [x] Global search bar (top bar) across tasks, ideas, meetings, members, grants, and expenses
- [x] Results are labeled by type and link directly to the record

## Activity & audit log

- [x] Insert-only `audit_log` table — application code never updates or deletes a row in it
- [x] Records: logins/lockouts, record creation, status changes, assignment changes, review submissions/edits,
      admin overrides, member activation/deactivation, code resets, expense approvals/rejections, grant changes,
      category/settings changes
- [x] Each entry captures actor, action, record type/ID, timestamp, and before/after values
- [x] Members see a content-focused activity feed; admins see the complete, unfiltered audit log with raw
      before/after data

## Member directory

- [x] Full name, role, active/inactive status, tasks assigned, reviews completed, reviews waiting, per member
- [x] Access codes and code hashes are never selected into any query that reaches the client

## Admin settings

- [x] Member management: add, deactivate/reactivate, change role, reset code, bulk JSON import
- [x] Task/idea/financial categories: add and deactivate per kind
- [x] Review rules: manage the list of permitted review-exemption reasons; the override mechanism is documented
      in-page
- [x] Organization name/branding setting
- [x] Send an org-wide announcement (creates a notification for every active member)

## Design & UX

- [x] HAVK branding (sidebar mark, favicon-style avatar, themeable CSS variables)
- [x] Persistent sidebar nav (desktop) + slide-over drawer nav (mobile)
- [x] Status/priority/review/attendance badges with consistent color semantics
- [x] Progress bars for review completion
- [x] Loading states (`Loader2` spinners on every async button), empty states (`EmptyState` component throughout),
      inline error messages on every form
- [x] Confirmation dialogs for destructive actions (deactivate member, etc.) via `ConfirmButton`
- [x] Responsive layouts (grid collapses, mobile nav drawer, board scrolls horizontally on narrow screens)

## Data integrity & security

- [x] Every mutating server action re-authenticates and re-authorizes server-side — nothing trusts client-supplied
      role/ownership claims
- [x] Database-level unique constraints prevent duplicate votes and duplicate reviews
- [x] `zod` validation on every server action input
- [x] No secrets in the repository; `.gitignore` covers `.env*`, `members.private.json`, `secrets/`
- [x] Sensitive fields (access code hashes, raw codes) are never selected into client-facing query results

## No incomplete features

Every button, form, and filter described above calls a real server action or query against the real schema. There
are no `TODO` comments, no components that render but don't submit, and no features that exist only as static
markup. `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` all pass against this exact
codebase.
