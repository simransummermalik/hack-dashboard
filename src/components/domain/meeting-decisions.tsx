"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMeetingDecision } from "@/actions/meetings";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";
import type { MeetingDetail } from "@/lib/queries/meetings";

export function MeetingDecisions({
  meetingId,
  decisions,
  canManage,
}: {
  meetingId: string;
  decisions: MeetingDetail["decisions"];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [description, setDescription] = useState("");

  function add() {
    if (!description.trim()) return;
    startTransition(async () => {
      const result = await addMeetingDecision(meetingId, description);
      if (result.ok) {
        setDescription("");
        router.refresh();
      } else {
        toast({ title: "Couldn't record decision", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {decisions.map((d) => (
          <li key={d.id} className="rounded-md border p-2.5 text-sm">
            <p>{d.description}</p>
            <p className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</p>
          </li>
        ))}
        {decisions.length === 0 && <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>}
      </ul>
      {canManage && (
        <div className="flex gap-2 border-t pt-3">
          <Input placeholder="Record a decision..." value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button size="sm" onClick={add} disabled={isPending || !description.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
