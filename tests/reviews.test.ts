import { describe, it, expect } from "vitest";
import { summarizeReviews, canSubmitReview, type ReviewRow } from "@/lib/reviews";

function row(overrides: Partial<ReviewRow>): ReviewRow {
  return {
    memberId: "m1",
    memberName: "Member One",
    memberActive: true,
    status: "pending",
    comment: null,
    ...overrides,
  };
}

describe("summarizeReviews", () => {
  it("reports 100% complete and no blocking reasons when there are no required reviewers", () => {
    const summary = summarizeReviews([]);
    expect(summary.total).toBe(0);
    expect(summary.completionPercent).toBe(100);
    expect(summary.canComplete).toBe(true);
    expect(summary.blockingReasons).toHaveLength(0);
  });

  it("matches the example from the spec: 7 of 10 complete, 5 approved, 2 no concerns, 3 waiting", () => {
    const reviews: ReviewRow[] = [
      ...Array.from({ length: 5 }, (_, i) => row({ memberId: `a${i}`, status: "approved" })),
      ...Array.from({ length: 2 }, (_, i) => row({ memberId: `n${i}`, status: "no_concerns" })),
      ...Array.from({ length: 3 }, (_, i) => row({ memberId: `w${i}`, status: "pending" })),
    ];
    const summary = summarizeReviews(reviews);

    expect(summary.total).toBe(10);
    expect(summary.completed).toBe(7);
    expect(summary.approved).toBe(5);
    expect(summary.noConcerns).toBe(2);
    expect(summary.changesRequested).toBe(0);
    expect(summary.waiting).toBe(3);
    expect(summary.completionPercent).toBe(70);
    expect(summary.canComplete).toBe(false);
  });

  it("blocks completion while any active member's review is pending", () => {
    const summary = summarizeReviews([row({ status: "pending", memberActive: true })]);
    expect(summary.canComplete).toBe(false);
    expect(summary.blockingReasons.join(" ")).toMatch(/still need/);
  });

  it("does not let a pending review from a deactivated member block completion", () => {
    const summary = summarizeReviews([
      row({ memberId: "m1", status: "approved", memberActive: true }),
      row({ memberId: "m2", status: "pending", memberActive: false }),
    ]);
    expect(summary.canComplete).toBe(true);
    expect(summary.waiting).toBe(1); // still visible for historical purposes
  });

  it("keeps a deactivated member's historical (non-pending) review visible and counted", () => {
    const summary = summarizeReviews([
      row({ memberId: "m1", status: "approved", memberActive: false }),
      row({ memberId: "m2", status: "approved", memberActive: true }),
    ]);
    expect(summary.completed).toBe(2);
    expect(summary.reviewedNames).toHaveLength(2);
  });

  it("blocks completion on any unresolved changes-requested review, even after all others finish", () => {
    const summary = summarizeReviews([
      row({ memberId: "m1", status: "approved" }),
      row({ memberId: "m2", status: "changes_requested" }),
    ]);
    expect(summary.canComplete).toBe(false);
    expect(summary.blockingReasons.join(" ")).toMatch(/unresolved change request/);
  });

  it("treats not_applicable as a completed review", () => {
    const summary = summarizeReviews([row({ status: "not_applicable" })]);
    expect(summary.completed).toBe(1);
    expect(summary.canComplete).toBe(true);
  });
});

describe("canSubmitReview", () => {
  it("only allows a member to submit their own review", () => {
    expect(canSubmitReview({ actingMemberId: "m1", reviewMemberId: "m1" })).toBe(true);
    expect(canSubmitReview({ actingMemberId: "m1", reviewMemberId: "m2" })).toBe(false);
  });
});
