"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { members } from "@/db/schema";
import {
  DUMMY_CODE_HASH,
  isValidAccessCodeFormat,
  normalizeName,
  verifyAccessCode,
} from "@/lib/crypto";
import { assertNotLockedOut, recordLoginAttempt, LockedOutError } from "@/lib/rate-limit";
import { createSession, destroySession, getClientIp } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { redirect } from "next/navigation";

const loginSchema = z.object({
  fullName: z.string().min(1, "Enter your full name.").max(200),
  code: z.string().min(1, "Enter your 4-digit access code."),
});

export interface LoginResult {
  ok: boolean;
  error?: string;
}

/**
 * Verifies a member's name + 4-digit code and starts a session.
 *
 * Security notes:
 * - The error message never reveals whether the name matched a member.
 * - A bcrypt comparison always runs (against a dummy hash when no member is
 *   found) so response timing doesn't leak whether the account exists.
 * - Attempts are rate limited per normalized-name + IP pair.
 */
export async function login(formData: FormData): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({
    fullName: formData.get("fullName"),
    code: formData.get("code"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Enter your full name and 4-digit code." };
  }

  const { fullName, code } = parsed.data;
  const normalized = normalizeName(fullName);
  const ip = getClientIp();

  if (!isValidAccessCodeFormat(code)) {
    await recordLoginAttempt({ normalizedName: normalized, ip, success: false });
    return { ok: false, error: "Invalid name or access code." };
  }

  try {
    try {
      await assertNotLockedOut(normalized, ip);
    } catch (err) {
      if (err instanceof LockedOutError) {
        await recordAudit({ actorId: null, action: "login_locked_out", metadata: { normalizedName: normalized, ip } });
        return { ok: false, error: err.message };
      }
      throw err;
    }

    const rows = await db.select().from(members).where(eq(members.normalizedName, normalized)).limit(1);
    const member = rows[0];

    const hashToCheck = member?.codeHash ?? DUMMY_CODE_HASH;
    const codeMatches = await verifyAccessCode(code, hashToCheck);
    const success = Boolean(member && member.active && codeMatches);

    await recordLoginAttempt({ normalizedName: normalized, ip, success });

    if (!success) {
      await recordAudit({
        actorId: member?.id ?? null,
        action: "login_failed",
        metadata: { normalizedName: normalized, ip },
      });
      return { ok: false, error: "Invalid name or access code." };
    }

    await createSession(member!.id);
    await recordAudit({ actorId: member!.id, action: "login_success", metadata: { ip } });

    return { ok: true };
  } catch (err) {
    // Anything unexpected here (most likely: the database is unreachable)
    // should surface as a clean error the UI can show, not an unhandled
    // exception that leaves the sign-in button spinning forever.
    console.error("Login action failed:", err);
    return { ok: false, error: "We couldn't reach the database. Please try again in a moment." };
  }
}

export async function logout(): Promise<void> {
  const { getCurrentMember } = await import("@/lib/session");
  const current = await getCurrentMember();
  await destroySession();
  if (current) {
    await recordAudit({ actorId: current.id, action: "logout" });
  }
  redirect("/login");
}
