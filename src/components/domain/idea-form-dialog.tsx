"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
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
import { useToast } from "@/components/ui/use-toast";
import { createIdea, updateIdea } from "@/actions/ideas";
import { IDEA_STATUSES, IDEA_STATUS_LABELS } from "@/lib/constants";
import type { CategoryOption } from "@/lib/queries/categories";
import type { IdeaListItem } from "@/lib/queries/ideas";

interface IdeaFormDialogProps {
  mode: "create" | "edit";
  idea?: IdeaListItem;
  categories: CategoryOption[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showStatus?: boolean;
}

export function IdeaFormDialog({ mode, idea, categories, trigger, open: controlledOpen, onOpenChange, showStatus }: IdeaFormDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(idea?.title ?? "");
  const [description, setDescription] = useState(idea?.description ?? "");
  const [categoryId, setCategoryId] = useState(idea ? categories.find((c) => c.name === idea.categoryName)?.id ?? "" : "");
  const [estimatedCost, setEstimatedCost] = useState(idea?.estimatedCostCents != null ? String(idea.estimatedCostCents / 100) : "");
  const [estimatedEffort, setEstimatedEffort] = useState(idea?.estimatedEffort ?? "");
  const [proposedTimeline, setProposedTimeline] = useState(idea?.proposedTimeline ?? "");
  const [benefits, setBenefits] = useState(idea?.benefits ?? "");
  const [risks, setRisks] = useState(idea?.risks ?? "");
  const [status, setStatus] = useState(idea?.status ?? "new");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && mode === "create") {
      setTitle("");
      setDescription("");
      setCategoryId("");
      setEstimatedCost("");
      setEstimatedEffort("");
      setProposedTimeline("");
      setBenefits("");
      setRisks("");
      setStatus("new");
      setError(null);
    }
  }, [open, mode]);

  function submit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const payload = {
      title: title.trim(),
      description,
      categoryId: categoryId || null,
      estimatedCostCents: estimatedCost ? Math.round(Number(estimatedCost) * 100) : null,
      estimatedEffort: estimatedEffort || null,
      proposedTimeline: proposedTimeline || null,
      benefits: benefits || null,
      risks: risks || null,
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createIdea(payload)
          : await updateIdea(idea!.id, { ...payload, status: status as (typeof IDEA_STATUSES)[number] });

      if (result.ok) {
        setOpen(false);
        toast({ title: mode === "create" ? "Idea submitted" : "Idea updated" });
        router.refresh();
        if (mode === "create" && "ideaId" in result && result.ideaId) {
          router.push(`/ideas/${result.ideaId}`);
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
            <Plus className="h-4 w-4" /> New idea
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Submit an idea" : "Edit idea"}</DialogTitle>
          <DialogDescription>Share a club initiative for the group to discuss and vote on.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekend workshop series" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
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
              <Label>Estimated cost ($)</Label>
              <Input type="number" min="0" step="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Estimated effort</Label>
              <Input value={estimatedEffort} onChange={(e) => setEstimatedEffort(e.target.value)} placeholder="e.g. Low / weekend project" />
            </div>
            <div className="space-y-1.5">
              <Label>Proposed timeline</Label>
              <Input value={proposedTimeline} onChange={(e) => setProposedTimeline(e.target.value)} placeholder="e.g. Next semester" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Benefits</Label>
            <Textarea value={benefits} onChange={(e) => setBenefits(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Possible risks</Label>
            <Textarea value={risks} onChange={(e) => setRisks(e.target.value)} rows={2} />
          </div>
          {showStatus && mode === "edit" && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IDEA_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {IDEA_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            {mode === "create" ? "Submit idea" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
