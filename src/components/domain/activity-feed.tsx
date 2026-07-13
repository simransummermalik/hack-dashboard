import { formatDateTime } from "@/lib/utils";
import type { AuditEntry } from "@/lib/queries/audit";

const ACTION_LABELS: Record<string, string> = {
  task_created: "created this task",
  task_updated: "updated this task",
  task_status_changed: "changed the status",
  task_completion_overridden: "overrode the review requirement to complete this task",
  task_review_added_manually: "manually added a reviewer",
  review_submitted: "submitted a review",
  review_updated: "updated their review",
  idea_created: "submitted this idea",
  idea_updated: "updated this idea",
  idea_voted: "voted",
  idea_converted_to_task: "converted this idea into tasks",
  meeting_created: "created this meeting",
  meeting_updated: "updated this meeting",
  meeting_attendance_updated: "updated their attendance",
  meeting_action_item_converted: "converted an action item into a task",
  grant_created: "created this grant",
  grant_updated: "updated this grant",
  expense_created: "created this expense",
  expense_updated: "updated this expense",
  expense_approved: "approved this expense",
  expense_rejected: "rejected this expense",
  comment_created: "commented",
  comment_updated: "edited a comment",
};

function getOverrideReason(entry: AuditEntry): string | null {
  if (entry.action !== "task_completion_overridden") return null;
  if (!entry.metadata || typeof entry.metadata !== "object") return null;
  const reason = (entry.metadata as Record<string, unknown>).reason;
  return typeof reason === "string" ? reason : null;
}

export function ActivityFeed({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {entries.map((e) => {
        const overrideReason = getOverrideReason(e);
        return (
          <li key={e.id} className="text-sm">
            <span className="font-medium">{e.actorName ?? "System"}</span>{" "}
            <span className="text-muted-foreground">{ACTION_LABELS[e.action] ?? e.action.replace(/_/g, " ")}</span>{" "}
            <span className="text-xs text-muted-foreground">· {formatDateTime(e.createdAt)}</span>
            {overrideReason && (
              <p className="mt-0.5 text-xs italic text-muted-foreground">&ldquo;{overrideReason}&rdquo;</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
