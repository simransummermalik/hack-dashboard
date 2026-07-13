import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { getMemberDirectory } from "@/lib/queries/members";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "@/components/domain/member-avatar";
import { ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  await requireCurrentMemberOrRedirect();
  const directory = await getMemberDirectory();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Member directory</h1>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Member</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Tasks assigned</th>
              <th className="px-4 py-2.5 font-medium">Reviews completed</th>
              <th className="px-4 py-2.5 font-medium">Reviews waiting</th>
            </tr>
          </thead>
          <tbody>
            {directory.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <MemberAvatar fullName={m.fullName} size="sm" showTooltip={false} />
                    <span className="font-medium">{m.fullName}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">{ROLE_LABELS[m.role]}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={m.active ? "success" : "secondary"}>{m.active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{m.tasksAssigned}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{m.reviewsCompleted}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{m.reviewsWaiting}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {directory.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">No members yet.</CardContent>
        </Card>
      )}
    </div>
  );
}
