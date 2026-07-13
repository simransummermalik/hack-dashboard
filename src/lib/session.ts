import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { members, sessions } from "@/db/schema";
import { generateSessionToken, hashSessionToken } from "./crypto";
import type { Role } from "./authorization";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "havk_session";
const SESSION_LIFETIME_HOURS = Number(process.env.SESSION_LIFETIME_HOURS ?? 12);

export interface SessionMember {
  id: string;
  fullName: string;
  role: Role;
  active: boolean;
}

export async function createSession(memberId: string): Promise<void> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_HOURS * 60 * 60 * 1000);
  const ua = headers().get("user-agent") ?? undefined;

  await db.insert(sessions).values({
    tokenHash,
    memberId,
    userAgent: ua,
    expiresAt,
  });

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashSessionToken(token);
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, tokenHash));
  }
  cookies().delete(COOKIE_NAME);
}

/**
 * Reads and validates the current session. Cached per-request so multiple
 * server components/actions calling this don't each hit the database.
 */
export const getCurrentMember = cache(async (): Promise<SessionMember | null> => {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const now = new Date();

  const rows = await db
    .select({
      sessionId: sessions.id,
      memberId: members.id,
      fullName: members.fullName,
      role: members.role,
      active: members.active,
    })
    .from(sessions)
    .innerJoin(members, eq(sessions.memberId, members.id))
    .where(
      and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, now))
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.memberId,
    fullName: row.fullName,
    role: row.role,
    active: row.active,
  };
});

export function getClientIp(): string {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
