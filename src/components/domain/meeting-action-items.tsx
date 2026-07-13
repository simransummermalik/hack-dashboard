"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { addMeetingActionItem, convertActionItemToTask } from "@/actions/meetings";
import type { MeetingDetail } from "@/lib/queries/meetings";
import type { MemberSummary } from "@/lib/queries/members";

export function MeetingActionItems({
  meetingId,
  actionItems,
  members,
  canManage,
  currentMemberId,
}: {
  meetingId: string;
  actionItems: MeetingDetail["actionItems"];
  members: MemberSummary[];
  canManage: boolean;
  currentMemberId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");

  function addItem() {
    if (!description.trim()) return;
    startTransition(async () => {
      const result = await addMeetingActionItem(meetingId, {
        description: description.trim(),
        ownerId: ownerId || null,
        dueDate: dueDate || null,
      });
      if (result.ok) {
        setDescription("");
        setOwnerId("");
        setDueDate("");
        router.refresh();
      } else {
        toast({ title: "Couldn't add action item", description: result.error, variant: "destructive" });
      }
    });
  }

  function convert(actionItemId: string) {
    startTransition(async () => {
      const result = await convertActionItemToTask(actionItemId);
      if (result.ok) {
        toast({ title: "Converted to task" });
        router.refresh();
      } else {
        toast({ title: "Couldn't convert", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {actionItems.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
            <div>
              <p>{item.description}</p>
              <p className="text-xs text-muted-foreground">
                {item.ownerName ? `Owner: ${item.ownerName}` : "Unassigned"}
                {item.dueDate ? ` · Due ${item.dueDate}` : ""}
              </p>
            </div>
            {item.convertedTaskId ? (
              <Link href={`/tasks/${item.convertedTaskId}`} className="text-xs text-primary hover:underline">
                View task
              </Link>
            ) : (
              (canManage || item.ownerId === currentMemberId) && (
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => convert(item.id)}>
                  <Workflow className="h-3.5 w-3.5" /> Convert to task
                </Button>
              )
            )}
          </li>
        ))}
        {actionItems.length === 0 && <p className="text-sm text-muted-foreground">No action items yet.</p>}
      </ul>

      {canManage && (
        <div className="flex flex-wrap items-end gap-2 border-t pt-3">
          <div className="flex-1 space-y-1.5">
            <Input placeholder="New action item" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Select value={ownerId || "none"} onValueChange={(v) => setOwnerId(v === "none" ? "" : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No owner</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" className="w-40" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Button size="sm" onClick={addItem} disabled={isPending || !description.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
