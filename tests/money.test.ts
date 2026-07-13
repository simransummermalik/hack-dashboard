import { describe, it, expect } from "vitest";
import {
  dollarsToCents,
  centsToDollars,
  formatCents,
  sumCents,
  computeGrantFinancials,
  remainingBalanceCents,
  wouldExceedRemainingBalance,
  computeOrgFinancialSummary,
} from "@/lib/money";

describe("dollarsToCents / centsToDollars", () => {
  it("converts dollars to integer cents without float drift", () => {
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents("19.99")).toBe(1999);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30); // classic float trap, should still round correctly
  });

  it("converts cents back to dollars", () => {
    expect(centsToDollars(1999)).toBeCloseTo(19.99);
  });

  it("treats invalid input as zero", () => {
    expect(dollarsToCents(NaN)).toBe(0);
  });
});

describe("formatCents", () => {
  it("formats as USD currency", () => {
    expect(formatCents(150000)).toBe("$1,500.00");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(null)).toBe("$0.00");
    expect(formatCents(undefined)).toBe("$0.00");
  });

  it("formats negative balances with a minus sign", () => {
    expect(formatCents(-500)).toBe("-$5.00");
  });
});

describe("sumCents", () => {
  it("sums an array of cent values, ignoring null/undefined", () => {
    expect(sumCents([100, 200, null, undefined, 300])).toBe(600);
    expect(sumCents([])).toBe(0);
  });
});

describe("computeGrantFinancials", () => {
  it("separates committed vs spent expenses and computes remaining balance", () => {
    const result = computeGrantFinancials({
      totalAwardedCents: 100000, // $1000
      amountReceivedCents: 100000,
      expenses: [
        { amountCents: 20000, status: "purchased" }, // spent
        { amountCents: 10000, status: "reimbursed" }, // spent
        { amountCents: 15000, status: "approved" }, // committed
        { amountCents: 5000, status: "awaiting_approval" }, // committed
        { amountCents: 9999, status: "rejected" }, // ignored
        { amountCents: 1000, status: "proposed" }, // ignored (not yet committed)
      ],
    });

    expect(result.spentCents).toBe(30000);
    expect(result.committedCents).toBe(20000);
    expect(result.remainingCents).toBe(100000 - 30000 - 20000);
  });

  it("allows the remaining balance to go negative when overspent", () => {
    const result = computeGrantFinancials({
      totalAwardedCents: 10000,
      amountReceivedCents: 10000,
      expenses: [{ amountCents: 15000, status: "purchased" }],
    });
    expect(result.remainingCents).toBe(-5000);
  });
});

describe("remainingBalanceCents", () => {
  it("subtracts spent and committed from total awarded", () => {
    expect(
      remainingBalanceCents({
        totalAwardedCents: 1000,
        amountReceivedCents: 1000,
        committedCents: 200,
        spentCents: 300,
      })
    ).toBe(500);
  });
});

describe("wouldExceedRemainingBalance", () => {
  it("flags a proposed expense that exceeds remaining balance", () => {
    expect(wouldExceedRemainingBalance(600, 500)).toBe(true);
    expect(wouldExceedRemainingBalance(500, 500)).toBe(false);
    expect(wouldExceedRemainingBalance(400, 500)).toBe(false);
  });
});

describe("computeOrgFinancialSummary", () => {
  it("aggregates totals across multiple grants", () => {
    const summary = computeOrgFinancialSummary([
      { totalAwardedCents: 100000, amountReceivedCents: 100000, committedCents: 10000, spentCents: 20000 },
      { totalAwardedCents: 50000, amountReceivedCents: 50000, committedCents: 5000, spentCents: 5000 },
    ]);

    expect(summary.totalGrantFundingCents).toBe(150000);
    expect(summary.totalSpentCents).toBe(25000);
    expect(summary.totalCommittedCents).toBe(15000);
    expect(summary.totalRemainingCents).toBe(150000 - 25000 - 15000);
  });
});
