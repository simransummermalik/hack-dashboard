"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/components/domain/priority-badge";
import { MemberAvatarStack } from "@/components/domain/member-avatar";
import { ReviewProgress } from "@/components/domain/review-progress";
import { AlertCircle } from "lucide-react";
import { changeTaskStatus } from "@/actions/tasks";
import { useToast } from "@/components/ui/use-toast";
import { BOARD_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";
import { formatDate, isOverdue, cn } from "@/lib/utils";
import type { TaskListItem } from "@/lib/queries/tasks";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function TasksBoard({ tasks, isAdmin }: { tasks: TaskListItem[]; isAdmin: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [overrideDialog, setOverrideDialog] = useState<{ taskId: string; targetStatus: string } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  function applyStatusChange(taskId: string, targetStatus: string, reason?: string) {
    startTransition(async () => {
      const result = await changeTaskStatus(taskId, targetStatus as (typeof BOARD_STATUSES)[number], reason);
      if (result.ok) {
        router.refresh();
      } else {
        toast({ title: "Couldn't move task", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleDrop(targetStatus: string) {
    if (!dragTaskId) return;
    const task = tasks.find((t) => t.id === dragTaskId);
    setDragTaskId(null);
    if (!task || task.status === targetStatus) return;

    if (targetStatus === "completed" && !task.reviewSummary.canComplete) {
      if (isAdmin) {
        setOverrideDialog({ taskId: task.id, targetStatus });
        return;
      }
      toast({
        title: "Cannot complete task",
        description: task.reviewSummary.blockingReasons.join("; "),
        variant: "destructive",
      });
      return;
    }

    applyStatusChange(task.id, targetStatus);
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 overflow-x-auto pb-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {BOARD_STATUSES.map((status) => {
          const columnTasks = tasks.filter((t) => t.status === status);
          return (
            <div
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(status)}
              className="flex min-w-[240px] flex-col rounded-lg bg-muted/40 p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {TASK_STATUS_LABELS[status]}
                </h3>
                <span className="text-xs text-muted-foreground">{columnTasks.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {columnTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDragTaskId(t.id)}
                    className={cn("cursor-grab active:cursor-grabbing", isPending && "opacity-60")}
                  >
                    <Link href={`/tasks/${t.id}`}>
                      <Card className="transition-shadow hover:shadow-md">
                        <CardContent className="space-y-2 p-3">
                          <p className="text-sm font-medium leading-snug">{t.title}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <PriorityBadge priority={t.priority} className="text-[10px]" />
                            {t.categoryName && (
                              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                                {t.categoryName}
                              </span>
                            )}
                          </div>
                          {t.dueDate && (
                            <p className={cn("text-xs", isOverdue(t.dueDate, t.status) ? "font-medium text-destructive" : "text-muted-foreground")}>
                              Due {formatDate(t.dueDate)}
                            </p>
                          )}
                          {t.reviewSummary.total > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {!t.reviewSummary.canComplete && <AlertCircle className="h-3 w-3 text-warning" />}
                              {t.reviewSummary.completed}/{t.reviewSummary.total} reviewed
                            </div>
                          )}
                          {t.assigneeNames.length > 0 && (
                            <div className="flex justify-end pt-1">
                              <MemberAvatarStack names={t.assigneeNames} max={3} />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                ))}
                {columnTasks.length === 0 && (
                  <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">Drop tasks here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!overrideDialog} onOpenChange={(o) => !o && setOverrideDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Override review requirement</AlertDialogTitle>
            <AlertDialogDescription>
              This task hasn&apos;t completed its required reviews. As an admin, you can override this, but you must
              provide a written explanation — it will be recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {overrideDialog && (
            <div className="space-y-3">
              <ReviewProgress
                summary={tasks.find((t) => t.id === overrideDialog.taskId)!.reviewSummary}
                compact
              />
              <div className="space-y-1.5">
                <Label htmlFor="override-reason">Explanation (required)</Label>
                <Textarea
                  id="override-reason"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Why is it acceptable to complete this task without full review?"
                />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOverrideReason("")}>Cancel</AlertDialogCancel>
            <Button
              disabled={!overrideReason.trim() || isPending}
              onClick={() => {
                if (!overrideDialog) return;
                applyStatusChange(overrideDialog.taskId, overrideDialog.targetStatus, overrideReason);
                setOverrideDialog(null);
                setOverrideReason("");
              }}
            >
              Override and complete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
