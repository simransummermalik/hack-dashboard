"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, members, orgSettings, reviewExemptionReasons } from "@/db/schema";
import { requireCurrentMember } from "@/lib/current-member";
import { requireAdmin } from "@/lib/authorization";
import { recordAudit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const categorySchema = z.object({
  kind: z.enum(["task", "idea", "finance"]),
  name: z.string().trim().min(1).max(100),
});

export async function createCategory(input: z.infer<typeof categorySchema>): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireAdmin(actor);

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid category." };

  const [created] = await db
    .insert(categories)
    .values(parsed.data)
    .onConflictDoNothing()
    .returning({ id: categories.id });

  if (!created) return { ok: false, error: "That category already exists." };

  await recordAudit({
    actorId: actor.id,
    action: "category_created",
    entityType: "category",
    entityId: created.id,
    after: parsed.data,
  });

  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function setCategoryActive(categoryId: string, active: boolean): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireAdmin(actor);

  const [before] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!before) return { ok: false, error: "Category not found." };

  await db.update(categories).set({ active }).where(eq(categories.id, categoryId));

  await recordAudit({
    actorId: actor.id,
    action: "category_updated",
    entityType: "category",
    entityId: categoryId,
    before: { active: before.active },
    after: { active },
  });

  revalidatePath("/admin/categories");
  return { ok: true };
}

const exemptionReasonSchema = z.object({
  label: z.string().trim().min(2).max(300),
});

export async function createReviewExemptionReason(input: z.infer<typeof exemptionReasonSchema>): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireAdmin(actor);

  const parsed = exemptionReasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid reason." };

  const [created] = await db.insert(reviewExemptionReasons).values(parsed.data).returning({ id: reviewExemptionReasons.id });

  if (created) {
    await recordAudit({
      actorId: actor.id,
      action: "review_exemption_reason_created",
      entityType: "review_exemption_reason",
      entityId: created.id,
      after: parsed.data,
    });
  }

  revalidatePath("/admin/review-rules");
  return { ok: true };
}

export async function setReviewExemptionReasonActive(id: string, active: boolean): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireAdmin(actor);

  const [before] = await db.select().from(reviewExemptionReasons).where(eq(reviewExemptionReasons.id, id)).limit(1);
  if (!before) return { ok: false, error: "Reason not found." };

  await db.update(reviewExemptionReasons).set({ active }).where(eq(reviewExemptionReasons.id, id));

  await recordAudit({
    actorId: actor.id,
    action: "review_exemption_reason_updated",
    entityType: "review_exemption_reason",
    entityId: id,
    before: { active: before.active },
    after: { active },
  });

  revalidatePath("/admin/review-rules");
  return { ok: true };
}

export async function updateOrgSetting(key: string, value: unknown): Promise<ActionResult> {
  const actor = await requireCurrentMember();
  requireAdmin(actor);

  if (!/^[a-z0-9_]+$/.test(key)) return { ok: false, error: "Invalid setting key." };

  const [before] = await db.select().from(orgSettings).where(eq(orgSettings.key, key)).limit(1);

  await db
    .insert(orgSettings)
    .values({ key, value: value as object, updatedBy: actor.id })
    .onConflictDoUpdate({
      target: orgSettings.key,
      set: { value: value as object, updatedAt: new Date(), updatedBy: actor.id },
    });

  await recordAudit({
    actorId: actor.id,
    action: "settings_updated",
    entityType: "org_setting",
    entityId: undefined,
    before: before?.value,
    after: value,
    metadata: { key },
  });

  revalidatePath("/admin/settings");
  return { ok: true };
}

const announcementSchema = z.object({
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().max(2000),
});

export async function sendAdminAnnouncement(input: z.infer<typeof announcementSchema>): Promise<ActionResult & { recipientCount?: number }> {
  const actor = await requireCurrentMember();
  requireAdmin(actor);

  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid announcement." };

  const activeMembers = await db.select({ id: members.id }).from(members).where(eq(members.active, true));

  await notifyMany(
    activeMembers.map((m) => ({
      memberId: m.id,
      type: "admin_announcement" as const,
      title: parsed.data.title,
      body: parsed.data.body,
      link: "/notifications",
    }))
  );

  await recordAudit({
    actorId: actor.id,
    action: "admin_announcement_sent",
    metadata: { title: parsed.data.title, recipientCount: activeMembers.length },
  });

  return { ok: true, recipientCount: activeMembers.length };
}
