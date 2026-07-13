"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { createReviewExemptionReason, setReviewExemptionReasonActive } from "@/actions/admin-settings";

interface ExemptionReason {
  id: string;
  label: string;
  active: boolean;
}

export function AdminReviewRulesPanel({ reasons }: { reasons: ExemptionReason[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [newLabel, setNewLabel] = useState("");

  function add() {
    if (!newLabel.trim()) return;
    startTransition(async () => {
      const result = await createReviewExemptionReason({ label: newLabel.trim() });
      if (result.ok) {
        setNewLabel("");
        router.refresh();
      } else {
        toast({ title: "Couldn't add reason", description: result.error, variant: "destructive" });
      }
    });
  }

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      const result = await setReviewExemptionReasonActive(id, active);
      if (result.ok) router.refresh();
      else toast({ title: "Couldn't update reason", description: result.error, variant: "destructive" });
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">How the review requirement works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Every active member automatically gets a review record when a task is created.</p>
          <p>A task can&apos;t move to Completed until every active member&apos;s review is resolved and no change requests are outstanding.</p>
          <p>
            Admins can override this from a task&apos;s status control — an explanation is required and recorded in the
            audit log.
          </p>
          <p>Task creators may mark a task exempt from review only using one of the permitted reasons below.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Permitted review exemption reasons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="New exemption reason" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            <Button size="sm" onClick={add} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
          <ul className="divide-y rounded-lg border">
            {reasons.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{r.label}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={r.active ? "success" : "secondary"}>{r.active ? "Active" : "Inactive"}</Badge>
                  <Button variant="ghost" size="sm" disabled={isPending} onClick={() => toggle(r.id, !r.active)}>
                    {r.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </li>
            ))}
            {reasons.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No exemption reasons configured.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
