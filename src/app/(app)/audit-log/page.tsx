import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { listFullAuditLog, listRecentActivity } from "@/lib/queries/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityFeed } from "@/components/domain/activity-feed";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const member = await requireCurrentMemberOrRedirect();
  const isAdmin = member.role === "admin";

  if (!isAdmin) {
    const entries = await listRecentActivity(50);
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Activity log</h1>
        <p className="text-sm text-muted-foreground">
          Recent activity across tasks, ideas, meetings, and finance records. Admins can view the complete audit log,
          including account and security events.
        </p>
        <Card>
          <CardContent className="p-4">
            <ActivityFeed entries={entries} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const entries = await listFullAuditLog(300);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
      <p className="text-sm text-muted-foreground">Complete, immutable record of important actions across the organization.</p>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All events ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Member</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">Record</th>
                  <th className="py-2 pr-4 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                    <td className="py-2 pr-4">{e.actorName ?? "System"}</td>
                    <td className="py-2 pr-4">{e.action.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {e.entityType ? `${e.entityType}${e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ""}` : "—"}
                    </td>
                    <td className="py-2 pr-4 max-w-xs truncate text-xs text-muted-foreground">
                      {e.metadata ? JSON.stringify(e.metadata) : e.after ? JSON.stringify(e.after) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
