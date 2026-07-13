import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  ListTodo,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { getDashboardData } from "@/lib/queries/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/domain/empty-state";
import { TaskStatusBadge } from "@/components/domain/status-badge";
import { PriorityBadge } from "@/components/domain/priority-badge";
import { formatCents } from "@/lib/money";
import { formatDate, isOverdue } from "@/lib/utils";
import { QuickCreate } from "@/components/app-shell/quick-create";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const member = await requireCurrentMemberOrRedirect();
  const data = await getDashboardData(member.id);

  const stats = [
    { label: "My tasks", value: data.myTasks.length, icon: ListTodo, href: "/tasks" },
    { label: "Needs my review", value: data.needsMyReview.length, icon: ClipboardList, href: "/reviews" },
    { label: "Overdue", value: data.overdueTasks.length, icon: AlertTriangle, href: "/tasks" },
    { label: "Blocked on reviews", value: data.blockedByMissingReviews.length, icon: ShieldAlert, href: "/tasks" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {member.fullName.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s what needs your attention today.</p>
        </div>
        <QuickCreate role={member.role} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xl font-semibold leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">My tasks</CardTitle>
              <Link href="/tasks" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {data.myTasks.length === 0 ? (
                <EmptyState icon={ListTodo} title="No tasks assigned to you" description="Create one to get started." />
              ) : (
                <ul className="divide-y">
                  {data.myTasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                      <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium hover:underline">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Due {formatDate(t.dueDate)}
                          {isOverdue(t.dueDate, t.status) && <span className="ml-1 text-destructive">· overdue</span>}
                        </p>
                      </Link>
                      <div className="flex shrink-0 items-center gap-2">
                        <PriorityBadge priority={t.priority} />
                        <TaskStatusBadge status={t.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Needs my review</CardTitle>
              <Link href="/reviews" className="text-xs text-primary hover:underline">
                Review inbox
              </Link>
            </CardHeader>
            <CardContent>
              {data.needsMyReview.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="You're all caught up" description="No tasks are waiting on your review." />
              ) : (
                <ul className="divide-y">
                  {data.needsMyReview.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                      <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium hover:underline">{t.title}</p>
                        <p className="text-xs text-muted-foreground">Created by {t.creatorName}</p>
                      </Link>
                      <TaskStatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {(data.overdueTasks.length > 0 || data.blockedByMissingReviews.length > 0) && (
            <Card className="border-destructive/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Needs attention
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.overdueTasks.map((t) => (
                  <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center justify-between gap-3 text-sm hover:underline">
                    <span className="truncate">{t.title}</span>
                    <Badge variant="destructive">Overdue · {formatDate(t.dueDate)}</Badge>
                  </Link>
                ))}
                {data.blockedByMissingReviews.map((t) => (
                  <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center justify-between gap-3 text-sm hover:underline">
                    <span className="truncate">{t.title}</span>
                    <Badge variant="warning">Blocked on reviews</Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Upcoming meetings</CardTitle>
              <Link href="/meetings" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {data.upcomingMeetings.length === 0 ? (
                <EmptyState icon={CalendarClock} title="No upcoming meetings" />
              ) : (
                <ul className="space-y-3">
                  {data.upcomingMeetings.map((m) => (
                    <li key={m.id}>
                      <Link href={`/meetings/${m.id}`} className="text-sm font-medium hover:underline">
                        {m.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(m.meetingDate)}
                        {m.startTime ? ` · ${m.startTime.slice(0, 5)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Recent ideas</CardTitle>
              <Link href="/ideas" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {data.recentIdeas.length === 0 ? (
                <EmptyState icon={Lightbulb} title="No ideas submitted yet" />
              ) : (
                <ul className="space-y-3">
                  {data.recentIdeas.map((i) => (
                    <li key={i.id}>
                      <Link href={`/ideas/${i.id}`} className="text-sm font-medium hover:underline">
                        {i.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {i.voteCount} vote{i.voteCount === 1 ? "" : "s"} · {i.submittedByName}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4" /> Budget summary
              </CardTitle>
              <Link href="/finance" className="text-xs text-primary hover:underline">
                Finance
              </Link>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total grant funding</span>
                <span className="font-medium">{formatCents(data.financeSummary.totalGrantFundingCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Spent</span>
                <span className="font-medium">{formatCents(data.financeSummary.totalSpentCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Committed</span>
                <span className="font-medium">{formatCents(data.financeSummary.totalCommittedCents)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-semibold">{formatCents(data.financeSummary.totalRemainingCents)}</span>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">Internal planning figures — not formal accounting.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentActivity.length === 0 ? (
                <EmptyState title="No activity yet" />
              ) : (
                <ul className="space-y-2.5 text-sm">
                  {data.recentActivity.map((a) => (
                    <li key={a.id} className="text-muted-foreground">
                      <span className="font-medium text-foreground">{a.actorName}</span> {a.action.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
