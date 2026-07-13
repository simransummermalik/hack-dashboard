"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, BellRing, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReviewProgress } from "@/components/domain/review-progress";
import { ReviewStatusBadge } from "@/components/domain/status-badge";
import { MemberAvatar } from "@/components/domain/member-avatar";
import { useToast } from "@/components/ui/use-toast";
import { submitReview, remindMissingReviewers, addManualReviewerAction } from "@/actions/tasks";
import { REVIEW_STATUS_LABELS } from "@/lib/constants";
import type { ReviewRow, ReviewSummary } from "@/lib/reviews";
import type { MemberSummary } from "@/lib/queries/members";

const REVIEW_OPTIONS = ["approved", "no_concerns", "changes_requested", "not_applicable"] as const;

export function TaskReviewPanel({
  taskId,
  reviews,
  summary,
  currentMemberId,
  isAdmin,
  allMembers,
}: {
  taskId: string;
  reviews: ReviewRow[];
  summary: ReviewSummary;
  currentMemberId: string;
  isAdmin: boolean;
  allMembers: MemberSummary[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const myReview = reviews.find((r) => r.memberId === currentMemberId);
  const [reviewStatus, setReviewStatus] = useState<(typeof REVIEW_OPTIONS)[number]>(
    (myReview && myReview.status !== "pending" ? myReview.status : "approved") as (typeof REVIEW_OPTIONS)[number]
  );
  const [comment, setComment] = useState(myReview?.comment ?? "");
  const [addReviewerId, setAddReviewerId] = useState("");

  function submit() {
    startTransition(async () => {
      const result = await submitReview(taskId, { status: reviewStatus, comment: comment || undefined });
      if (result.ok) {
        toast({ title: "Review submitted" });
        router.refresh();
      } else {
        toast({ title: "Couldn't submit review", description: result.error, variant: "destructive" });
      }
    });
  }

  function remind() {
    startTransition(async () => {
      const result = await remindMissingReviewers(taskId);
      if (result.ok) {
        toast({ title: `Reminded ${result.remindedCount ?? 0} member(s)` });
      } else {
        toast({ title: "Couldn't send reminders", description: result.error, variant: "destructive" });
      }
    });
  }

  function addReviewer() {
    if (!addReviewerId) return;
    startTransition(async () => {
      const result = await addManualReviewerAction(taskId, addReviewerId);
      if (result.ok) {
        toast({ title: "Reviewer added" });
        setAddReviewerId("");
        router.refresh();
      } else {
        toast({ title: "Couldn't add reviewer", description: result.error, variant: "destructive" });
      }
    });
  }

  const reviewedRows = reviews.filter((r) => r.status !== "pending");
  const waitingRows = reviews.filter((r) => r.status === "pending");
  const reviewerIds = new Set(reviews.map((r) => r.memberId));
  const addableMembers = allMembers.filter((m) => !reviewerIds.has(m.id));

  return (
    <div className="space-y-5">
      <ReviewProgress summary={summary} />

      {myReview && (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Your review</p>
          <Select value={reviewStatus} onValueChange={(v) => setReviewStatus(v as typeof reviewStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVIEW_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {REVIEW_STATUS_LABELS[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          <Button size="sm" onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {myReview.status === "pending" ? "Submit review" : "Update review"}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={remind} disabled={isPending || waitingRows.length === 0}>
          <BellRing className="h-4 w-4" /> Remind missing reviewers ({waitingRows.length})
        </Button>
      </div>

      {isAdmin && addableMembers.length > 0 && (
        <div className="flex gap-2">
          <Select value={addReviewerId} onValueChange={setAddReviewerId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Add a reviewer manually" />
            </SelectTrigger>
            <SelectContent>
              {addableMembers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={addReviewer} disabled={!addReviewerId || isPending}>
            <UserPlus className="h-4 w-4" /> Add
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reviewed ({reviewedRows.length})
          </p>
          <ul className="space-y-2">
            {reviewedRows.map((r) => (
              <li key={r.memberId} className="flex items-start gap-2 text-sm">
                <MemberAvatar fullName={r.memberName} size="sm" showTooltip={false} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.memberName}</span>
                    {!r.memberActive && <span className="text-xs text-muted-foreground">(inactive)</span>}
                  </div>
                  <ReviewStatusBadge status={r.status} className="mt-0.5" />
                  {r.comment && <p className="mt-1 text-xs text-muted-foreground">{r.comment}</p>}
                </div>
              </li>
            ))}
            {reviewedRows.length === 0 && <p className="text-sm text-muted-foreground">No reviews submitted yet.</p>}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Waiting ({waitingRows.length})
          </p>
          <ul className="space-y-2">
            {waitingRows.map((r) => (
              <li key={r.memberId} className="flex items-center gap-2 text-sm">
                <MemberAvatar fullName={r.memberName} size="sm" showTooltip={false} />
                <span>{r.memberName}</span>
                {!r.memberActive && <span className="text-xs text-muted-foreground">(inactive — not blocking)</span>}
              </li>
            ))}
            {waitingRows.length === 0 && <p className="text-sm text-muted-foreground">Nobody is waiting.</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}
