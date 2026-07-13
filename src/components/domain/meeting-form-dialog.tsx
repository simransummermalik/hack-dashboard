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
import { useToast } from "@/components/ui/use-toast";
import { createMeeting, updateMeeting } from "@/actions/meetings";
import type { MeetingDetail } from "@/lib/queries/meetings";

interface MeetingFormDialogProps {
  mode: "create" | "edit";
  meeting?: MeetingDetail;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MeetingFormDialog({ mode, meeting, trigger, open: controlledOpen, onOpenChange }: MeetingFormDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(meeting?.title ?? "");
  const [meetingDate, setMeetingDate] = useState(meeting?.meetingDate ?? "");
  const [startTime, setStartTime] = useState(meeting?.startTime?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(meeting?.endTime?.slice(0, 5) ?? "");
  const [location, setLocation] = useState(meeting?.location ?? "");
  const [agenda, setAgenda] = useState(meeting?.agenda ?? "");
  const [notes, setNotes] = useState(meeting?.notes ?? "");
  const [links, setLinks] = useState<{ label: string; url: string }[]>(meeting?.links.map((l) => ({ label: l.label, url: l.url })) ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && mode === "create") {
      setTitle("");
      setMeetingDate("");
      setStartTime("");
      setEndTime("");
      setLocation("");
      setAgenda("");
      setNotes("");
      setLinks([]);
      setError(null);
    }
  }, [open, mode]);

  function submit() {
    if (!title.trim() || !meetingDate) {
      setError("Title and date are required.");
      return;
    }
    const payload = {
      title: title.trim(),
      meetingDate,
      startTime: startTime || null,
      endTime: endTime || null,
      location: location || null,
      agenda,
      notes,
      links: links.filter((l) => l.label.trim() && l.url.trim()),
    };

    startTransition(async () => {
      const result = mode === "create" ? await createMeeting(payload) : await updateMeeting(meeting!.id, payload);
      if (result.ok) {
        setOpen(false);
        toast({ title: mode === "create" ? "Meeting scheduled" : "Meeting updated" });
        router.refresh();
        if (mode === "create" && "meetingId" in result && result.meetingId) {
          router.push(`/meetings/${result.meetingId}`);
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
            <Plus className="h-4 w-4" /> New meeting
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Schedule a meeting" : "Edit meeting"}</DialogTitle>
          <DialogDescription>All active members will be invited automatically.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly officer sync" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Location or meeting link</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room 204 or https://meet..." />
          </div>
          <div className="space-y-1.5">
            <Label>Agenda</Label>
            <Textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
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
            {mode === "create" ? "Schedule meeting" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
