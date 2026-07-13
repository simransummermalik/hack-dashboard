"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/domain/empty-state";
import { MeetingFormDialog } from "@/components/domain/meeting-form-dialog";
import { MeetingsCalendar } from "@/components/domain/meetings-calendar";
import { CalendarDays } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { MeetingListItem } from "@/lib/queries/meetings";

export function MeetingsView({ meetings, canCreate }: { meetings: MeetingListItem[]; canCreate: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateOpen(true);
      router.replace("/meetings");
    }
  }, [searchParams, router]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = meetings.filter((m) => m.meetingDate >= today).sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
  const past = meetings.filter((m) => m.meetingDate < today).sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));

  function MeetingRow({ m }: { m: MeetingListItem }) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div>
            <Link href={`/meetings/${m.id}`} className="font-medium hover:underline">
              {m.title}
            </Link>
            <p className="text-xs text-muted-foreground">
              {formatDate(m.meetingDate)}
              {m.startTime ? ` · ${m.startTime.slice(0, 5)}` : ""} {m.location ? `· ${m.location}` : ""}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {m.attendingCount}/{m.totalInvited} attending
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
        {canCreate && <MeetingFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />}
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="space-y-3">
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No upcoming meetings" />
          ) : (
            upcoming.map((m) => <MeetingRow key={m.id} m={m} />)
          )}
        </TabsContent>
        <TabsContent value="calendar">
          <MeetingsCalendar meetings={meetings} />
        </TabsContent>
        <TabsContent value="past" className="space-y-3">
          {past.length === 0 ? <EmptyState title="No past meetings yet" /> : past.map((m) => <MeetingRow key={m.id} m={m} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
