"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { updateExpenseStatus } from "@/actions/finance";
import { EXPENSE_STATUSES, EXPENSE_STATUS_LABELS } from "@/lib/constants";

export function ExpenseStatusControl({ expenseId, status }: { expenseId: string; status: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    if (next === status) return;
    startTransition(async () => {
      const result = await updateExpenseStatus(expenseId, next as (typeof EXPENSE_STATUSES)[number]);
      if (result.ok) router.refresh();
      else toast({ title: "Couldn't update expense", description: result.error, variant: "destructive" });
    });
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="h-7 w-40 text-xs">
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SelectValue />}
      </SelectTrigger>
      <SelectContent>
        {EXPENSE_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {EXPENSE_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
