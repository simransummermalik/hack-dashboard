import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  meetingActionItems,
  meetingAttendees,
  meetingDecisions,
  meetingLinks,
  meetings,
  members,
} from "@/db/schema";

export interface MeetingListItem {
  id: string;
  title: string;
  meetingDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  organizerName: string;
  attendingCount: number;
  totalInvited: number;
}

export async function listMeetings(): Promise<MeetingListItem[]> {
  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      meetingDate: meetings.meetingDate,
      startTime: meetings.startTime,
      endTime: meetings.endTime,
      location: meetings.location,
      organizerName: members.fullName,
    })
    .from(meetings)
    .innerJoin(members, eq(meetings.organizerId, members.id))
    .orderBy(desc(meetings.meetingDate));

  const attendeeRows = await db.select().from(meetingAttendees);
  const attendingByMeeting = new Map<string, number>();
  const totalByMeeting = new Map<string, number>();
  for (const a of attendeeRows) {
    totalByMeeting.set(a.meetingId, (totalByMeeting.get(a.meetingId) ?? 0) + 1);
    if (a.status === "attending") {
      attendingByMeeting.set(a.meetingId, (attendingByMeeting.get(a.meetingId) ?? 0) + 1);
    }
  }

  return rows.map((r) => ({
    ...r,
    attendingCount: attendingByMeeting.get(r.id) ?? 0,
    totalInvited: totalByMeeting.get(r.id) ?? 0,
  }));
}

export interface MeetingDetail extends MeetingListItem {
  organizerId: string;
  agenda: string;
  notes: string;
  attendees: Array<{ memberId: string; memberName: string; status: string }>;
  decisions: Array<{ id: string; description: string; createdAt: string }>;
  actionItems: Array<{
    id: string;
    description: string;
    ownerId: string | null;
    ownerName: string | null;
    dueDate: string | null;
    convertedTaskId: string | null;
  }>;
  links: Array<{ id: string; label: string; url: string }>;
}

export async function getMeetingDetail(meetingId: string): Promise<MeetingDetail | null> {
  const [meeting] = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      meetingDate: meetings.meetingDate,
      startTime: meetings.startTime,
      endTime: meetings.endTime,
      location: meetings.location,
      organizerId: meetings.organizerId,
      organizerName: members.fullName,
      agenda: meetings.agenda,
      notes: meetings.notes,
    })
    .from(meetings)
    .innerJoin(members, eq(meetings.organizerId, members.id))
    .where(eq(meetings.id, meetingId))
    .limit(1);

  if (!meeting) return null;

  const attendeeRows = await db
    .select({ memberId: meetingAttendees.memberId, memberName: members.fullName, status: meetingAttendees.status })
    .from(meetingAttendees)
    .innerJoin(members, eq(meetingAttendees.memberId, members.id))
    .where(eq(meetingAttendees.meetingId, meetingId))
    .orderBy(asc(members.fullName));

  const decisionRows = await db.select().from(meetingDecisions).where(eq(meetingDecisions.meetingId, meetingId));

  const actionItemRows = await db
    .select({
      id: meetingActionItems.id,
      description: meetingActionItems.description,
      ownerId: meetingActionItems.ownerId,
      ownerName: members.fullName,
      dueDate: meetingActionItems.dueDate,
      convertedTaskId: meetingActionItems.convertedTaskId,
    })
    .from(meetingActionItems)
    .leftJoin(members, eq(meetingActionItems.ownerId, members.id))
    .where(eq(meetingActionItems.meetingId, meetingId));

  const linkRows = await db.select().from(meetingLinks).where(eq(meetingLinks.meetingId, meetingId));

  return {
    id: meeting.id,
    title: meeting.title,
    meetingDate: meeting.meetingDate,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    location: meeting.location,
    organizerId: meeting.organizerId,
    organizerName: meeting.organizerName,
    agenda: meeting.agenda,
    notes: meeting.notes,
    attendingCount: attendeeRows.filter((a) => a.status === "attending").length,
    totalInvited: attendeeRows.length,
    attendees: attendeeRows,
    decisions: decisionRows.map((d) => ({ id: d.id, description: d.description, createdAt: d.createdAt.toISOString() })),
    actionItems: actionItemRows,
    links: linkRows.map((l) => ({ id: l.id, label: l.label, url: l.url })),
  };
}
