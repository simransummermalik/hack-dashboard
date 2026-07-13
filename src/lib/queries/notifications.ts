import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";

export async function listNotificationsForMember(memberId: string, limit = 100) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.memberId, memberId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }));
}
