"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { requireCurrentMember } from "@/lib/current-member";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const actor = await requireCurrentMember();

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.memberId, actor.id)));

  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const actor = await requireCurrentMember();

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.memberId, actor.id), eq(notifications.read, false)));

  revalidatePath("/notifications");
  return { ok: true };
}
