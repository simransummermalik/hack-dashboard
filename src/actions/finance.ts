"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { expenses, grantLinks, grants, members } from "@/db/schema";
import { requireCurrentMember } from "@/lib/current-member";
import { requireOfficerOrAdmin } from "@/lib/authorization";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { computeGrantFinancials, wouldExceedRemainingBalance, dollarsToCents } from "@/lib/money";
import { GRANT_STATUSES, EXPENSE_STATUSES } from "@/lib/constants";

export interface ActionResult {
  ok: boolean;
  error?: string;
  warning?: string;
}

const grantInputSchema = z.object({
  name: z.string().trim().min(2).max(300),
  fundingOrg: z.string().trim().min(1).max(300),
  totalAwardedDollars: z.number().min(0),
  amountReceivedDollars: z.number().min(0),
  startDate: z.string().nullable(),
  spendingDeadline: z.string().nullable(),
  restrictions: z.string().trim().max(5000).nullable(),
  notes: z.string().trim().max(5000).nullable(),
  status: z.enum(GRANT_STATUSES),
  links: z.array(z.object({ label: z.string().min(1), url: z.string().url() })).default([]),
});

export async function createGrant(input: z.infer<typeof grantInputSchema>): Promise<ActionResult & { grantId?: string }> {
  const actor = await requireCurrentMember();
  requireOfficerOrAdmin(actor);

  const parsed = grantInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid grant." };
  const data = parsed.data;

  const [created] = await db
    .insert(grants)
    .values({
      name: data.name,
      fundingOrg: data.fundingOrg,
      totalAwardedCents: dollarsToCents(data.totalAwardedDollars),
      amountReceivedCents: dollarsToCents(data.amountReceivedDollars),
      startDate: data.startDate,
      spendingDeadline: data.spendingDeadline,
      restrictions: data.restrictions,
      notes: data.notes,
      status: data.status,
      createdBy: actor.id,
    })
    .returning({ id: grants.id });

  if (!created) return { ok: false, error: "Failed to create grant." };

  if (data.links.length > 0) {
    await db.insert(grantLinks).values(
      data.links.map((l) => ({ grantId: created.id, label: l.label, url: l.url, createdBy: actor.id }))
    );
  }

  await recordAudit({
    actorId: actor.id,
    action: "grant_created",
    entityType: "grant",
    entityId: created.id,
    after: { name: data.name, status: data.status },
  });

  revalidatePath("/finance");
  return { ok: true, grantId: created.id };
}

export async function updateGrant(grantId: string, input: z.infer<typeof grantInputSchema>): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireOfficerOrAdmin(actor);

  const [grant] = await db.select().from(grants).where(eq(grants.id, grantId)).limit(1);
  if (!grant) return { ok: false, error: "Grant not found." };

  const parsed = grantInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid grant." };
  const data = parsed.data;

  await db
    .update(grants)
    .set({
      name: data.name,
      fundingOrg: data.fundingOrg,
      totalAwardedCents: dollarsToCents(data.totalAwardedDollars),
      amountReceivedCents: dollarsToCents(data.amountReceivedDollars),
      startDate: data.startDate,
      spendingDeadline: data.spendingDeadline,
      restrictions: data.restrictions,
      notes: data.notes,
      status: data.status,
      updatedAt: new Date(),
    })
    .where(eq(grants.id, grantId));

  await db.delete(grantLinks).where(eq(grantLinks.grantId, grantId));
  if (data.links.length > 0) {
    await db.insert(grantLinks).values(
      data.links.map((l) => ({ grantId, label: l.label, url: l.url, createdBy: actor.id }))
    );
  }

  await recordAudit({
    actorId: actor.id,
    action: "grant_updated",
    entityType: "grant",
    entityId: grantId,
    before: { status: grant.status },
    after: { status: data.status },
  });

  revalidatePath("/finance");
  return { ok: true };
}

const expenseInputSchema = z.object({
  name: z.string().trim().min(2).max(300),
  amountDollars: z.number().positive(),
  expenseDate: z.string().min(1),
  categoryId: z.string().uuid().nullable(),
  grantId: z.string().uuid().nullable(),
  requestedBy: z.string().uuid(),
  status: z.enum(EXPENSE_STATUSES),
  receiptUrl: z.string().url().nullable().or(z.literal("")).optional(),
  notes: z.string().trim().max(5000).nullable(),
});

