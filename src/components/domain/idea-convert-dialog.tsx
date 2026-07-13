"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { convertIdeaToTasks } from "@/actions/ideas";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/constants";
import type { CategoryOption } from "@/lib/queries/categories";
import type { MemberSummary } from "@/lib/queries/members";

interface DraftTask {
  title: string;
  categoryId: string;
  priority: (typeof TASK_PRIORITIES)[number];
  dueDate: string;
  assigneeIds: string[];
}

export function IdeaConvertDialog({
  ideaId,
  ideaTitle,
  categories,
  members,
}: {
  ideaId: string;
  ideaTitle: string;
  categories: CategoryOption[];
  members: MemberSummary[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<DraftTask[]>([
    { title: ideaTitle, categoryId: "", priority: "medium", dueDate: "", assigneeIds: [] },
  ]);

  function update(index: number, patch: Partial<DraftTask>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function submit() {
    const valid = drafts.filter((d) => d.title.trim());
    if (valid.length === 0) return;

    startTransition(async () => {
      const result = await convertIdeaToTasks(ideaId, {
        tasks: valid.map((d) => ({
          title: d.title.trim(),
          description: "",
          categoryId: d.categoryId || null,
          priority: d.priority,
          dueDate: d.dueDate || null,
          assigneeIds: d.assigneeIds,
        })),
      });

      if (result.ok) {
        toast({ title: `Created ${result.taskIds?.length ?? 0} task(s) from this idea` });
        setOpen(false);
        router.refresh();
      } else {
        toast({ title: "Couldn't convert idea", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Workflow className="h-4 w-4" /> Convert to task(s)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Convert idea into tasks</DialogTitle>
          <DialogDescription>Each task will be linked back to this idea and go through the normal review process.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {drafts.map((d, idx) => (
            <div key={idx} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <Label>Task {idx + 1}</Label>
                {drafts.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => setDrafts((prev) => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Input value={d.title} onChange={(e) => update(idx, { title: e.target.value })} placeholder="Task title" />
              <div className="grid grid-cols-2 gap-2">
                <Select value={d.categoryId || "none"} onValueChange={(v) => update(idx, { categoryId: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
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
                <Select value={d.priority} onValueChange={(v) => update(idx, { priority: v as (typeof TASK_PRIORITIES)[number] })}>
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
              <Input type="date" value={d.dueDate} onChange={(e) => update(idx, { dueDate: e.target.value })} />
              <div className="max-h-24 space-y-1 overflow-y-auto rounded border p-2">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={d.assigneeIds.includes(m.id)}
                      onCheckedChange={() =>
                        update(idx, {
                          assigneeIds: d.assigneeIds.includes(m.id)
                            ? d.assigneeIds.filter((id) => id !== m.id)
                            : [...d.assigneeIds, m.id],
                        })
                      }
                    />
                    {m.fullName}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDrafts((prev) => [...prev, { title: "", categoryId: "", priority: "medium", dueDate: "", assigneeIds: [] }])}
          >
            Add another task
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create task(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
