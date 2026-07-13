import { eq, and } from "drizzle-orm";
import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireCurrentMemberOrRedirect();

  const unread = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.memberId, member.id), eq(notifications.read, false)));

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={member.role} className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar member={member} unreadCount={unread.length} />
        <main className="flex-1 overflow-y-auto bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
