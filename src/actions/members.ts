"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { members } from "@/db/schema";
import { requireCurrentMember } from "@/lib/current-member";
import { requireAdmin } from "@/lib/authorization";
import { hashAccessCode, isValidAccessCodeFormat, normalizeName } from "@/lib/crypto";
import { recordAudit } from "@/lib/audit";

const createMemberSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(200),
  code: z.string().regex(/^\d{4}$/, "Access code must be exactly 4 digits."),
  role: z.enum(["admin", "officer", "member"]),
});

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function createMember(input: {
  fullName: string;
  code: string;
  role: "admin" | "officer" | "member";
}): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireAdmin(actor);

  const parsed = createMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const normalized = normalizeName(parsed.data.fullName);
  const existing = await db.select({ id: members.id }).from(members).where(eq(members.normalizedName, normalized)).limit(1);
  if (existing.length > 0) {
    return { ok: false, error: "A member with this name already exists." };
  }

  const codeHash = await hashAccessCode(parsed.data.code);
  const [created] = await db
    .insert(members)
    .values({
      fullName: parsed.data.fullName,
      normalizedName: normalized,
      codeHash,
      role: parsed.data.role,
      active: true,
    })
    .returning({ id: members.id, fullName: members.fullName, role: members.role });

  if (created) {
    await recordAudit({
      actorId: actor.id,
      action: "member_created",
      entityType: "member",
      entityId: created.id,
      after: { fullName: created.fullName, role: created.role, active: true },
    });
  }

  revalidatePath("/admin/members");
  revalidatePath("/members");
  return { ok: true };
}

export async function setMemberActive(memberId: string, active: boolean): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireAdmin(actor);

  const [before] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!before) return { ok: false, error: "Member not found." };
  if (before.id === actor.id && !active) {
    return { ok: false, error: "You cannot deactivate your own account." };
  }

  await db.update(members).set({ active, updatedAt: new Date() }).where(eq(members.id, memberId));

  await recordAudit({
    actorId: actor.id,
    action: active ? "member_reactivated" : "member_deactivated",
    entityType: "member",
    entityId: memberId,
    before: { active: before.active },
    after: { active },
  });

  revalidatePath("/admin/members");
  revalidatePath("/members");
  return { ok: true };
}

export async function setMemberRole(memberId: string, role: "admin" | "officer" | "member"): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireAdmin(actor);

  const [before] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  if (!before) return { ok: false, error: "Member not found." };

  await db.update(members).set({ role, updatedAt: new Date() }).where(eq(members.id, memberId));

  await recordAudit({
    actorId: actor.id,
    action: "member_role_changed",
    entityType: "member",
    entityId: memberId,
    before: { role: before.role },
    after: { role },
  });

  revalidatePath("/admin/members");
  revalidatePath("/members");
  return { ok: true };
}

export async function resetMemberCode(memberId: string, newCode: string): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireAdmin(actor);

  if (!isValidAccessCodeFormat(newCode)) {
    return { ok: false, error: "Access code must be exactly 4 digits." };
  }

  const [before] = await db.select({ id: members.id }).from(members).where(eq(members.id, memberId)).limit(1);
  if (!before) return { ok: false, error: "Member not found." };

  const codeHash = await hashAccessCode(newCode);
  await db.update(members).set({ codeHash, updatedAt: new Date() }).where(eq(members.id, memberId));

  await recordAudit({
    actorId: actor.id,
    action: "member_code_reset",
    entityType: "member",
    entityId: memberId,
    metadata: { note: "Access code reset by admin. New code not recorded in audit log." },
  });

  revalidatePath("/admin/members");
  return { ok: true };
}

const bulkImportSchema = z.array(
  z.object({
    fullName: z.string().trim().min(1),
    code: z.string().regex(/^\d{4}$/),
    role: z.enum(["admin", "officer", "member"]),
    active: z.boolean(),
  })
);

export async function bulkImportMembers(jsonText: string): Promise<ActionResult & { imported?: number }> {
  const actor = await requireCurrentMember();
  requireAdmin(actor);

  let json: unknown;
  try {
    json = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }

  const parsed = bulkImportSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid member list format." };
  }

  let imported = 0;
  for (const entry of parsed.data) {
    const normalized = normalizeName(entry.fullName);
    const codeHash = await hashAccessCode(entry.code);
    const existing = await db.select({ id: members.id }).from(members).where(eq(members.normalizedName, normalized)).limit(1);

    if (existing[0]) {
      await db
        .update(members)
        .set({ fullName: entry.fullName, codeHash, role: entry.role, active: entry.active, updatedAt: new Date() })
        .where(eq(members.id, existing[0].id));
    } else {
      await db.insert(members).values({
        fullName: entry.fullName,
        normalizedName: normalized,
        codeHash,
        role: entry.role,
        active: entry.active,
      });
    }
    imported += 1;
  }

  await recordAudit({
    actorId: actor.id,
    action: "member_updated",
    entityType: "member",
    metadata: { bulkImportCount: imported },
  });

  revalidatePath("/admin/members");
  revalidatePath("/members");
  return { ok: true, imported };
}
