"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { commentMentions, comments, members, tasks, ideas, meetings, grants, expenses } from "@/db/schema";
import { requireCurrentMember } from "@/lib/current-member";
import { AuthorizationError, requireCanEditOwnedRecord, requireMember } from "@/lib/authorization";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { extractMentions } from "@/lib/utils";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const entityTypes = ["task", "idea", "meeting", "grant", "expense"] as const;
type EntityType = (typeof entityTypes)[number];

const commentSchema = z.object({
  entityType: z.enum(entityTypes),
  entityId: z.string().uuid(),
  body: z.string().trim().min(1, "Comment cannot be empty.").max(5000),
});

function entityPath(entityType: EntityType, entityId: string): string {
  switch (entityType) {
    case "task":
      return `/tasks/${entityId}`;
    case "idea":
      return `/ideas/${entityId}`;
    case "meeting":
      return `/meetings/${entityId}`;
    case "grant":
    case "expense":
      return `/finance`;
  }
}

/** Looks up the record's title (for notification text) and the member who should be notified of new comments. */
async function lookupEntityOwner(
  entityType: EntityType,
  entityId: string
): Promise<{ title: string; ownerId: string | null } | null> {
  switch (entityType) {
    case "task": {
      const [row] = await db.select({ title: tasks.title, ownerId: tasks.creatorId }).from(tasks).where(eq(tasks.id, entityId)).limit(1);
      return row ?? null;
    }
    case "idea": {
      const [row] = await db.select({ title: ideas.title, ownerId: ideas.submittedBy }).from(ideas).where(eq(ideas.id, entityId)).limit(1);
      return row ?? null;
    }
    case "meeting": {
      const [row] = await db.select({ title: meetings.title, ownerId: meetings.organizerId }).from(meetings).where(eq(meetings.id, entityId)).limit(1);
      return row ?? null;
    }
    case "grant": {
      const [row] = await db.select({ title: grants.name, ownerId: grants.createdBy }).from(grants).where(eq(grants.id, entityId)).limit(1);
      return row ?? null;
    }
    case "expense": {
      const [row] = await db.select({ title: expenses.name, ownerId: expenses.requestedBy }).from(expenses).where(eq(expenses.id, entityId)).limit(1);
      return row ?? null;
    }
  }
}

export async function addComment(input: z.infer<typeof commentSchema>): Promise<ActionResult & { commentId?: string }> {
  const actor = await requireCurrentMember();
  requireMember(actor);

  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid comment." };
  const { entityType, entityId, body } = parsed.data;

  const entity = await lookupEntityOwner(entityType, entityId);
  if (!entity) return { ok: false, error: "Record not found." };

  const [created] = await db
    .insert(comments)
    .values({ entityType, entityId, authorId: actor.id, body })
    .returning({ id: comments.id });
  if (!created) return { ok: false, error: "Failed to add comment." };

  const activeMembers = await db.select({ id: members.id, fullName: members.fullName }).from(members).where(eq(members.active, true));
  const mentionedNames = extractMentions(body, activeMembers.map((m) => m.fullName));
  const mentionedMembers = activeMembers.filter((m) => mentionedNames.includes(m.fullName));

  if (mentionedMembers.length > 0) {
    await db.insert(commentMentions).values(mentionedMembers.map((m) => ({ commentId: created.id, memberId: m.id })));
    await Promise.all(
      mentionedMembers
        .filter((m) => m.id !== actor.id)
        .map((m) =>
          notify({
            memberId: m.id,
            type: "mention",
            title: `${actor.fullName} mentioned you`,
            body: body.slice(0, 200),
            link: entityPath(entityType, entityId),
            entityType,
            entityId,
          })
        )
    );
  }

  const mentionedIds = new Set(mentionedMembers.map((m) => m.id));
  if (entity.ownerId && entity.ownerId !== actor.id && !mentionedIds.has(entity.ownerId)) {
    await notify({
      memberId: entity.ownerId,
      type: "comment_added",
      title: `New comment on "${entity.title}"`,
      body: body.slice(0, 200),
      link: entityPath(entityType, entityId),
      entityType,
      entityId,
    });
  }

  await recordAudit({
    actorId: actor.id,
    action: "comment_created",
    entityType,
    entityId,
    metadata: { commentId: created.id },
  });

  revalidatePath(entityPath(entityType, entityId));
  return { ok: true, commentId: created.id };
}

const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export async function updateComment(commentId: string, input: z.infer<typeof updateCommentSchema>): Promise<ActionResult> {
  const actor = await requireCurrentMember();

  const [comment] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (!comment) return { ok: false, error: "Comment not found." };

  try {
    requireCanEditOwnedRecord(actor, comment.authorId);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: err.message };
    throw err;
  }

  const parsed = updateCommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid comment." };

  await db
    .update(comments)
    .set({ body: parsed.data.body, edited: true, updatedAt: new Date() })
    .where(eq(comments.id, commentId));

  await recordAudit({
    actorId: actor.id,
    action: "comment_updated",
    entityType: comment.entityType,
    entityId: comment.entityId,
    metadata: { commentId },
  });

  revalidatePath(entityPath(comment.entityType as EntityType, comment.entityId));
  return { ok: true };
}
