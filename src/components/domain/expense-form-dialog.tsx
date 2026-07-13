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
import { createExpense, updateExpense } from "@/actions/finance";
import { EXPENSE_STATUSES, EXPENSE_STATUS_LABELS } from "@/lib/constants";
import type { ExpenseRow, GrantRow } from "@/lib/queries/finance";
import type { CategoryOption } from "@/lib/queries/categories";
import type { MemberSummary } from "@/lib/queries/members";

export function ExpenseFormDialog({
  mode,
  expense,
  grants,
  categories,
  members,
  currentMemberId,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  mode: "create" | "edit";
  expense?: ExpenseRow;
  grants: GrantRow[];
  categories: CategoryOption[];
  members: MemberSummary[];
  currentMemberId: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(expense?.name ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amountCents / 100) : "");
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState(expense ? categories.find((c) => c.name === expense.categoryName)?.id ?? "" : "");
  const [grantId, setGrantId] = useState(expense?.grantId ?? "");
  const [requestedBy, setRequestedBy] = useState(expense?.requestedById ?? currentMemberId);
  const [status, setStatus] = useState(expense?.status ?? "proposed");
  const [receiptUrl, setReceiptUrl] = useState(expense?.receiptUrl ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (open && mode === "create") {
      setName("");
      setAmount("");
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setCategoryId("");
      setGrantId("");
      setRequestedBy(currentMemberId);
      setStatus("proposed");
      setReceiptUrl("");
      setNotes("");
      setError(null);
      setWarning(null);
    }
  }, [open, mode, currentMemberId]);

  function submit() {
    if (!name.trim() || !amount) {
      setError("Name and amount are required.");
      return;
    }
    const payload = {
      name: name.trim(),
      amountDollars: Number(amount),
      expenseDate,
      categoryId: categoryId || null,
      grantId: grantId || null,
      requestedBy,
      status: status as (typeof EXPENSE_STATUSES)[number],
      receiptUrl: receiptUrl || null,
      notes: notes || null,
    };

    startTransition(async () => {
      const result = mode === "create" ? await createExpense(payload) : await updateExpense(expense!.id, payload);
      if (result.ok) {
        setOpen(false);
        toast({ title: mode === "create" ? "Expense recorded" : "Expense updated" });
        if (result.warning) setWarning(result.warning);
        router.refresh();
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
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-4 w-4" /> New expense
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Record expense" : "Edit expense"}</DialogTitle>
          <DialogDescription>Internal tracking only — not formal accounting.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Expense name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
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
          </div>
          <div className="space-y-1.5">
            <Label>Grant used</Label>
            <Select value={grantId || "none"} onValueChange={(v) => setGrantId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No grant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No grant</SelectItem>
                {grants.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Requested by</Label>
              <Select value={requestedBy} onValueChange={setRequestedBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as (typeof EXPENSE_STATUSES)[number])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {EXPENSE_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Receipt or supporting link</Label>
            <Input value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          {warning && <p className="text-sm text-warning-foreground bg-warning/20 rounded-md p-2">{warning}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Record expense" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
