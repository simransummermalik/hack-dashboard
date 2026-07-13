import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  TASK_STATUS_LABELS,
  IDEA_STATUS_LABELS,
  GRANT_STATUS_LABELS,
  EXPENSE_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  ATTENDANCE_STATUS_LABELS,
} from "@/lib/constants";

const TASK_STATUS_STYLES: Record<string, string> = {
  backlog: "bg-muted text-muted-foreground border-transparent",
  planned: "bg-secondary text-secondary-foreground border-transparent",
  in_progress: "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-950 dark:text-blue-300",
  blocked: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
  ready_for_review: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  completed: "bg-success text-success-foreground border-transparent",
  archived: "bg-muted text-muted-foreground border-transparent opacity-70",
};

const IDEA_STATUS_STYLES: Record<string, string> = {
  new: "bg-secondary text-secondary-foreground border-transparent",
  discussing: "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-950 dark:text-blue-300",
  needs_research: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-success text-success-foreground border-transparent",
  rejected: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
  planned: "bg-purple-100 text-purple-800 border-transparent dark:bg-purple-950 dark:text-purple-300",
  implemented: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
};

const GRANT_STATUS_STYLES: Record<string, string> = {
  potential: "bg-muted text-muted-foreground border-transparent",
  applying: "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-950 dark:text-blue-300",
  submitted: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  awarded: "bg-success text-success-foreground border-transparent",
  rejected: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
  active: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground border-transparent opacity-70",
};

const EXPENSE_STATUS_STYLES: Record<string, string> = {
  proposed: "bg-muted text-muted-foreground border-transparent",
  awaiting_approval: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-950 dark:text-blue-300",
  purchased: "bg-purple-100 text-purple-800 border-transparent dark:bg-purple-950 dark:text-purple-300",
  reimbursed: "bg-success text-success-foreground border-transparent",
  rejected: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
};

const REVIEW_STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-transparent",
  approved: "bg-success text-success-foreground border-transparent",
  no_concerns: "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-950 dark:text-blue-300",
  changes_requested: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
  not_applicable: "bg-muted text-muted-foreground border-transparent opacity-70",
};

const ATTENDANCE_STATUS_STYLES: Record<string, string> = {
  attending: "bg-success text-success-foreground border-transparent",
  maybe: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  not_attending: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
  no_response: "bg-muted text-muted-foreground border-transparent",
};

function makeBadge(labels: Record<string, string>, styles: Record<string, string>) {
  return function StatusBadgeInner({ status, className }: { status: string; className?: string }) {
    return (
      <Badge className={cn(styles[status], className)}>{labels[status] ?? status}</Badge>
    );
  };
}

export const TaskStatusBadge = makeBadge(TASK_STATUS_LABELS, TASK_STATUS_STYLES);
export const IdeaStatusBadge = makeBadge(IDEA_STATUS_LABELS, IDEA_STATUS_STYLES);
export const GrantStatusBadge = makeBadge(GRANT_STATUS_LABELS, GRANT_STATUS_STYLES);
export const ExpenseStatusBadge = makeBadge(EXPENSE_STATUS_LABELS, EXPENSE_STATUS_STYLES);
export const ReviewStatusBadge = makeBadge(REVIEW_STATUS_LABELS, REVIEW_STATUS_STYLES);
export const AttendanceStatusBadge = makeBadge(ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_STYLES);
