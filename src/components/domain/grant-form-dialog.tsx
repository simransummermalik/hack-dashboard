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
import { useToast } from "@/components/ui/use-toast";
import { createGrant, updateGrant } from "@/actions/finance";
import { GRANT_STATUSES, GRANT_STATUS_LABELS } from "@/lib/constants";
import type { GrantRow } from "@/lib/queries/finance";

export function GrantFormDialog({ mode, grant, trigger }: { mode: "create" | "edit"; grant?: GrantRow; trigger?: React.ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(grant?.name ?? "");
  const [fundingOrg, setFundingOrg] = useState(grant?.fundingOrg ?? "");
  const [totalAwarded, setTotalAwarded] = useState(grant ? String(grant.totalAwardedCents / 100) : "");
  const [amountReceived, setAmountReceived] = useState(grant ? String(grant.amountReceivedCents / 100) : "");
  const [startDate, setStartDate] = useState(grant?.startDate ?? "");
  const [spendingDeadline, setSpendingDeadline] = useState(grant?.spendingDeadline ?? "");
  const [restrictions, setRestrictions] = useState(grant?.restrictions ?? "");
  const [notes, setNotes] = useState(grant?.notes ?? "");
  const [status, setStatus] = useState(grant?.status ?? "potential");
  const [links, setLinks] = useState(grant?.links.map((l) => ({ label: l.label, url: l.url })) ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && mode === "create") {
      setName("");
      setFundingOrg("");
      setTotalAwarded("");
      setAmountReceived("");
      setStartDate("");
      setSpendingDeadline("");
      setRestrictions("");
      setNotes("");
      setStatus("potential");
      setLinks([]);
      setError(null);
    }
  }, [open, mode]);

  function submit() {
    if (!name.trim() || !fundingOrg.trim()) {
      setError("Name and funding organization are required.");
      return;
    }
    const payload = {
      name: name.trim(),
      fundingOrg: fundingOrg.trim(),
      totalAwardedDollars: Number(totalAwarded) || 0,
      amountReceivedDollars: Number(amountReceived) || 0,
      startDate: startDate || null,
      spendingDeadline: spendingDeadline || null,
      restrictions: restrictions || null,
      notes: notes || null,
      status: status as (typeof GRANT_STATUSES)[number],
      links: links.filter((l) => l.label.trim() && l.url.trim()),
    };

    startTransition(async () => {
      const result = mode === "create" ? await createGrant(payload) : await updateGrant(grant!.id, payload);
      if (result.ok) {
        setOpen(false);
        toast({ title: mode === "create" ? "Grant added" : "Grant updated" });
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New grant
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add grant" : "Edit grant"}</DialogTitle>
          <DialogDescription>Internal planning record — not formal accounting.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Grant name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Funding organization</Label>
              <Input value={fundingOrg} onChange={(e) => setFundingOrg(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Total awarded ($)</Label>
              <Input type="number" min="0" step="0.01" value={totalAwarded} onChange={(e) => setTotalAwarded(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount received ($)</Label>
              <Input type="number" min="0" step="0.01" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Spending deadline</Label>
              <Input type="date" value={spendingDeadline} onChange={(e) => setSpendingDeadline(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRANT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {GRANT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Restrictions</Label>
            <Textarea value={restrictions} onChange={(e) => setRestrictions(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
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
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Add grant" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
