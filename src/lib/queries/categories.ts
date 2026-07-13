import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, reviewExemptionReasons } from "@/db/schema";

export interface CategoryOption {
  id: string;
  name: string;
  active: boolean;
}

export async function listCategories(kind: "task" | "idea" | "finance", activeOnly = true): Promise<CategoryOption[]> {
  const where = activeOnly ? and(eq(categories.kind, kind), eq(categories.active, true)) : eq(categories.kind, kind);
  return db
    .select({ id: categories.id, name: categories.name, active: categories.active })
    .from(categories)
    .where(where)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function listReviewExemptionReasons(activeOnly = true) {
  const where = activeOnly ? eq(reviewExemptionReasons.active, true) : undefined;
  const query = db.select().from(reviewExemptionReasons);
  return where ? query.where(where) : query;
}
