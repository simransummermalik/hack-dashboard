import { Progress } from "@/components/ui/progress";
import type { ReviewSummary } from "@/lib/reviews";
import { cn } from "@/lib/utils";

export function ReviewProgress({ summary, compact = false }: { summary: ReviewSummary; compact?: boolean }) {
  if (summary.total === 0) {
    return <p className="text-sm text-muted-foreground">No review is required for this task.</p>;
  }

  return (
    <div className={cn("space-y-2", compact && "space-y-1")}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          Reviews: {summary.completed} of {summary.total} complete
        </span>
        <span className="text-muted-foreground">{summary.completionPercent}%</span>
      </div>
      <Progress
        value={summary.completionPercent}
        indicatorClassName={summary.changesRequested > 0 ? "bg-destructive" : undefined}
      />
      {!compact && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
          <div className="flex justify-between sm:block">
            <dt className="inline sm:block">Approved</dt>
            <dd className="inline font-medium text-foreground sm:block">{summary.approved}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="inline sm:block">No concerns</dt>
            <dd className="inline font-medium text-foreground sm:block">{summary.noConcerns}</dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="inline sm:block">Changes requested</dt>
            <dd className={cn("inline font-medium sm:block", summary.changesRequested > 0 ? "text-destructive" : "text-foreground")}>
              {summary.changesRequested}
            </dd>
          </div>
          <div className="flex justify-between sm:block">
            <dt className="inline sm:block">Waiting</dt>
            <dd className="inline font-medium text-foreground sm:block">{summary.waiting}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
