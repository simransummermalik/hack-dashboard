"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskStatusBadge } from "@/components/domain/status-badge";
import { PriorityBadge } from "@/components/domain/priority-badge";
import { EmptyState } from "@/components/domain/empty-state";
import { Search, ListFilter } from "lucide-react";
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/constants";
import { formatDate, isOverdue, cn } from "@/lib/utils";
import type { TaskListItem } from "@/lib/queries/tasks";
import type { MemberSummary } from "@/lib/queries/members";
import type { CategoryOption } from "@/lib/queries/categories";

const ALL = "__all__";

export function TasksList({
  tasks,
  members,
  categories,
}: {
  tasks: TaskListItem[];
  members: MemberSummary[];
  categories: CategoryOption[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [assignee, setAssignee] = useState(ALL);
  const [creator, setCreator] = useState(ALL);
  const [reviewStatus, setReviewStatus] = useState(ALL);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (status !== ALL && t.status !== status) return false;
      if (priority !== ALL && t.priority !== priority) return false;
      if (category !== ALL && t.categoryName !== category) return false;
      if (assignee !== ALL && !t.assigneeIds.includes(assignee)) return false;
      if (creator !== ALL && t.creatorId !== creator) return false;
      if (reviewStatus === "complete" && !t.reviewSummary.canComplete) return false;
      if (reviewStatus === "incomplete" && t.reviewSummary.canComplete) return false;
      return true;
    });
  }, [tasks, search, status, priority, category, assignee, creator, reviewStatus]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All priorities</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any assignee</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={creator} onValueChange={setCreator}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Creator" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any creator</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reviewStatus} onValueChange={setReviewStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Review status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any review status</SelectItem>
            <SelectItem value="complete">Reviews complete</SelectItem>
            <SelectItem value="incomplete">Reviews incomplete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ListFilter} title="No tasks match these filters" />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Priority</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Assignees</th>
                <th className="px-4 py-2.5 font-medium">Creator</th>
                <th className="px-4 py-2.5 font-medium">Due</th>
                <th className="px-4 py-2.5 font-medium">Reviews</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-accent/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5"><TaskStatusBadge status={t.status} /></td>
                  <td className="px-4 py-2.5"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.categoryName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.assigneeNames.join(", ") || "Unassigned"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.creatorName}</td>
                  <td className={cn("px-4 py-2.5", isOverdue(t.dueDate, t.status) ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {formatDate(t.dueDate)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.reviewSummary.total > 0 ? `${t.reviewSummary.completed}/${t.reviewSummary.total}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
