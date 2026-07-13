import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { listNotificationsForMember } from "@/lib/queries/notifications";
import { NotificationsList } from "@/components/domain/notifications-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const member = await requireCurrentMemberOrRedirect();
  const notifications = await listNotificationsForMember(member.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      <NotificationsList notifications={notifications} />
    </div>
  );
}
