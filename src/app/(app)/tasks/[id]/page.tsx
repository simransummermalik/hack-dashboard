import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { getTaskDetail } from "@/lib/queries/tasks";
import { listActiveMembers } from "@/lib/queries/members";
import { listCategories } from "@/lib/queries/categories";
import { listCommentsForEntity } from "@/lib/queries/comments";
import { listActivityForEntity } from "@/lib/queries/audit";
import { canEditTask } from "@/lib/authorization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TaskStatusBadge } from "@/components/domain/status-badge";
import { PriorityBadge } from "@/components/domain/priority-badge";
import { MemberAvatar } from "@/components/domain/member-avatar";
import { TaskFormDialog } from "@/components/domain/task-form-dialog";
import { TaskStatusControl } from "@/components/domain/task-status-control";
import { TaskReviewPanel } from "@/components/domain/task-review-panel";
import { CommentThread } from "@/components/domain/comment-thread";
import { ActivityFeed } from "@/components/domain/activity-feed";
import { formatDate, formatDateTime, isOverdue } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const member = await requireCurrentMemberOrRedirect();
  const task = await getTaskDetail(params.id);
  if (!task) notFound();

  // Sequential — see src/lib/queries/dashboard.ts for why.
  const members = await listActiveMembers();
  const categories = await listCategories("task");
  const comments = await listCommentsForEntity("task", task.id);
  const activity = await listActivityForEntity("task", task.id);

  const canEdit = canEditTask(member, { creatorId: task.creatorId, assigneeIds: task.assigneeIds });

  return (
    <div className="space-y-6">
      <Link href="/tasks" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
            <PriorityBadge priority={task.priority} />
            <TaskStatusBadge status={task.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Created by {task.creatorName} on {formatDate(task.createdAt)} · Updated {formatDateTime(task.updatedAt)}
          </p>
          {task.sourceIdeaId && (
            <Link href={`/ideas/${task.sourceIdeaId}`} className="text-xs text-primary hover:underline">
              Converted from an idea
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <TaskStatusControl
                taskId={task.id}
                status={task.status}
                reviewSummary={task.reviewSummary}
                reviewExempt={task.reviewExempt}
                isAdmin={member.role === "admin"}
              />
              <TaskFormDialog
                mode="edit"
                task={task}
                categories={categories}
                members={members}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                }
              />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{task.description || "No description provided."}</p>
              {task.links.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Links</p>
                  {task.links.map((l) => (
                    <a
                      key={l.id}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> {l.label}
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Member reviews</CardTitle>
            </CardHeader>
            <CardContent>
              {task.reviewExempt ? (
                <p className="text-sm text-muted-foreground">This task is exempt from mandatory member review.</p>
              ) : (
                <TaskReviewPanel
                  taskId={task.id}
                  reviews={task.reviews}
                  summary={task.reviewSummary}
                  currentMemberId={member.id}
                  isAdmin={member.role === "admin"}
                  allMembers={members}
                />
              )}
              {task.completionOverrideReason && (
                <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                  <p className="font-medium">Review requirement was overridden</p>
                  <p className="text-muted-foreground">&ldquo;{task.completionOverrideReason}&rdquo;</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentThread
                entityType="task"
                entityId={task.id}
                comments={comments}
                currentMemberId={member.id}
                memberNames={members.map((m) => m.fullName)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span>{task.categoryName ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due date</span>
                <span className={isOverdue(task.dueDate, task.status) ? "font-medium text-destructive" : ""}>
                  {formatDate(task.dueDate)}
                </span>
              </div>
              <Separator />
              <div>
                <p className="mb-2 text-muted-foreground">Assignees</p>
                {task.assigneeNames.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Unassigned</p>
                ) : (
                  <div className="space-y-2">
                    {task.assigneeNames.map((name) => (
                      <div key={name} className="flex items-center gap-2">
                        <MemberAvatar fullName={name} size="sm" showTooltip={false} />
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Activity history</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed entries={activity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
