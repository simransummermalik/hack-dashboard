import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_LABELS } from "@/lib/constants";

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-transparent",
  medium: "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-950 dark:text-blue-300",
  high: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  urgent: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
};

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  return (
    <Badge className={cn(PRIORITY_STYLES[priority as keyof typeof PRIORITY_STYLES], className)}>
      {TASK_PRIORITY_LABELS[priority as keyof typeof TASK_PRIORITY_LABELS] ?? priority}
    </Badge>
  );
}
