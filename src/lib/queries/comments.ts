import "server-only";
import { asc, eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { comments, members } from "@/db/schema";
import type { CommentItem } from "@/components/domain/comment-thread";

export async function listCommentsForEntity(
  entityType: "task" | "idea" | "meeting" | "grant" | "expense",
  entityId: string
): Promise<CommentItem[]> {
  const rows = await db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      authorName: members.fullName,
      body: comments.body,
      createdAt: comments.createdAt,
      edited: comments.edited,
    })
    .from(comments)
    .innerJoin(members, eq(comments.authorId, members.id))
    .where(and(eq(comments.entityType, entityType), eq(comments.entityId, entityId)))
    .orderBy(asc(comments.createdAt));

  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
