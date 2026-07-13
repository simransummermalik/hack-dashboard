"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setMeetingAttendance } from "@/actions/meetings";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABELS } from "@/lib/constants";

export function MeetingAttendanceControl({ meetingId, currentStatus }: { meetingId: string; currentStatus: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function setStatus(status: (typeof ATTENDANCE_STATUSES)[number]) {
    startTransition(async () => {
      const result = await setMeetingAttendance(meetingId, status);
      if (result.ok) router.refresh();
      else toast({ title: "Couldn't update attendance", description: result.error, variant: "destructive" });
    });
  }

  const options = ATTENDANCE_STATUSES.filter((s) => s !== "no_response");

  return (
    <div className="flex gap-2">
      {options.map((s) => (
        <Button
          key={s}
          size="sm"
          variant={currentStatus === s ? "default" : "outline"}
          disabled={isPending}
          onClick={() => setStatus(s)}
          className={cn(currentStatus === s && "pointer-events-none")}
        >
          {ATTENDANCE_STATUS_LABELS[s]}
        </Button>
      ))}
    </div>
  );
}
