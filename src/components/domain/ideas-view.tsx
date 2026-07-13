"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IdeaFormDialog } from "@/components/domain/idea-form-dialog";
import { IdeaVoteButton } from "@/components/domain/idea-vote-button";
import { IdeaStatusBadge } from "@/components/domain/status-badge";
import { EmptyState } from "@/components/domain/empty-state";
import { Lightbulb } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { IdeaListItem } from "@/lib/queries/ideas";
import type { CategoryOption } from "@/lib/queries/categories";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "most_voted", label: "Most voted" },
  { value: "lowest_cost", label: "Lowest estimated cost" },
] as const;

const STATUS_FILTERS = [
  { value: "all", label: "All ideas" },
  { value: "approved", label: "Approved" },
  { value: "awaiting_discussion", label: "Awaiting discussion" },
] as const;

export function IdeasView({
  ideas,
  categories,
  currentMemberId,
}: {
  ideas: IdeaListItem[];
  categories: CategoryOption[];
  currentMemberId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("newest");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["value"]>("all");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateOpen(true);
      router.replace("/ideas");
    }
  }, [searchParams, router]);

  const filtered = useMemo(() => {
    let list = [...ideas];
    if (statusFilter === "approved") list = list.filter((i) => i.status === "approved");
    if (statusFilter === "awaiting_discussion") list = list.filter((i) => i.status === "new" || i.status === "discussing");

    if (sort === "most_voted") list.sort((a, b) => b.voteCount - a.voteCount);
    else if (sort === "lowest_cost") list.sort((a, b) => (a.estimatedCostCents ?? Infinity) - (b.estimatedCostCents ?? Infinity));
    else list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return list;
  }, [ideas, sort, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Ideas</h1>
        <IdeaFormDialog mode="create" categories={categories} open={createOpen} onOpenChange={setCreateOpen} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Lightbulb} title="No ideas yet" description="Be the first to submit one." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((idea) => (
            <Card key={idea.id}>
              <CardContent className="flex gap-4 p-4">
                <IdeaVoteButton ideaId={idea.id} voteCount={idea.voteCount} hasVoted={idea.voterIds.includes(currentMemberId)} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/ideas/${idea.id}`} className="font-medium hover:underline">
                      {idea.title}
                    </Link>
                    <IdeaStatusBadge status={idea.status} />
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{idea.description}</p>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>By {idea.submittedByName}</span>
                    {idea.categoryName && <span>{idea.categoryName}</span>}
                    {idea.estimatedCostCents != null && <span>{formatCents(idea.estimatedCostCents)} est.</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