async function checkGrantBalanceWarning(grantId: string | null, amountCents: number, excludeExpenseId?: string): Promise<string | undefined> {
  if (!grantId) return undefined;
  const [grant] = await db.select().from(grants).where(eq(grants.id, grantId)).limit(1);
  if (!grant) return undefined;
  const grantExpenses = await db.select().from(expenses).where(eq(expenses.grantId, grantId));
  const relevant = grantExpenses.filter((e) => e.id !== excludeExpenseId);
  const financials = computeGrantFinancials({
    totalAwardedCents: grant.totalAwardedCents,
    amountReceivedCents: grant.amountReceivedCents,
    expenses: relevant.map((e) => ({ amountCents: e.amountCents, status: e.status })),
  });
  if (wouldExceedRemainingBalance(amountCents, financials.remainingCents)) {
    return `Warning: this expense exceeds the remaining balance of ${grant.name} by $${(
      (amountCents - financials.remainingCents) /
      100
    ).toFixed(2)}.`;
  }
  if (grant.spendingDeadline) {
    const deadline = new Date(grant.spendingDeadline);
    const daysUntil = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil >= 0 && daysUntil <= 14) {
      return `Note: ${grant.name}'s spending deadline is in ${daysUntil} day${daysUntil === 1 ? "" : "s"}.`;
    }
  }
  if (grant.restrictions) {
    return `Note: ${grant.name} has restrictions on file — verify this expense qualifies: "${grant.restrictions}"`;
  }
  return undefined;
}

export async function createExpense(input: z.infer<typeof expenseInputSchema>): Promise<ActionResult & { expenseId?: string }> {
  const actor = await requireCurrentMember();
  requireOfficerOrAdmin(actor);

  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid expense." };
  const data = parsed.data;
  const amountCents = dollarsToCents(data.amountDollars);

  const warning = await checkGrantBalanceWarning(data.grantId, amountCents);

  const [created] = await db
    .insert(expenses)
    .values({
      name: data.name,
      amountCents,
      expenseDate: data.expenseDate,
      categoryId: data.categoryId,
      grantId: data.grantId,
      requestedBy: data.requestedBy,
      status: data.status,
      receiptUrl: data.receiptUrl || null,
      notes: data.notes,
    })
    .returning({ id: expenses.id });

  if (!created) return { ok: false, error: "Failed to create expense." };

  await recordAudit({
    actorId: actor.id,
    action: "expense_created",
    entityType: "expense",
    entityId: created.id,
    after: { name: data.name, amountCents, status: data.status },
  });

  if (data.status === "awaiting_approval") {
    const approvers = await db
      .select({ id: members.id })
      .from(members)
      .where(inArray(members.role, ["admin", "officer"]));
    await Promise.all(
      approvers
        .filter((a) => a.id !== actor.id)
        .map((a) =>
          notify({
            memberId: a.id,
            type: "expense_awaiting_approval",
            title: "Expense awaiting approval",
            body: `${data.name} — $${data.amountDollars.toFixed(2)}`,
            link: "/finance",
            entityType: "expense",
            entityId: created.id,
          })
        )
    );
  }

  revalidatePath("/finance");
  return { ok: true, expenseId: created.id, warning };
}

export async function updateExpenseStatus(
  expenseId: string,
  status: (typeof EXPENSE_STATUSES)[number],
  reason?: string
): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireOfficerOrAdmin(actor);

  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!expense) return { ok: false, error: "Expense not found." };

  const approvedBy = status === "approved" ? actor.id : status === "rejected" ? null : expense.approvedBy;

  await db
    .update(expenses)
    .set({ status, approvedBy, updatedAt: new Date() })
    .where(eq(expenses.id, expenseId));

  await recordAudit({
    actorId: actor.id,
    action: status === "approved" ? "expense_approved" : status === "rejected" ? "expense_rejected" : "expense_updated",
    entityType: "expense",
    entityId: expenseId,
    before: { status: expense.status },
    after: { status },
    metadata: reason ? { reason } : undefined,
  });

  await notify({
    memberId: expense.requestedBy,
    type: "admin_announcement",
    title: status === "approved" ? "Your expense was approved" : `Expense status: ${status}`,
    body: expense.name,
    link: "/finance",
    entityType: "expense",
    entityId: expenseId,
  });

  revalidatePath("/finance");
  return { ok: true };
}

export async function updateExpense(expenseId: string, input: z.infer<typeof expenseInputSchema>): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireOfficerOrAdmin(actor);

  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!expense) return { ok: false, error: "Expense not found." };

  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid expense." };
  const data = parsed.data;
  const amountCents = dollarsToCents(data.amountDollars);

  const warning = await checkGrantBalanceWarning(data.grantId, amountCents, expenseId);

  await db
    .update(expenses)
    .set({
      name: data.name,
      amountCents,
      expenseDate: data.expenseDate,
      categoryId: data.categoryId,
      grantId: data.grantId,
      requestedBy: data.requestedBy,
      status: data.status,
      receiptUrl: data.receiptUrl || null,
      notes: data.notes,
      updatedAt: new Date(),
    })
    .where(eq(expenses.id, expenseId));

  await recordAudit({
    actorId: actor.id,
    action: "expense_updated",
    entityType: "expense",
    entityId: expenseId,
    before: { amountCents: expense.amountCents, status: expense.status },
    after: { amountCents, status: data.status },
  });

  revalidatePath("/finance");
  return { ok: true, warning };
}
