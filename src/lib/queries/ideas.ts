import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, ideaVotes, ideas, members } from "@/db/schema";

export interface IdeaListItem {
  id: string;
  title: string;
  description: string;
  status: string;
  categoryName: string | null;
  submittedById: string;
  submittedByName: string;
  estimatedCostCents: number | null;
  estimatedEffort: string | null;
  proposedTimeline: string | null;
  benefits: string | null;
  risks: string | null;
  voteCount: number;
  voterIds: string[];
  createdAt: string;
}

export async function listIdeas(): Promise<IdeaListItem[]> {
  const rows = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      description: ideas.description,
      status: ideas.status,
      categoryName: categories.name,
      submittedById: ideas.submittedBy,
      submittedByName: members.fullName,
      estimatedCostCents: ideas.estimatedCostCents,
      estimatedEffort: ideas.estimatedEffort,
      proposedTimeline: ideas.proposedTimeline,
      benefits: ideas.benefits,
      risks: ideas.risks,
      createdAt: ideas.createdAt,
    })
    .from(ideas)
    .leftJoin(categories, eq(ideas.categoryId, categories.id))
    .innerJoin(members, eq(ideas.submittedBy, members.id))
    .orderBy(desc(ideas.createdAt));

  if (rows.length === 0) return [];
  const ideaIds = rows.map((r) => r.id);
  const votes = await db.select().from(ideaVotes).where(inArray(ideaVotes.ideaId, ideaIds));

  const votesByIdea = new Map<string, string[]>();
  for (const v of votes) {
    const list = votesByIdea.get(v.ideaId) ?? [];
    list.push(v.memberId);
    votesByIdea.set(v.ideaId, list);
  }

  return rows.map((r) => ({
    ...r,
    voterIds: votesByIdea.get(r.id) ?? [],
    voteCount: (votesByIdea.get(r.id) ?? []).length,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getIdeaDetail(ideaId: string): Promise<IdeaListItem | null> {
  const all = await listIdeas();
  return all.find((i) => i.id === ideaId) ?? null;
}
