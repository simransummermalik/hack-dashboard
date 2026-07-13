import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { listTasksWithContext } from "@/lib/queries/tasks";
import { listActiveMembers } from "@/lib/queries/members";
import { listCategories } from "@/lib/queries/categories";
import { listReviewExemptionReasons } from "@/lib/queries/categories";
import { TasksView } from "@/components/domain/tasks-view";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const member = await requireCurrentMemberOrRedirect();
  const [tasks, members, categories, exemptionReasons] = await Promise.all([
    listTasksWithContext(),
    listActiveMembers(),
    listCategories("task"),
    listReviewExemptionReasons(),
  ]);

  return (
    <TasksView
      tasks={tasks}
      members={members}
      categories={categories}
      reviewExemptionReasons={exemptionReasons.map((r) => ({ id: r.id, label: r.label }))}
      isAdmin={member.role === "admin"}
    />
  );
}
