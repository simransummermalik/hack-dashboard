import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { loginAttempts } from "@/db/schema";

const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5);
const LOCKOUT_MINUTES = Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15);

// A second, IP-agnostic ceiling on top of the per-IP limit above. Per-IP
// limiting alone is trivially bypassed by an attacker who can rotate IPs
// (e.g. via a botnet or proxy pool) — this closes that gap by capping
// total failed attempts against a given member name across ALL IPs.
// Deliberately higher than MAX_ATTEMPTS so a legitimate member mistyping
// their code from a couple of different networks (home wifi, phone data)
// never trips it, while a 10,000-combination brute force still does, fast.
const GLOBAL_MAX_ATTEMPTS = Number(process.env.LOGIN_GLOBAL_MAX_ATTEMPTS ?? 20);

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

/**
 * Throws LockedOutError if either (a) this name+IP pair, or (b) this name
 * across every IP, has too many recent failed attempts. (b) exists
 * specifically to stop IP-rotation attacks against a single account.
 */
export async function assertNotLockedOut(normalizedName: string, ip: string): Promise<void> {
  const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60_000);

  // Sequential, not Promise.all — this runs on every login attempt,
  // including a burst from an attacker; see src/lib/queries/dashboard.ts
  // for why concurrent query fan-out is avoided on this project's tier.
  const perIpFailures = await db
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
  const globalFailuresForName = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.normalizedName, normalizedName),
        eq(loginAttempts.success, false),
        gt(loginAttempts.createdAt, windowStart)
      )
    );

  const perIpCount = perIpFailures[0]?.count ?? 0;
  const globalCount = globalFailuresForName[0]?.count ?? 0;

  if (perIpCount >= MAX_ATTEMPTS || globalCount >= GLOBAL_MAX_ATTEMPTS) {
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
