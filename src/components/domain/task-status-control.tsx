"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { changeTaskStatus } from "@/actions/tasks";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";
import type { ReviewSummary } from "@/lib/reviews";

export function TaskStatusControl({
  taskId,
  status,
  reviewSummary,
  reviewExempt,
  isAdmin,
}: {
  taskId: string;
  status: string;
  reviewSummary: ReviewSummary;
  reviewExempt: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  function apply(target: string, reason?: string) {
    startTransition(async () => {
      const result = await changeTaskStatus(taskId, target as (typeof TASK_STATUSES)[number], reason);
      if (result.ok) {
        router.refresh();
      } else {
        toast({ title: "Couldn't change status", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleChange(target: string) {
    if (target === status) return;
    if (target === "completed" && !reviewExempt && !reviewSummary.canComplete) {
      if (isAdmin) {
        setPendingStatus(target);
        return;
      }
      toast({
        title: "Cannot complete task",
        description: reviewSummary.blockingReasons.join("; "),
        variant: "destructive",
      });
      return;
    }
    apply(target);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={handleChange} disabled={isPending}>
          <SelectTrigger className="w-48">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue />}
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AlertDialog open={!!pendingStatus} onOpenChange={(o) => !o && setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Override review requirement</AlertDialogTitle>
            <AlertDialogDescription>
              {reviewSummary.blockingReasons.join("; ")}. As an admin you can override this, but you must provide a
              written explanation — it will be recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="status-override-reason">Explanation (required)</Label>
            <Textarea id="status-override-reason" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOverrideReason("")}>Cancel</AlertDialogCancel>
            <Button
              disabled={!overrideReason.trim() || isPending}
              onClick={() => {
                if (!pendingStatus) return;
                apply(pendingStatus, overrideReason);
                setPendingStatus(null);
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
