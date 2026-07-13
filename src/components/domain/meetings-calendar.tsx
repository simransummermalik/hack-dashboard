"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MeetingListItem } from "@/lib/queries/meetings";

export function MeetingsCalendar({ meetings }: { meetings: MeetingListItem[] }) {
  const [cursor, setCursor] = useState(() => new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, MeetingListItem[]>();
    for (const m of meetings) {
      const key = m.meetingDate;
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [meetings]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{format(cursor, "MMMM yyyy")}</h3>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => subMonths(c, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-muted px-2 py-1.5 text-center font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayMeetings = meetingsByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                "min-h-24 bg-card p-1.5",
                !isSameMonth(day, cursor) && "bg-muted/40 text-muted-foreground",
                isSameDay(day, new Date()) && "ring-2 ring-inset ring-primary"
              )}
            >
              <p className="mb-1 text-right text-[11px]">{format(day, "d")}</p>
              <div className="space-y-1">
                {dayMeetings.map((m) => (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="block truncate rounded bg-accent px-1 py-0.5 text-[11px] text-accent-foreground hover:underline"
                  >
                    {m.title}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
