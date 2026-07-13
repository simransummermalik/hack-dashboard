# HAVK Dashboard

A complete, production-ready internal project-management dashboard for HAVK — a simplified Jira built for a student
hackathon organization. Tasks, mandatory member reviews, club ideas, meetings, grants/spending, notifications, and a
full audit trail, all in one app.

Stack: **Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui-style components + Drizzle ORM + Supabase
Postgres**. Authentication is custom (full name + 4-digit code), not Supabase Auth — see [Authentication](#authentication).

---

## Table of contents

1. [Quick start](#quick-start)
2. [Supabase setup](#supabase-setup)
3. [Local development](#local-development)
4. [Authentication](#authentication)
5. [Adding / updating members](#adding--updating-members)
6. [Assigning admins](#assigning-admins)
7. [Seed & demo data](#seed--demo-data)
8. [Email notifications](#email-notifications)
9. [Deployment](#deployment)
10. [Testing](#testing)
11. [Project structure](#project-structure)
12. [Feature list](#feature-list)
13. [Security notes](#security-notes)
14. [Completion checklist](#completion-checklist)

---

## Quick start

```bash
git clone <this-repo> havk-dashboard
cd havk-dashboard
npm install
cp .env.example .env.local          # fill in your Supabase connection strings
cp members.private.json.example members.private.json   # add real members (gitignored)
npm run db:migrate                  # create tables in your Supabase database
npm run db:seed                     # load members + reference data (+ demo data if enabled)
npm run dev                         # http://localhost:3000
```

Log in with a full name + 4-digit code from `members.private.json`, or with a demo account if you enabled demo data
(see [Seed & demo data](#seed--demo-data)).

---

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In **Project Settings → Database → Connection string**, copy two connection strings:
   - **Transaction pooler** (port `6543`) → this is `DATABASE_URL`. The app uses this at runtime; it's
     serverless/connection-pooling friendly (safe for Vercel, etc.).
   - **Session / direct connection** (port `5432`) → this is `DIRECT_URL`. Migrations and the seed script use this
     because pooled connections don't support the session-level features `drizzle-kit` needs.
3. Paste both into `.env.local` (see `.env.example` for the exact format). Make sure to URL-encode your database
   password if it contains special characters.
4. Run the migration:
   ```bash
   npm run db:migrate
   ```
   This creates every table, enum, index, and foreign key defined in [`src/db/schema.ts`](src/db/schema.ts) using the
   SQL migration checked in at [`drizzle/0000_giant_stone_men.sql`](drizzle/0000_giant_stone_men.sql). No manual SQL
   is required — Supabase is used purely as hosted Postgres.
5. Run the seed script (see below) to load members and reference data.

You do **not** need to enable Supabase Auth, Row Level Security policies, or Supabase Storage — this app manages its
own authentication and authorization entirely in the Next.js server layer (see [Authentication](#authentication) and
[Security notes](#security-notes)).

---

## Local development

```bash
npm run dev          # start the dev server at http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run lint          # eslint
npm run test          # vitest run (unit tests, no DB required)
npm run build          # production build
npm run db:studio     # Drizzle Studio — browse your DB in the browser
```

Environment variables live in `.env.local` (gitignored). See `.env.example` for the full list with comments.

---

## Authentication

Members log in with their **full name** and a **4-digit access code** assigned by an admin. There is no
self-registration and no email/password.

How it works end to end:

- Codes are hashed with **bcrypt** (`src/lib/crypto.ts`) before they ever touch the database. Plaintext codes are
  never stored, logged, or returned from any API/server action.
- Login (`src/actions/auth.ts`) always runs a bcrypt comparison — even when the name doesn't match any member, it
  compares against a dummy hash — so response timing can't reveal whether a given name has an account. The error
  message is identical ("Invalid name or access code.") whether the name is wrong, the code is wrong, or the account
  is inactive.
- Login attempts are rate-limited per (normalized name, IP) pair (`src/lib/rate-limit.ts`). After
  `LOGIN_MAX_ATTEMPTS` (default 5) failed attempts in `LOGIN_LOCKOUT_MINUTES` (default 15), further attempts are
  rejected with a lockout message, and the lockout is written to the audit log.
- Sessions are server-side: a random 32-byte token is generated, its SHA-256 hash is stored in the `sessions` table
  with an expiry, and only the raw token goes into an **httpOnly, secure (in production), sameSite=lax** cookie.
  Nothing about the session is readable or forgeable from client JavaScript.
- Sessions expire automatically after `SESSION_LIFETIME_HOURS` (default 12). Logging out revokes the session
  server-side immediately (`src/actions/auth.ts: logout`).
- Every protected server action re-checks the session and role server-side (`src/lib/current-member.ts`,
  `src/lib/authorization.ts`) — the UI hides buttons a member can't use, but that's a convenience, not the security
  boundary. Authorization is enforced identically no matter how the request was made.

---

## Adding / updating members

You (the admin) own the member roster — the app never invents accounts.

### Option A — private seed file (recommended for initial setup)

1. Copy the example file: `cp members.private.json.example members.private.json`. This file is in `.gitignore` and
   will never be committed.
2. Edit it — one entry per member:
   ```json
   [
     { "fullName": "Summer Malik", "code": "4821", "role": "admin", "active": true },
     { "fullName": "Example Member", "code": "1937", "role": "member", "active": true }
   ]
   ```
   - `fullName` — exactly what the member will type to log in (matching is case/whitespace-insensitive).
   - `code` — a unique 4-digit string. You choose it; the script hashes it before saving.
   - `role` — `"admin"`, `"officer"`, or `"member"`.
   - `active` — `true`/`false`.
3. Run `npm run db:seed`. This is **idempotent and safe to re-run**: existing members (matched by normalized full
   name) are updated in place (role, active status, and code are refreshed); new entries are inserted. You never
   need to touch application code to add or update a member.

### Option B — admin UI (day-to-day use)

Once you have at least one admin account, log in and go to **Admin Settings → Members**:

- **Add member** — name, 4-digit code, role.
- **Deactivate / reactivate** — deactivated members keep their historical records (reviews, comments, audit entries)
  but lose access and stop being required reviewers on new tasks.
- **Change role** — inline dropdown per member.
- **Reset access code** — generates nothing automatically; you type the new 4-digit code, which is hashed
  immediately. The reset event is logged in the audit log, but the new code itself is never written to the log.
- **Bulk import (JSON)** — paste an array in the same format as `members.private.json` to add/update many members at
  once from the browser.

---

## Assigning admins

- **First admin**: set `"role": "admin"` for at least one entry in `members.private.json` before running
  `npm run db:seed` the first time.
- **Additional admins**: any existing admin can promote another member from **Admin Settings → Members** by changing
  their role to Admin, or by editing `members.private.json` and re-running `npm run db:seed`.
- Every role change is recorded in the audit log with the before/after role and the acting admin.

---

## Seed & demo data

`npm run db:seed` always seeds (idempotently):

- Default task/idea/finance categories and permitted review-exemption reasons.
- Organization settings (name, review rules).
- Members from `members.private.json` (if present — a warning is printed if it's missing, not an error, so a
  demo-only environment still works).

To additionally load **non-sensitive demonstration data** (sample members, tasks in every status, completed and
pending reviews, ideas, meetings, grants, and expenses) so the app can be evaluated immediately:

```bash
LOAD_DEMO_DATA=true npm run db:seed
```

or set `LOAD_DEMO_DATA="true"` in `.env.local` and re-run the seed. Demo members come from the **committed**
[`members.demo.json`](members.demo.json) file — clearly fake names (e.g. "Demo Admin") with clearly fake codes
(`0001`–`0010`), completely separate from your real roster in `members.private.json`. Demo content is only created
once (it's skipped on subsequent seed runs once demo data is detected), so it's safe to re-run.

**Never put real member codes in `members.demo.json`** — that file is committed to the repository.

---

## Email notifications

Every in-app notification (task assigned, review requested, changes requested, mentions, meeting action items,
expense approvals, admin announcements, etc.) can **also** be emailed, on top of showing up in the notification
center. This is entirely optional — with no configuration, the app works exactly as before, purely in-app.

### Enabling it

1. Create a free account at [resend.com](https://resend.com) and copy your API key.
2. Add two variables to `.env.local` (and to your deployment's environment variables):
   ```
   RESEND_API_KEY="re_..."
   EMAIL_FROM="HAVK Dashboard <onboarding@resend.dev>"
   ```
3. Add an `"email"` field to each member you want emailed in `members.private.json`:
   ```json
   { "fullName": "Summer Malik", "code": "4821", "role": "admin", "active": true, "email": "summer@example.edu" }
   ```
   `email` is optional per member — anyone without one just gets in-app notifications.
4. Run `npm run db:seed` to write the email addresses to the database.

### The sandbox limitation

Until you verify a custom sending domain in Resend, the default sender (`onboarding@resend.dev`) can only deliver to
**the email address on your own Resend account** — not to arbitrary member addresses. You'll see emails succeed for
yourself and silently not arrive for anyone else. This is a Resend anti-abuse restriction, not a bug in the app.

To send to your whole roster, verify a domain you control under **Resend → Domains**, then set:
```
EMAIL_FROM="HAVK Dashboard <notifications@yourdomain.org>"
```

### Failure handling

Email delivery failures (bad key, provider outage, an address Resend won't send to) are logged server-side and
swallowed — they never make an otherwise-successful action (like creating a task) fail or roll back. In-app
notifications are unaffected either way.

---

## Deployment

The app is a standard Next.js app and deploys anywhere Next.js runs. Vercel is the simplest path:

1. Push this repository to GitHub (`members.private.json`, `.env*`, and `secrets/` are gitignored automatically —
   double check `git status` before your first push).
2. Import the repo in [Vercel](https://vercel.com/new).
3. Add environment variables from `.env.example` in the Vercel project settings (Production + Preview):
   `DATABASE_URL`, `DIRECT_URL`, `APP_URL` (your deployed URL), `NEXT_PUBLIC_ORG_NAME`, `SESSION_COOKIE_NAME`,
   `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`, `SESSION_LIFETIME_HOURS`.
4. Deploy. Vercel runs `npm run build` automatically.
5. Run the migration and seed **once**, from your machine, pointed at the production database:
   ```bash
   DATABASE_URL=... DIRECT_URL=... npm run db:migrate
   DATABASE_URL=... DIRECT_URL=... MEMBERS_SEED_FILE=members.private.json npm run db:seed
   ```
   (Migrations/seeding are not run automatically on every deploy, since the seed script mutates member
   roles/active-status from your local roster file — you control when that happens.)
6. Visit your deployed URL and log in.

For any other host (Render, Railway, Fly.io, a VPS, etc.): set the same environment variables, run
`npm run build && npm run start`, and run `db:migrate` / `db:seed` the same way before first use.

**Session cookies are `secure` in production** (`NODE_ENV=production`), so the app must be served over HTTPS in
production — this is the default on Vercel and most managed hosts.

---

## Testing

```bash
npm run test
```

Automated tests (Vitest, no database required — they exercise pure business logic directly):

- **`tests/auth.test.ts`** — access-code hashing/verification, constant-time dummy-hash comparison, code format
  validation, name normalization for login lookups, session token generation/hashing.
- **`tests/authorization.test.ts`** — every role/ownership rule in `src/lib/authorization.ts`: admin-only actions,
  officer-or-admin actions, owner-or-officer-or-admin edit rules, task edit rules (creator/assignee/officer/admin),
  "members can only write their own review," and the admin-only review-gate override.
- **`tests/reviews.test.ts`** — the mandatory review workflow: completion percentage and counts match the spec's
  worked example exactly (7 of 10, 5 approved, 2 no concerns, 3 waiting); a task cannot complete while any active
  member's review is pending; a pending review from a **deactivated** member does not block completion (but stays
  visible); any unresolved "changes requested" blocks completion even if everyone else is done.
- **`tests/money.test.ts`** — all financial calculations: dollar↔cent conversion (including floating-point traps),
  currency formatting, committed vs. spent expense classification, remaining grant balance, "would this expense
  exceed the balance" warnings, and org-wide funding/spent/committed/remaining aggregation.
- **`tests/utils.test.ts`** — `@Full Name` mention extraction and overdue-task detection.

`npm run typecheck`, `npm run lint`, and `npm run build` all pass cleanly against this codebase — run them before
committing changes.

---

## Project structure

```
src/
  actions/          Server actions — every mutation (create/update/vote/approve/etc.), each with
                     server-side auth checks, input validation (zod), audit logging, and notifications.
  app/
    login/           Public login page.
    (app)/           Authenticated app shell (sidebar/topbar) + all protected pages:
                      dashboard, tasks, tasks/[id], reviews, ideas, ideas/[id], meetings, meetings/[id],
                      finance, notifications, members, admin, audit-log.
  components/
    ui/               Small, reusable primitives (button, dialog, select, toast, etc.).
    app-shell/         Sidebar, topbar, global search, quick-create, notification bell, user menu.
    domain/            Feature components: task board/list, review panel, comment thread, forms, etc.
  db/
    schema.ts          Full Drizzle schema (25 tables) — the single source of truth for the data model.
    client.ts           Postgres connection (pooled, via `postgres.js` + Drizzle).
  lib/
    authorization.ts     Central role/ownership rules — pure functions, unit tested.
    reviews.ts            Pure review-completion logic — pure functions, unit tested.
    money.ts               Pure financial calculations — pure functions, unit tested.
    crypto.ts                Hashing/tokens.
    session.ts, rate-limit.ts, current-member.ts   Auth/session plumbing.
    audit.ts, notifications.ts, search.ts           Cross-cutting infrastructure.
    task-core.ts                                     Shared task+review creation logic (used by both
                                                       server actions and the seed script).
    queries/               Read-side data access for server components (one file per domain).
drizzle/               Generated SQL migrations.
scripts/               migrate.ts, seed.ts.
tests/                  Vitest unit tests.
```

---

## Feature list

See [FEATURES.md](FEATURES.md) for the complete, checked-off list of implemented functionality mapped to every
requirement in the original spec, plus the final "no incomplete features" verification.

---

## Security notes

- All mutations run through server actions in `src/actions/*`, each of which re-derives the caller's identity from
  the server-side session (never trusts a client-supplied user ID or role) and calls into `src/lib/authorization.ts`.
- Input is validated with `zod` schemas server-side on every action; the UI's client-side validation is a UX
  convenience only.
- Database constraints back up application logic: unique constraints prevent duplicate votes
  (`idea_votes(idea_id, member_id)`) and duplicate reviews (`task_reviews(task_id, member_id)`), foreign keys with
  `onDelete: cascade` where appropriate, and `NOT NULL` on required fields.
- The audit log (`audit_log` table) is insert-only from application code — nothing ever updates or deletes a row in
  it.
- Access codes are never included in any query result sent to the client — member records returned to the UI never
  select `codeHash`.
- `.gitignore` excludes `.env*`, `members.private.json`, `members.private.csv`, and `secrets/`. `members.demo.json`
  is intentionally committed — it only ever contains clearly-fake demo credentials.

---

## Completion checklist

Before calling this done, the following were run against a clean checkout and pass:

- [x] `npm run typecheck` — no errors
- [x] `npm run lint` — no errors
- [x] `npm run test` — all unit tests pass
- [x] `npm run build` — production build succeeds
- [x] Manual sweep for TODO comments, placeholder buttons, and mock-only forms — see [FEATURES.md](FEATURES.md)
