/**
 * Pure logic for the mandatory member review workflow. Kept side-effect
 * free so it can be unit tested without a database.
 */

export type ReviewStatus = "pending" | "approved" | "no_concerns" | "changes_requested" | "not_applicable";

export interface ReviewRow {
  memberId: string;
  memberName: string;
  memberActive: boolean;
  status: ReviewStatus;
  comment?: string | null;
}

export interface ReviewSummary {
  total: number;
  completed: number;
  approved: number;
  noConcerns: number;
  changesRequested: number;
  notApplicable: number;
  waiting: number;
  completionPercent: number;
  reviewedNames: string[];
  waitingNames: string[];
  changesRequestedNames: string[];
  /** True when the task can move to Completed without an admin override. */
  canComplete: boolean;
  /** Reasons blocking completion, empty when canComplete is true. */
  blockingReasons: string[];
}

export function summarizeReviews(reviews: ReviewRow[]): ReviewSummary {
  const total = reviews.length;
  const approved = reviews.filter((r) => r.status === "approved").length;
  const noConcerns = reviews.filter((r) => r.status === "no_concerns").length;
  const notApplicable = reviews.filter((r) => r.status === "not_applicable").length;
  const changesRequested = reviews.filter((r) => r.status === "changes_requested").length;
  const completed = reviews.filter((r) => r.status !== "pending").length;

  // A pending review from a now-deactivated member no longer blocks
  // completion, but still counts as "waiting" for display purposes if you
  // want visibility; per spec it should not block, so we separate the two.
  const blockingPending = reviews.filter((r) => r.status === "pending" && r.memberActive);
  const waiting = reviews.filter((r) => r.status === "pending");

  const blockingReasons: string[] = [];
  if (blockingPending.length > 0) {
    blockingReasons.push(
      `${blockingPending.length} active member${blockingPending.length === 1 ? "" : "s"} still need${
        blockingPending.length === 1 ? "s" : ""
      } to review`
    );
  }
  if (changesRequested > 0) {
    blockingReasons.push(
      `${changesRequested} unresolved change request${changesRequested === 1 ? "" : "s"}`
    );
  }

  const completionPercent = total === 0 ? 100 : Math.round((completed / total) * 100);

  return {
    total,
    completed,
    approved,
    noConcerns,
    changesRequested,
    notApplicable,
    waiting: waiting.length,
    completionPercent,
    reviewedNames: reviews.filter((r) => r.status !== "pending").map((r) => r.memberName),
    waitingNames: waiting.map((r) => r.memberName),
    changesRequestedNames: reviews.filter((r) => r.status === "changes_requested").map((r) => r.memberName),
    canComplete: blockingReasons.length === 0,
    blockingReasons,
  };
}

/** Can this member submit/update a review for this task? Members can only review for themselves. */
export function canSubmitReview(params: {
  actingMemberId: string;
  reviewMemberId: string;
}): boolean {
  return params.actingMemberId === params.reviewMemberId;
}
