import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, expenses, grantLinks, grants, members } from "@/db/schema";
import { computeGrantFinancials, computeOrgFinancialSummary, type ExpenseStatusForCommit } from "@/lib/money";

export interface ExpenseRow {
  id: string;
  name: string;
  amountCents: number;
  expenseDate: string;
  categoryName: string | null;
  grantId: string | null;
  grantName: string | null;
  requestedById: string;
  requestedByName: string;
  approvedById: string | null;
  approvedByName: string | null;
  status: ExpenseStatusForCommit;
  receiptUrl: string | null;
  notes: string | null;
}

export interface GrantRow {
  id: string;
  name: string;
  fundingOrg: string;
  totalAwardedCents: number;
  amountReceivedCents: number;
  startDate: string | null;
  spendingDeadline: string | null;
  restrictions: string | null;
  notes: string | null;
  status: string;
  links: Array<{ id: string; label: string; url: string }>;
  expenses: ExpenseRow[];
  committedCents: number;
  spentCents: number;
  remainingCents: number;
}

export async function listExpenses(): Promise<ExpenseRow[]> {
  const rows = await db
    .select({
      id: expenses.id,
      name: expenses.name,
      amountCents: expenses.amountCents,
      expenseDate: expenses.expenseDate,
      categoryName: categories.name,
      grantId: expenses.grantId,
      grantName: grants.name,
      requestedById: expenses.requestedBy,
      status: expenses.status,
      receiptUrl: expenses.receiptUrl,
      notes: expenses.notes,
      approvedById: expenses.approvedBy,
    })
    .from(expenses)
    .leftJoin(categories, eq(expenses.categoryId, categories.id))
    .leftJoin(grants, eq(expenses.grantId, grants.id))
    .orderBy(desc(expenses.expenseDate));

  const memberRows = await db.select({ id: members.id, fullName: members.fullName }).from(members);
  const nameById = new Map(memberRows.map((m) => [m.id, m.fullName]));

  return rows.map((r) => ({
    ...r,
    requestedByName: nameById.get(r.requestedById) ?? "Unknown",
    approvedByName: r.approvedById ? nameById.get(r.approvedById) ?? "Unknown" : null,
  }));
}

export async function listGrants(preloadedExpenses?: ExpenseRow[]): Promise<GrantRow[]> {
  // Sequential — see src/lib/queries/dashboard.ts for why.
  const grantRows = await db.select().from(grants).orderBy(desc(grants.createdAt));
  const allExpenses = preloadedExpenses ?? (await listExpenses());
  const allLinks = await db.select().from(grantLinks);

  return grantRows.map((g) => {
    const grantExpenses = allExpenses.filter((e) => e.grantId === g.id);
    const financials = computeGrantFinancials({
      totalAwardedCents: g.totalAwardedCents,
      amountReceivedCents: g.amountReceivedCents,
      expenses: grantExpenses.map((e) => ({ amountCents: e.amountCents, status: e.status })),
    });
    return {
      id: g.id,
      name: g.name,
      fundingOrg: g.fundingOrg,
      totalAwardedCents: g.totalAwardedCents,
      amountReceivedCents: g.amountReceivedCents,
      startDate: g.startDate,
      spendingDeadline: g.spendingDeadline,
      restrictions: g.restrictions,
      notes: g.notes,
      status: g.status,
      links: allLinks.filter((l) => l.grantId === g.id).map((l) => ({ id: l.id, label: l.label, url: l.url })),
      expenses: grantExpenses,
      committedCents: financials.committedCents,
      spentCents: financials.spentCents,
      remainingCents: financials.remainingCents,
    };
  });
}

export async function getFinanceSummary() {
  const allExpenses = await listExpenses();
  const grantRows = await listGrants(allExpenses);
  const summary = computeOrgFinancialSummary(
    grantRows.map((g) => ({
      totalAwardedCents: g.totalAwardedCents,
      amountReceivedCents: g.amountReceivedCents,
      committedCents: g.committedCents,
      spentCents: g.spentCents,
    }))
  );

  const spendingByCategory = new Map<string, number>();
  for (const e of allExpenses) {
    const key = e.categoryName ?? "Uncategorized";
    spendingByCategory.set(key, (spendingByCategory.get(key) ?? 0) + e.amountCents);
  }

  const today = new Date();
  const in30Days = new Date();
  in30Days.setDate(today.getDate() + 30);

  const upcomingExpenses = allExpenses.filter((e) => {
    const d = new Date(e.expenseDate);
    return d >= today && d <= in30Days && e.status !== "rejected";
  });

  const grantsApproachingDeadline = grantRows.filter((g) => {
    if (!g.spendingDeadline) return false;
    const d = new Date(g.spendingDeadline);
    return d >= today && d <= in30Days && (g.status === "active" || g.status === "awarded");
  });

  return {
    summary,
    grants: grantRows,
    expenses: allExpenses,
    spendingByCategory: Array.from(spendingByCategory.entries()).map(([category, cents]) => ({ category, cents })),
    upcomingExpenses,
    grantsApproachingDeadline,
  };
}
