"use server";

import { requireCurrentMember } from "@/lib/current-member";
import { globalSearch, type SearchResult } from "@/lib/search";

export async function searchAction(query: string): Promise<SearchResult[]> {
  await requireCurrentMember();
  return globalSearch(query);
}
