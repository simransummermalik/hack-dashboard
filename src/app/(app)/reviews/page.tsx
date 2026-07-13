import Link from "next/link";
import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { listPendingReviewsForMember, listOrgWideMissingReviews } from "@/lib/queries/reviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskStatusBadge } from "@/components/domain/status-badge";
import { PriorityBadge } from "@/components/domain/priority-badge";
import { EmptyState } from "@/components/domain/empty-state";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const member = await requireCurrentMemberOrRedirect();
  const myReviews = await listPendingReviewsForMember(member.id);
  const canSeeOrgWide = member.role === "admin" || member.role === "officer";
  const orgWide = canSeeOrgWide ? await listOrgWideMissingReviews() : [];

  const byMember = new Map<string, { memberName: string; tasks: typeof orgWide }>();
  for (const row of orgWide) {
    const entry = byMember.get(row.memberId) ?? { memberName: row.memberName, tasks: [] };
    entry.tasks.push(row);
    byMember.set(row.memberId, entry);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">My review inbox</TabsTrigger>
          {canSeeOrgWide && <TabsTrigger value="orgwide">Organization-wide missing reviews</TabsTrigger>}
        </TabsList>

        <TabsContent value="inbox">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Needs your review ({myReviews.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {myReviews.length === 0 ? (
                <EmptyState icon={ClipboardCheck} title="You're all caught up" description="Nothing is waiting on your review." />
              ) : (
                <ul className="divide-y">
                  {myReviews.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div>
                        <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">
                          {t.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Created by {t.creatorName} · Due {formatDate(t.dueDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={t.priority} />
                        <TaskStatusBadge status={t.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canSeeOrgWide && (
          <TabsContent value="orgwide">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Missing reviews by member</CardTitle>
              </CardHeader>
              <CardContent>
                {byMember.size === 0 ? (
                  <EmptyState icon={ShieldCheck} title="No missing reviews" description="Every active member is caught up." />
                ) : (
                  <div className="space-y-5">
                    {Array.from(byMember.entries()).map(([memberId, entry]) => (
                      <div key={memberId}>
                        <p className="mb-2 text-sm font-semibold">
                          {entry.memberName} <span className="font-normal text-muted-foreground">({entry.tasks.length} pending)</span>
                        </p>
                        <ul className="space-y-1 pl-3">
                          {entry.tasks.map((t) => (
                            <li key={t.taskId}>
                              <Link href={`/tasks/${t.taskId}`} className="text-sm text-primary hover:underline">
                                {t.taskTitle}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
