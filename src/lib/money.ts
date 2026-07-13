/**
 * All money is stored and calculated in integer cents to avoid floating
 * point rounding errors. These helpers are the only place cents<->dollars
 * conversion should happen.
 */

export function dollarsToCents(dollars: number | string): number {
  const n = typeof dollars === "string" ? Number(dollars) : dollars;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function formatCents(cents: number | null | undefined): string {
  const value = cents ?? 0;
  return (value / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function sumCents(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

export interface GrantFinancials {
  totalAwardedCents: number;
  amountReceivedCents: number;
  /** Expenses in a "committed" state: approved, purchased, or awaiting approval. */
  committedCents: number;
  /** Expenses that have actually been spent: purchased or reimbursed. */
  spentCents: number;
}

/** Remaining balance = total awarded minus everything spent or committed. */
export function remainingBalanceCents(f: GrantFinancials): number {
  return f.totalAwardedCents - f.spentCents - f.committedCents;
}

export type ExpenseStatusForCommit =
  | "proposed"
  | "awaiting_approval"
  | "approved"
  | "purchased"
  | "reimbursed"
  | "rejected";

/** Expenses in these statuses count against the remaining grant balance. */
export const COMMITTED_EXPENSE_STATUSES: ExpenseStatusForCommit[] = [
  "awaiting_approval",
  "approved",
];

/** Expenses in these statuses count as money already spent. */
export const SPENT_EXPENSE_STATUSES: ExpenseStatusForCommit[] = ["purchased", "reimbursed"];

export function computeGrantFinancials(params: {
  totalAwardedCents: number;
  amountReceivedCents: number;
  expenses: Array<{ amountCents: number; status: ExpenseStatusForCommit }>;
}): GrantFinancials & { remainingCents: number } {
  const committedCents = sumCents(
    params.expenses
      .filter((e) => COMMITTED_EXPENSE_STATUSES.includes(e.status))
      .map((e) => e.amountCents)
  );
  const spentCents = sumCents(
    params.expenses.filter((e) => SPENT_EXPENSE_STATUSES.includes(e.status)).map((e) => e.amountCents)
  );
  const financials: GrantFinancials = {
    totalAwardedCents: params.totalAwardedCents,
    amountReceivedCents: params.amountReceivedCents,
    committedCents,
    spentCents,
  };
  return { ...financials, remainingCents: remainingBalanceCents(financials) };
}

/** Would this proposed expense amount exceed the grant's remaining balance? */
export function wouldExceedRemainingBalance(
  proposedAmountCents: number,
  remainingCents: number
): boolean {
  return proposedAmountCents > remainingCents;
}

export interface OrgFinancialSummary {
  totalGrantFundingCents: number;
  totalSpentCents: number;
  totalCommittedCents: number;
  totalRemainingCents: number;
}

export function computeOrgFinancialSummary(
  grantFinancials: Array<GrantFinancials>
): OrgFinancialSummary {
  const totalGrantFundingCents = sumCents(grantFinancials.map((g) => g.totalAwardedCents));
  const totalSpentCents = sumCents(grantFinancials.map((g) => g.spentCents));
  const totalCommittedCents = sumCents(grantFinancials.map((g) => g.committedCents));
  return {
    totalGrantFundingCents,
    totalSpentCents,
    totalCommittedCents,
    totalRemainingCents: totalGrantFundingCents - totalSpentCents - totalCommittedCents,
  };
}
