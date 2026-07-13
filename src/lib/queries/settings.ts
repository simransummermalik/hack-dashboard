import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orgSettings } from "@/db/schema";

export async function getOrgSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(orgSettings).where(eq(orgSettings.key, key)).limit(1);
  return row ? (row.value as T) : fallback;
}
