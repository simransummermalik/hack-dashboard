import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { loginAttempts } from "@/db/schema";

const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5);
const LOCKOUT_MINUTES = Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15);

export class LockedOutError extends Error {
  retryAfterMinutes: number;
  constructor(retryAfterMinutes: number) {
    super(
      `Too many failed attempts. Try again in ${retryAfterMinutes} minute${
        retryAfterMinutes === 1 ? "" : "s"
      }.`
    );
    this.name = "LockedOutError";
    this.retryAfterMinutes = retryAfterMinutes;
  }
}

/** Throws LockedOutError if this name+IP pair has too many recent failed attempts. */
export async function assertNotLockedOut(normalizedName: string, ip: string): Promise<void> {
  const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60_000);

  const recentFailures = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.normalizedName, normalizedName),
        eq(loginAttempts.ip, ip),
        eq(loginAttempts.success, false),
        gt(loginAttempts.createdAt, windowStart)
      )
    );

  const failureCount = recentFailures[0]?.count ?? 0;
  if (failureCount >= MAX_ATTEMPTS) {
    throw new LockedOutError(LOCKOUT_MINUTES);
  }
}

export async function recordLoginAttempt(params: {
  normalizedName: string;
  ip: string;
  success: boolean;
}): Promise<void> {
  await db.insert(loginAttempts).values({
    normalizedName: params.normalizedName,
    ip: params.ip,
    success: params.success,
  });
}

/** On a successful login, clear the failure counter by nature of the time window; nothing to delete since we only count failures. */
