"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { createTask, updateTask } from "@/actions/tasks";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/constants";
import type { MemberSummary } from "@/lib/queries/members";
import type { CategoryOption } from "@/lib/queries/categories";
import type { TaskDetail } from "@/lib/queries/tasks";

interface ReviewExemptionReason {
  id: string;
  label: string;
}

interface TaskFormDialogProps {
  mode: "create" | "edit";
  task?: TaskDetail;
  categories: CategoryOption[];
  members: MemberSummary[];
  reviewExemptionReasons?: ReviewExemptionReason[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TaskFormDialog({
  mode,
  task,
  categories,
  members,
  reviewExemptionReasons = [],
  trigger,
  open: controlledOpen,
  onOpenChange,
}: TaskFormDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [categoryId, setCategoryId] = useState<string>(task ? categories.find((c) => c.name === task.categoryName)?.id ?? "" : "");
  const [priority, setPriority] = useState(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeIds ?? []);
  const [links, setLinks] = useState<{ label: string; url: string }[]>(task?.links.map((l) => ({ label: l.label, url: l.url })) ?? []);
  const [reviewExempt, setReviewExempt] = useState(task?.reviewExempt ?? false);
  const [reviewExemptReasonId, setReviewExemptReasonId] = useState<string>(task?.reviewExemptReasonId ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && mode === "create") {
      setTitle("");
      setDescription("");
      setCategoryId("");
      setPriority("medium");
      setDueDate("");
      setAssigneeIds([]);
      setLinks([]);
      setReviewExempt(false);
      setReviewExemptReasonId("");
      setError(null);
    }
  }, [open, mode]);

  function toggleAssignee(memberId: string) {
    setAssigneeIds((prev) => (prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]));
  }

  function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    const payload = {
      title: title.trim(),
      description,
      categoryId: categoryId || null,
      priority: priority as (typeof TASK_PRIORITIES)[number],
      dueDate: dueDate || null,
      assigneeIds,
      links: links.filter((l) => l.label.trim() && l.url.trim()),
      reviewExempt,
      reviewExemptReasonId: reviewExempt ? reviewExemptReasonId || null : null,
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createTask(payload)
          : await updateTask(task!.id, payload);

      if (result.ok) {
        setOpen(false);
        toast({ title: mode === "create" ? "Task created" : "Task updated" });
        router.refresh();
        if (mode === "create" && "taskId" in result && result.taskId) {
          router.push(`/tasks/${result.taskId}`);
        }
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New task
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create task" : "Edit task"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Every active member will automatically be asked to review this task unless you mark it exempt."
              : "Update task details. Assignee and review changes are recorded in the activity log."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Book venue for kickoff" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What needs to happen?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as (typeof TASK_PRIORITIES)[number])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Assignees</Label>
            <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-md border p-2">
              {members.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={assigneeIds.includes(m.id)} onCheckedChange={() => toggleAssignee(m.id)} />
                  {m.fullName}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Links</Label>
            <div className="space-y-2">
              {links.map((l, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder="Label"
                    value={l.label}
                    onChange={(e) => setLinks((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))}
                    className="w-32"
                  />
                  <Input
                    placeholder="https://..."
                    value={l.url}
                    onChange={(e) => setLinks((prev) => prev.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)))}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setLinks((prev) => prev.filter((_, i) => i !== idx))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setLinks((prev) => [...prev, { label: "", url: "" }])}>
                Add link
              </Button>
            </div>
          </div>

          {mode === "create" && reviewExemptionReasons.length > 0 && (
            <div className="space-y-2 rounded-md border p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox checked={reviewExempt} onCheckedChange={(v) => setReviewExempt(Boolean(v))} />
                Exempt this task from mandatory member review
              </label>
              {reviewExempt && (
                <Select value={reviewExemptReasonId} onValueChange={setReviewExemptReasonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a permitted reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {reviewExemptionReasons.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create task" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
