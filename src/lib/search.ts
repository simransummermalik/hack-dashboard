import "server-only";
import { ilike, or } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses, grants, ideas, meetings, members, tasks } from "@/db/schema";

export interface SearchResult {
  type: "task" | "idea" | "meeting" | "member" | "grant" | "expense";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

/**
 * Global search across the major record types. Server-side only — never
 * exposes more than title/subtitle text, no sensitive fields (e.g. no
 * access codes are stored on these tables at all).
 */
export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const pattern = `%${q}%`;

  const [taskRows, ideaRows, meetingRows, memberRows, grantRows, expenseRows] = await Promise.all([
    db
      .select({ id: tasks.id, title: tasks.title, description: tasks.description, status: tasks.status })
      .from(tasks)
      .where(or(ilike(tasks.title, pattern), ilike(tasks.description, pattern)))
      .limit(8),
    db
      .select({ id: ideas.id, title: ideas.title, description: ideas.description, status: ideas.status })
      .from(ideas)
      .where(or(ilike(ideas.title, pattern), ilike(ideas.description, pattern)))
      .limit(8),
    db
      .select({ id: meetings.id, title: meetings.title, meetingDate: meetings.meetingDate })
      .from(meetings)
      .where(ilike(meetings.title, pattern))
      .limit(8),
    db
      .select({ id: members.id, fullName: members.fullName, role: members.role, active: members.active })
      .from(members)
      .where(ilike(members.fullName, pattern))
      .limit(8),
    db
      .select({ id: grants.id, name: grants.name, fundingOrg: grants.fundingOrg })
      .from(grants)
      .where(or(ilike(grants.name, pattern), ilike(grants.fundingOrg, pattern)))
      .limit(8),
    db
      .select({ id: expenses.id, name: expenses.name })
      .from(expenses)
      .where(ilike(expenses.name, pattern))
      .limit(8),
  ]);

  const results: SearchResult[] = [
    ...taskRows.map((t) => ({
      type: "task" as const,
      id: t.id,
      title: t.title,
      subtitle: `Task · ${t.status.replace(/_/g, " ")}`,
      href: `/tasks/${t.id}`,
    })),
    ...ideaRows.map((i) => ({
      type: "idea" as const,
      id: i.id,
      title: i.title,
      subtitle: `Idea · ${i.status.replace(/_/g, " ")}`,
      href: `/ideas/${i.id}`,
    })),
    ...meetingRows.map((m) => ({
      type: "meeting" as const,
      id: m.id,
      title: m.title,
      subtitle: `Meeting · ${m.meetingDate}`,
      href: `/meetings/${m.id}`,
    })),
    ...memberRows.map((m) => ({
      type: "member" as const,
      id: m.id,
      title: m.fullName,
      subtitle: `Member · ${m.role}${m.active ? "" : " · inactive"}`,
      href: `/members`,
    })),
    ...grantRows.map((g) => ({
      type: "grant" as const,
      id: g.id,
      title: g.name,
      subtitle: `Grant · ${g.fundingOrg}`,
      href: `/finance`,
    })),
    ...expenseRows.map((e) => ({
      type: "expense" as const,
      id: e.id,
      title: e.name,
      subtitle: "Expense",
      href: `/finance`,
    })),
  ];

  return results;
}
