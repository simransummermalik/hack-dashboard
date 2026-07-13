"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  meetingActionItems,
  meetingAttendees,
  meetingDecisions,
  meetingLinks,
  meetings,
  tasks,
} from "@/db/schema";
import { requireCurrentMember } from "@/lib/current-member";
import { AuthorizationError, requireMember, requireOfficerOrAdmin } from "@/lib/authorization";
import { createTaskRecord, getActiveMemberIds } from "@/lib/task-core";
import { recordAudit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";
import { ATTENDANCE_STATUSES } from "@/lib/constants";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const meetingInputSchema = z.object({
  title: z.string().trim().min(2).max(300),
  meetingDate: z.string().min(1),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  location: z.string().trim().max(500).nullable(),
  agenda: z.string().trim().max(20000).default(""),
  notes: z.string().trim().max(20000).default(""),
  links: z.array(z.object({ label: z.string().min(1), url: z.string().url() })).default([]),
});

export async function createMeeting(input: z.infer<typeof meetingInputSchema>): Promise<ActionResult & { meetingId?: string }> {
  const actor = await requireCurrentMember();
  requireOfficerOrAdmin(actor);

  const parsed = meetingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid meeting." };
  const data = parsed.data;

  const [created] = await db
    .insert(meetings)
    .values({
      title: data.title,
      meetingDate: data.meetingDate,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location,
      agenda: data.agenda,
      notes: data.notes,
      organizerId: actor.id,
    })
    .returning({ id: meetings.id });

  if (!created) return { ok: false, error: "Failed to create meeting." };

  const activeMemberIds = await getActiveMemberIds();
  if (activeMemberIds.length > 0) {
    await db.insert(meetingAttendees).values(
      activeMemberIds.map((memberId) => ({ meetingId: created.id, memberId }))
    );
  }

  if (data.links.length > 0) {
    await db.insert(meetingLinks).values(
      data.links.map((l) => ({ meetingId: created.id, label: l.label, url: l.url, createdBy: actor.id }))
    );
  }

  await recordAudit({
    actorId: actor.id,
    action: "meeting_created",
    entityType: "meeting",
    entityId: created.id,
    after: { title: data.title, meetingDate: data.meetingDate },
  });

  await notifyMany(
    activeMemberIds
      .filter((id) => id !== actor.id)
      .map((memberId) => ({
        memberId,
        type: "meeting_upcoming" as const,
        title: "New meeting scheduled",
        body: `${data.title} on ${data.meetingDate}`,
        link: `/meetings/${created.id}`,
        entityType: "meeting" as const,
        entityId: created.id,
      }))
  );

  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  return { ok: true, meetingId: created.id };
}

export async function updateMeeting(meetingId: string, input: z.infer<typeof meetingInputSchema>): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireOfficerOrAdmin(actor);

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
  if (!meeting) return { ok: false, error: "Meeting not found." };

  const parsed = meetingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid meeting." };
  const data = parsed.data;

  await db
    .update(meetings)
    .set({
      title: data.title,
      meetingDate: data.meetingDate,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location,
      agenda: data.agenda,
      notes: data.notes,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meetingId));

  await db.delete(meetingLinks).where(eq(meetingLinks.meetingId, meetingId));
  if (data.links.length > 0) {
    await db.insert(meetingLinks).values(
      data.links.map((l) => ({ meetingId, label: l.label, url: l.url, createdBy: actor.id }))
    );
  }

  await recordAudit({
    actorId: actor.id,
    action: "meeting_updated",
    entityType: "meeting",
    entityId: meetingId,
    before: { title: meeting.title },
    after: { title: data.title },
  });

  revalidatePath("/meetings");
  revalidatePath(`/meetings/${meetingId}`);
  return { ok: true };
}

export async function setMeetingAttendance(
  meetingId: string,
  status: (typeof ATTENDANCE_STATUSES)[number]
): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireMember(actor);

  const [existing] = await db
    .select()
    .from(meetingAttendees)
    .where(and(eq(meetingAttendees.meetingId, meetingId), eq(meetingAttendees.memberId, actor.id)))
    .limit(1);

  if (existing) {
    await db
      .update(meetingAttendees)
      .set({ status, respondedAt: new Date() })
      .where(and(eq(meetingAttendees.meetingId, meetingId), eq(meetingAttendees.memberId, actor.id)));
  } else {
    await db.insert(meetingAttendees).values({ meetingId, memberId: actor.id, status, respondedAt: new Date() });
  }

  await recordAudit({
    actorId: actor.id,
    action: "meeting_attendance_updated",
    entityType: "meeting",
    entityId: meetingId,
    after: { status },
  });

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  return { ok: true };
}

export async function addMeetingDecision(meetingId: string, description: string): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireOfficerOrAdmin(actor);

  const trimmed = description.trim();
  if (!trimmed) return { ok: false, error: "Decision text is required." };

  await db.insert(meetingDecisions).values({ meetingId, description: trimmed, createdBy: actor.id });

  revalidatePath(`/meetings/${meetingId}`);
  return { ok: true };
}

const actionItemSchema = z.object({
  description: z.string().trim().min(2),
  ownerId: z.string().uuid().nullable(),
  dueDate: z.string().nullable(),
});

export async function addMeetingActionItem(meetingId: string, input: z.infer<typeof actionItemSchema>): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireOfficerOrAdmin(actor);

  const parsed = actionItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid action item." };

  const [created] = await db
    .insert(meetingActionItems)
    .values({ meetingId, ...parsed.data })
    .returning({ id: meetingActionItems.id });

  if (created && parsed.data.ownerId) {
    await notifyMany([
      {
        memberId: parsed.data.ownerId,
        type: "meeting_action_item",
        title: "You have a new action item",
        body: parsed.data.description,
        link: `/meetings/${meetingId}`,
        entityType: "meeting",
        entityId: meetingId,
      },
    ]);
  }

  revalidatePath(`/meetings/${meetingId}`);
  return { ok: true };
}

export async function convertActionItemToTask(actionItemId: string): Promise<ActionResult & { taskId?: string }> {
  const actor = await requireCurrentMember();

  const [item] = await db.select().from(meetingActionItems).where(eq(meetingActionItems.id, actionItemId)).limit(1);
  if (!item) return { ok: false, error: "Action item not found." };
  if (item.convertedTaskId) return { ok: false, error: "This action item has already been converted." };

  try {
    if (item.ownerId !== actor.id) requireOfficerOrAdmin(actor);
    else requireMember(actor);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: err.message };
    throw err;
  }

  const { taskId } = await createTaskRecord({
    title: item.description.slice(0, 300),
    description: `Action item from meeting.`,
    creatorId: actor.id,
    categoryId: null,
    priority: "medium",
    dueDate: item.dueDate,
    assigneeIds: item.ownerId ? [item.ownerId] : [],
    links: [],
    reviewExempt: false,
    reviewExemptReasonId: null,
  });

  await db.update(tasks).set({ sourceMeetingActionItemId: actionItemId }).where(eq(tasks.id, taskId));
  await db.update(meetingActionItems).set({ convertedTaskId: taskId }).where(eq(meetingActionItems.id, actionItemId));

  await recordAudit({
    actorId: actor.id,
    action: "meeting_action_item_converted",
    entityType: "meeting_action_item",
    entityId: actionItemId,
    metadata: { taskId, meetingId: item.meetingId },
  });

  revalidatePath(`/meetings/${item.meetingId}`);
  revalidatePath("/tasks");
  return { ok: true, taskId };
}
