/**
 * Idempotent seed script.
 *
 * - Always seeds default categories, review-exemption reasons, and org
 *   settings (skipped if already present).
 * - Loads members from the private, gitignored roster at MEMBERS_SEED_FILE
 *   (default: members.private.json). Missing file => warning, not a
 *   failure, so a demo-only setup still works.
 * - Upserts members by normalized full name, so re-running after editing
 *   the roster file updates roles/active-status/codes without touching
 *   application code.
 * - If LOAD_DEMO_DATA=true, also loads members.demo.json (committed, fake
 *   data) and — on a fresh database only — creates sample tasks, ideas,
 *   meetings, grants, expenses, and notifications so the app can be
 *   evaluated immediately.
 *
 * Run with: npm run db:seed
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { eq, inArray, and } from "drizzle-orm";
import { db } from "../src/db/client";
import {
  members,
  categories,
  reviewExemptionReasons,
  orgSettings,
  taskReviews,
  ideas,
  ideaVotes,
  meetings,
  meetingAttendees,
  meetingDecisions,
  meetingActionItems,
  grants,
  expenses,
  notifications,
} from "../src/db/schema";
import { hashAccessCode, normalizeName, isValidAccessCodeFormat } from "../src/lib/crypto";
import {
  DEFAULT_TASK_CATEGORIES,
  DEFAULT_IDEA_CATEGORIES,
  DEFAULT_FINANCE_CATEGORIES,
} from "../src/lib/constants";
import { createTaskRecord } from "../src/lib/task-core";

const memberSeedSchema = z.array(
  z.object({
    fullName: z.string().min(1),
    code: z.string().regex(/^\d{4}$/, "code must be exactly 4 digits"),
    role: z.enum(["admin", "officer", "member"]),
    active: z.boolean(),
  })
);

async function loadMemberFile(filePath: string): Promise<z.infer<typeof memberSeedSchema> | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const json = JSON.parse(raw);
    return memberSeedSchema.parse(json);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

async function upsertMembers(
  entries: z.infer<typeof memberSeedSchema>,
  isDemo: boolean
): Promise<Map<string, string>> {
  const idByName = new Map<string, string>();
  for (const entry of entries) {
    if (!isValidAccessCodeFormat(entry.code)) {
      throw new Error(`Invalid access code for ${entry.fullName}: must be exactly 4 digits`);
    }
    const normalized = normalizeName(entry.fullName);
    const codeHash = await hashAccessCode(entry.code);

    const existing = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.normalizedName, normalized))
      .limit(1);

    if (existing[0]) {
      await db
        .update(members)
        .set({
          fullName: entry.fullName,
          codeHash,
          role: entry.role,
          active: entry.active,
          isDemo,
          updatedAt: new Date(),
        })
        .where(eq(members.id, existing[0].id));
      idByName.set(entry.fullName, existing[0].id);
    } else {
      const [inserted] = await db
        .insert(members)
        .values({
          fullName: entry.fullName,
          normalizedName: normalized,
          codeHash,
          role: entry.role,
          active: entry.active,
          isDemo,
        })
        .returning({ id: members.id });
      if (inserted) idByName.set(entry.fullName, inserted.id);
    }
  }
  return idByName;
}

async function seedCategories() {
  for (const name of DEFAULT_TASK_CATEGORIES) {
    await db.insert(categories).values({ kind: "task", name }).onConflictDoNothing();
  }
  for (const name of DEFAULT_IDEA_CATEGORIES) {
    await db.insert(categories).values({ kind: "idea", name }).onConflictDoNothing();
  }
  for (const name of DEFAULT_FINANCE_CATEGORIES) {
    await db.insert(categories).values({ kind: "finance", name }).onConflictDoNothing();
  }
  console.log("Categories seeded.");
}

async function seedReviewExemptionReasons() {
  const existing = await db.select({ id: reviewExemptionReasons.id }).from(reviewExemptionReasons).limit(1);
  if (existing.length > 0) return;
  await db.insert(reviewExemptionReasons).values([
    { label: "Routine administrative task — no group review needed" },
    { label: "Duplicate or consolidated with an already-reviewed task" },
    { label: "Time-sensitive — will be reviewed retroactively" },
  ]);
  console.log("Review exemption reasons seeded.");
}

async function seedOrgSettings() {
  const existing = await db.select({ key: orgSettings.key }).from(orgSettings).where(eq(orgSettings.key, "org_name"));
  if (existing.length === 0) {
    await db.insert(orgSettings).values({ key: "org_name", value: "HAVK" });
  }
  const rules = await db.select({ key: orgSettings.key }).from(orgSettings).where(eq(orgSettings.key, "review_rules"));
  if (rules.length === 0) {
    await db.insert(orgSettings).values({
      key: "review_rules",
      value: { requireAllActiveMembers: true, blockCompletionOnChangesRequested: true },
    });
  }
  console.log("Org settings seeded.");
}

async function categoryId(kind: "task" | "idea" | "finance", name: string): Promise<string> {
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.kind, kind), eq(categories.name, name)))
    .limit(1);
  if (!rows[0]) throw new Error(`Missing category ${kind}/${name}`);
  return rows[0].id;
}

async function demoDataAlreadySeeded(): Promise<boolean> {
  const demoMembers = await db.select({ id: members.id }).from(members).where(eq(members.isDemo, true));
  if (demoMembers.length === 0) return false;
  const demoIds = demoMembers.map((m) => m.id);
  const existingIdeas = await db.select({ id: ideas.id }).from(ideas).where(inArray(ideas.submittedBy, demoIds)).limit(1);
  return existingIdeas.length > 0;
}

async function seedDemoContent(demoIds: Map<string, string>) {
  if (await demoDataAlreadySeeded()) {
    console.log("Demo content already present — skipping.");
    return;
  }

  const admin = demoIds.get("Demo Admin")!;
  const officer1 = demoIds.get("Demo Officer Alex Rivera")!;
  const officer2 = demoIds.get("Demo Officer Jamie Chen")!;
  const memberA = demoIds.get("Demo Member Priya Patel")!;
  const memberB = demoIds.get("Demo Member Sam Osei")!;
  const memberC = demoIds.get("Demo Member Taylor Novak")!;
  const memberD = demoIds.get("Demo Member Morgan Lee")!;
  const memberE = demoIds.get("Demo Member Casey Kim")!;

  const [eventCat, techCat, marketingCat, financeCat, adminCat] = await Promise.all([
    categoryId("task", "Event Planning"),
    categoryId("task", "Technology"),
    categoryId("task", "Marketing"),
    categoryId("task", "Finance"),
    categoryId("task", "Club Administration"),
  ]);

  // --- Tasks --------------------------------------------------------------
  const today = new Date();
  const inDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const task1 = await createTaskRecord({
    title: "Book venue for Fall Kickoff Hackathon",
    description: "Reserve the engineering atrium for the Fall Kickoff Hackathon, confirm capacity and AV needs.",
    creatorId: officer1,
    categoryId: eventCat,
    priority: "high",
    status: "in_progress",
    dueDate: inDays(10),
    assigneeIds: [officer1, memberA],
    links: [{ label: "Venue request form", url: "https://example.edu/venue-request" }],
    reviewExempt: false,
    reviewExemptReasonId: null,
  });

  const task2 = await createTaskRecord({
    title: "Design sponsor prospectus deck",
    description: "Create a one-pager and full deck for sponsor outreach, including past event stats and tiers.",
    creatorId: memberB,
    categoryId: marketingCat,
    priority: "medium",
    status: "ready_for_review",
    dueDate: inDays(3),
    assigneeIds: [memberB],
    links: [],
    reviewExempt: false,
    reviewExemptReasonId: null,
  });

  const task3 = await createTaskRecord({
    title: "Migrate judging platform to new provider",
    description: "Evaluate and migrate off the current judging software before the spring hackathon.",
    creatorId: officer2,
    categoryId: techCat,
    priority: "urgent",
    status: "blocked",
    dueDate: inDays(-2),
    assigneeIds: [officer2, memberC],
    links: [{ label: "Vendor comparison sheet", url: "https://example.edu/judging-vendors" }],
    reviewExempt: false,
    reviewExemptReasonId: null,
  });

  const task4 = await createTaskRecord({
    title: "Reconcile Q3 club spending report",
    description: "Pull all approved expenses for Q3 and reconcile against grant ledgers.",
    creatorId: admin,
    categoryId: financeCat,
    priority: "medium",
    status: "completed",
    dueDate: inDays(-15),
    assigneeIds: [admin],
    links: [],
    reviewExempt: false,
    reviewExemptReasonId: null,
  });

  const task5 = await createTaskRecord({
    title: "Order HAVK branded stickers",
    description: "Small routine purchase for outreach table giveaways.",
    creatorId: memberD,
    categoryId: adminCat,
    priority: "low",
    status: "backlog",
    dueDate: null,
    assigneeIds: [memberD],
    links: [],
    reviewExempt: false,
    reviewExemptReasonId: null,
  });

  const task6 = await createTaskRecord({
    title: "Recruit outreach volunteers for open house",
    description: "Find 5 members to table at the CS department open house.",
    creatorId: memberE,
    categoryId: adminCat,
    priority: "medium",
    status: "planned",
    dueDate: inDays(20),
    assigneeIds: [memberE, memberA],
    links: [],
    reviewExempt: false,
    reviewExemptReasonId: null,
  });

  // Simulate a fully-approved review set for the completed task.
  await db
    .update(taskReviews)
    .set({ status: "approved", reviewedAt: new Date() })
    .where(eq(taskReviews.taskId, task4.taskId));

  // Simulate a mostly-reviewed task with one change request (task2, ready for review).
  const t2Reviews = await db.select().from(taskReviews).where(eq(taskReviews.taskId, task2.taskId));
  for (const r of t2Reviews) {
    if (r.memberId === officer1) {
      await db
        .update(taskReviews)
        .set({ status: "changes_requested", comment: "Please add pricing tiers before we send this out.", reviewedAt: new Date() })
        .where(eq(taskReviews.id, r.id));
    } else if (r.memberId !== memberB) {
      await db
        .update(taskReviews)
        .set({ status: "no_concerns", reviewedAt: new Date() })
        .where(eq(taskReviews.id, r.id));
    }
  }

  // Partially review task1 and task3 so "Needs My Review" has content.
  const t1Reviews = await db.select().from(taskReviews).where(eq(taskReviews.taskId, task1.taskId));
  for (const r of t1Reviews.slice(0, Math.ceil(t1Reviews.length / 2))) {
    await db
      .update(taskReviews)
      .set({ status: "approved", reviewedAt: new Date() })
      .where(eq(taskReviews.id, r.id));
  }

  console.log("Demo tasks seeded.");

  // --- Ideas ----------------------------------------------------------------
  const partnershipCat = await categoryId("idea", "Partnership");
  const eventIdeaCat = await categoryId("idea", "Event");
  const techIdeaCat = await categoryId("idea", "Technology");

  const [idea1] = await db
    .insert(ideas)
    .values({
      title: "Launch a beginner-friendly weekend workshop series",
      description: "Monthly Saturday workshops teaching git, web basics, and hackathon prep for new members.",
      submittedBy: memberA,
      categoryId: eventIdeaCat,
      estimatedCostCents: 15000,
      estimatedEffort: "Medium — 4 hours prep per session",
      proposedTimeline: "Start next semester, one Saturday per month",
      benefits: "Lowers the barrier to entry for new members and builds a pipeline of hackathon participants.",
      risks: "Requires consistent volunteer instructors.",
      status: "discussing",
    })
    .returning({ id: ideas.id });

  const [idea2] = await db
    .insert(ideas)
    .values({
      title: "Partner with local coworking space for sponsor mixers",
      description: "Host a quarterly mixer with sponsors and alumni at a nearby coworking space.",
      submittedBy: officer1,
      categoryId: partnershipCat,
      estimatedCostCents: 40000,
      estimatedEffort: "High — needs sponsor coordination",
      proposedTimeline: "Q1 next year",
      benefits: "Deepens sponsor relationships beyond the annual hackathon.",
      risks: "Venue cost and scheduling conflicts with sponsors.",
      status: "needs_research",
    })
    .returning({ id: ideas.id });

  const [idea3] = await db
    .insert(ideas)
    .values({
      title: "Build an internal Discord bot for meeting reminders",
      description: "A lightweight bot that posts meeting reminders and RSVP buttons to our Discord.",
      submittedBy: memberC,
      categoryId: techIdeaCat,
      estimatedCostCents: 0,
      estimatedEffort: "Low — weekend project",
      proposedTimeline: "Whenever a volunteer picks it up",
      benefits: "Reduces missed meetings.",
      risks: "None significant.",
      status: "approved",
    })
    .returning({ id: ideas.id });

  const [idea4] = await db
    .insert(ideas)
    .values({
      title: "Order custom HAVK hoodies for officers",
      description: "One-time officer swag order.",
      submittedBy: memberD,
      categoryId: eventIdeaCat,
      estimatedCostCents: 60000,
      estimatedEffort: "Low",
      proposedTimeline: "Before spring hackathon",
      benefits: "Team morale and visibility at events.",
      risks: "Cost is high relative to budget.",
      status: "new",
    })
    .returning({ id: ideas.id });

  if (idea1 && idea2 && idea3 && idea4) {
    await db.insert(ideaVotes).values([
      { ideaId: idea1.id, memberId: memberA },
      { ideaId: idea1.id, memberId: memberB },
      { ideaId: idea1.id, memberId: memberC },
      { ideaId: idea1.id, memberId: officer1 },
      { ideaId: idea2.id, memberId: officer1 },
      { ideaId: idea2.id, memberId: officer2 },
      { ideaId: idea3.id, memberId: memberC },
      { ideaId: idea3.id, memberId: memberD },
      { ideaId: idea3.id, memberId: memberE },
      { ideaId: idea3.id, memberId: admin },
    ]);
  }
  console.log("Demo ideas seeded.");

  // --- Meetings ---------------------------------------------------------------
  const pastDate = new Date(today);
  pastDate.setDate(pastDate.getDate() - 7);
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + 5);

  const [pastMeeting] = await db
    .insert(meetings)
    .values({
      title: "Weekly Officer Sync",
      meetingDate: pastDate.toISOString().slice(0, 10),
      startTime: "18:00",
      endTime: "19:00",
      location: "Student Union Room 204",
      organizerId: officer1,
      agenda: "1. Hackathon venue update\n2. Sponsor outreach status\n3. Budget check-in",
      notes: "Venue is confirmed pending AV walkthrough. Sponsor deck needs pricing tiers.",
    })
    .returning({ id: meetings.id });

  const [upcomingMeeting] = await db
    .insert(meetings)
    .values({
      title: "General Body Meeting",
      meetingDate: futureDate.toISOString().slice(0, 10),
      startTime: "19:00",
      endTime: "20:00",
      location: "https://meet.example.edu/havk-gbm",
      organizerId: admin,
      agenda: "1. Hackathon planning update\n2. New member Q&A\n3. Open floor",
      notes: "",
    })
    .returning({ id: meetings.id });

  if (pastMeeting) {
    await db.insert(meetingAttendees).values([
      { meetingId: pastMeeting.id, memberId: officer1, status: "attending", respondedAt: new Date() },
      { meetingId: pastMeeting.id, memberId: officer2, status: "attending", respondedAt: new Date() },
      { meetingId: pastMeeting.id, memberId: admin, status: "attending", respondedAt: new Date() },
      { meetingId: pastMeeting.id, memberId: memberA, status: "maybe", respondedAt: new Date() },
    ]);
    await db.insert(meetingDecisions).values([
      { meetingId: pastMeeting.id, description: "Approved venue booking for Fall Kickoff Hackathon.", createdBy: officer1 },
    ]);
    await db.insert(meetingActionItems).values([
      { meetingId: pastMeeting.id, description: "Add pricing tiers to sponsor deck", ownerId: memberB, dueDate: inDays(3) },
      { meetingId: pastMeeting.id, description: "Confirm AV walkthrough time with venue", ownerId: officer1, dueDate: inDays(5) },
    ]);
  }

  if (upcomingMeeting) {
    await db.insert(meetingAttendees).values([
      { meetingId: upcomingMeeting.id, memberId: admin, status: "attending", respondedAt: new Date() },
      { meetingId: upcomingMeeting.id, memberId: officer1, status: "attending", respondedAt: new Date() },
      { meetingId: upcomingMeeting.id, memberId: memberA, status: "no_response" },
      { meetingId: upcomingMeeting.id, memberId: memberB, status: "no_response" },
    ]);
  }
  console.log("Demo meetings seeded.");

  // --- Grants & expenses --------------------------------------------------
  const equipmentCat = await categoryId("finance", "Equipment");
  const eventsFinCat = await categoryId("finance", "Events");
  const softwareCat = await categoryId("finance", "Software/Subscriptions");

  const deadlineSoon = new Date(today);
  deadlineSoon.setDate(deadlineSoon.getDate() + 25);
  const deadlineFar = new Date(today);
  deadlineFar.setFullYear(deadlineFar.getFullYear() + 1);

  const [grant1] = await db
    .insert(grants)
    .values({
      name: "University Student Org Innovation Grant",
      fundingOrg: "Office of Student Life",
      totalAwardedCents: 500000,
      amountReceivedCents: 500000,
      startDate: inDays(-90),
      spendingDeadline: deadlineSoon.toISOString().slice(0, 10),
      restrictions: "Must be spent on student programming, not officer swag.",
      notes: "Renewable annually if 80% is spent on qualifying events.",
      status: "active",
      createdBy: admin,
    })
    .returning({ id: grants.id });

  const [grant2] = await db
    .insert(grants)
    .values({
      name: "TechCorp Community Sponsorship",
      fundingOrg: "TechCorp Foundation",
      totalAwardedCents: 250000,
      amountReceivedCents: 250000,
      startDate: inDays(-400),
      spendingDeadline: inDays(-30),
      restrictions: "None",
      notes: "Fully spent, closed out last semester.",
      status: "closed",
      createdBy: admin,
    })
    .returning({ id: grants.id });

  if (grant1 && grant2) {
    await db.insert(expenses).values([
      {
        name: "Hackathon catering deposit",
        amountCents: 80000,
        expenseDate: inDays(-10),
        categoryId: eventsFinCat,
        grantId: grant1.id,
        requestedBy: officer1,
        approvedBy: admin,
        status: "purchased",
        receiptUrl: "https://example.edu/receipts/catering-deposit",
        notes: "50% deposit for Fall Kickoff Hackathon catering.",
      },
      {
        name: "3D printer filament restock",
        amountCents: 12000,
        expenseDate: inDays(-5),
        categoryId: equipmentCat,
        grantId: grant1.id,
        requestedBy: memberC,
        approvedBy: officer2,
        status: "reimbursed",
        receiptUrl: "https://example.edu/receipts/filament",
        notes: "",
      },
      {
        name: "Judging platform annual license",
        amountCents: 45000,
        expenseDate: inDays(2),
        categoryId: softwareCat,
        grantId: grant1.id,
        requestedBy: officer2,
        approvedBy: null,
        status: "awaiting_approval",
        receiptUrl: null,
        notes: "New vendor after migration from legacy judging tool.",
      },
      {
        name: "Sponsor mixer venue rental (proposed)",
        amountCents: 350000,
        expenseDate: inDays(30),
        categoryId: eventsFinCat,
        grantId: grant1.id,
        requestedBy: officer1,
        approvedBy: null,
        status: "proposed",
        receiptUrl: null,
        notes: "Pending idea approval for sponsor mixer.",
      },
      {
        name: "Banner printing",
        amountCents: 9000,
        expenseDate: inDays(-200),
        categoryId: eventsFinCat,
        grantId: grant2.id,
        requestedBy: memberD,
        approvedBy: admin,
        status: "reimbursed",
        receiptUrl: "https://example.edu/receipts/banner",
        notes: "",
      },
    ]);
  }
  console.log("Demo grants and expenses seeded.");

  // --- Notifications for Demo Admin ---------------------------------------
  await db.insert(notifications).values([
    {
      memberId: admin,
      type: "review_requested",
      title: "New task needs your review",
      body: `"${task3.taskId ? "Migrate judging platform to new provider" : "A task"}" is waiting on your review.`,
      link: `/tasks/${task3.taskId}`,
      entityType: "task",
      entityId: task3.taskId,
    },
    {
      memberId: admin,
      type: "expense_awaiting_approval",
      title: "Expense awaiting your approval",
      body: "Judging platform annual license ($450.00) needs approval.",
      link: "/finance",
      entityType: "expense",
      entityId: null,
    },
    {
      memberId: admin,
      type: "grant_deadline",
      title: "Grant deadline approaching",
      body: "University Student Org Innovation Grant spending deadline is in 25 days.",
      link: "/finance",
      entityType: "grant",
      entityId: grant1?.id ?? null,
    },
  ]);
  console.log("Demo notifications seeded.");
}

async function main() {
  console.log("Seeding HAVK database...\n");

  await seedCategories();
  await seedReviewExemptionReasons();
  await seedOrgSettings();

  const seedFilePath = path.resolve(process.cwd(), process.env.MEMBERS_SEED_FILE || "members.private.json");
  const privateEntries = await loadMemberFile(seedFilePath);

  if (privateEntries) {
    await upsertMembers(privateEntries, false);
    console.log(`Seeded ${privateEntries.length} member(s) from ${seedFilePath}.`);
  } else {
    console.warn(
      `\n[warning] No private member file found at ${seedFilePath}.\n` +
        `  Copy members.private.json.example to members.private.json (it is gitignored)\n` +
        `  and fill in real member names + 4-digit codes, then re-run "npm run db:seed".\n`
    );
  }

  const loadDemo = (process.env.LOAD_DEMO_DATA || "false").toLowerCase() === "true";
  if (loadDemo) {
    const demoPath = path.resolve(process.cwd(), "members.demo.json");
    const demoEntries = await loadMemberFile(demoPath);
    if (demoEntries) {
      const demoIds = await upsertMembers(demoEntries, true);
      console.log(`Seeded ${demoEntries.length} demo member(s).`);
      await seedDemoContent(demoIds);
    }
  }

  console.log("\nSeed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
