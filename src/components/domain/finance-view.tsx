"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/domain/empty-state";
import { GrantStatusBadge, ExpenseStatusBadge } from "@/components/domain/status-badge";
import { GrantFormDialog } from "@/components/domain/grant-form-dialog";
import { ExpenseFormDialog } from "@/components/domain/expense-form-dialog";
import { ExpenseStatusControl } from "@/components/domain/expense-status-control";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type { getFinanceSummary } from "@/lib/queries/finance";
import type { CategoryOption } from "@/lib/queries/categories";
import type { MemberSummary } from "@/lib/queries/members";

type FinanceData = Awaited<ReturnType<typeof getFinanceSummary>>;

export function FinanceView({
  data,
  categories,
  members,
  currentMemberId,
  canManage,
}: {
  data: FinanceData;
  categories: CategoryOption[];
  members: MemberSummary[];
  currentMemberId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createExpenseOpen, setCreateExpenseOpen] = useState(false);

  useEffect(() => {
    const newParam = searchParams.get("new");
    if (newParam === "expense") {
      setCreateExpenseOpen(true);
      router.replace("/finance");
    }
  }, [searchParams, router]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
        {canManage && (
          <div className="flex gap-2">
            <ExpenseFormDialog
              mode="create"
              grants={data.grants}
              categories={categories}
              members={members}
              currentMemberId={currentMemberId}
              open={createExpenseOpen}
              onOpenChange={setCreateExpenseOpen}
            />
            <GrantFormDialog mode="create" />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Figures below are internal planning and tracking information, not formal accounting.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total grant funding" value={data.summary.totalGrantFundingCents} />
        <SummaryCard label="Spent" value={data.summary.totalSpentCents} />
        <SummaryCard label="Committed" value={data.summary.totalCommittedCents} />
        <SummaryCard label="Remaining" value={data.summary.totalRemainingCents} highlight />
      </div>

      {(data.grantsApproachingDeadline.length > 0 || data.upcomingExpenses.length > 0) && (
        <Card className="border-warning/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" /> Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.grantsApproachingDeadline.map((g) => (
              <p key={g.id}>
                <span className="font-medium">{g.name}</span> spending deadline is {formatDate(g.spendingDeadline)}.
              </p>
            ))}
            {data.upcomingExpenses.slice(0, 5).map((e) => (
              <p key={e.id}>
                <span className="font-medium">{e.name}</span> ({formatCents(e.amountCents)}) expected {formatDate(e.expenseDate)}.
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Spending by category</CardTitle>
        </CardHeader>
        <CardContent>
          {data.spendingByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No spending recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {data.spendingByCategory
                .sort((a, b) => b.cents - a.cents)
                .map((c) => (
                  <div key={c.category} className="flex items-center justify-between text-sm">
                    <span>{c.category}</span>
                    <span className="font-medium">{formatCents(c.cents)}</span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="grants">
        <TabsList>
          <TabsTrigger value="grants">Grants</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>
        <TabsContent value="grants" className="space-y-3">
          {data.grants.length === 0 ? (
            <EmptyState icon={Wallet} title="No grants yet" />
          ) : (
            data.grants.map((g) => (
              <Card key={g.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.fundingOrg}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <GrantStatusBadge status={g.status} />
                      {canManage && (
                        <GrantFormDialog
                          mode="edit"
                          grant={g}
                          trigger={
                            <button className="text-xs text-primary hover:underline">Edit</button>
                          }
                        />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                    <span>Awarded: {formatCents(g.totalAwardedCents)}</span>
                    <span>Spent: {formatCents(g.spentCents)}</span>
                    <span>Committed: {formatCents(g.committedCents)}</span>
                    <span className={g.remainingCents < 0 ? "font-medium text-destructive" : ""}>
                      Remaining: {formatCents(g.remainingCents)}
                    </span>
                  </div>
                  {g.spendingDeadline && <p className="text-xs text-muted-foreground">Deadline: {formatDate(g.spendingDeadline)}</p>}
                  {g.restrictions && <p className="text-xs text-muted-foreground">Restrictions: {g.restrictions}</p>}
                  {g.links.length > 0 && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      {g.links.map((l) => (
                        <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                          {l.label}
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="expenses">
          {data.expenses.length === 0 ? (
            <EmptyState icon={Wallet} title="No expenses recorded yet" />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Grant</th>
                    <th className="px-4 py-2.5 font-medium">Requested by</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">{e.name}</td>
                      <td className="px-4 py-2.5">{formatCents(e.amountCents)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(e.expenseDate)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{e.grantName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{e.requestedByName}</td>
                      <td className="px-4 py-2.5">
                        {canManage ? <ExpenseStatusControl expenseId={e.id} status={e.status} /> : <ExpenseStatusBadge status={e.status} />}
                        {!e.approvedByName && e.status === "awaiting_approval" && (
                          <p className="mt-1 text-[10px] text-warning-foreground">Missing approval</p>
                        )}
                        {!e.receiptUrl && (e.status === "purchased" || e.status === "reimbursed") && (
                          <p className="mt-1 text-[10px] text-warning-foreground">Missing documentation</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.receiptUrl ? (
                          <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold ${highlight && value < 0 ? "text-destructive" : ""}`}>{formatCents(value)}</p>
      </CardContent>
    </Card>
  );
}
