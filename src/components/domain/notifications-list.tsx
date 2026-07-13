"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/domain/empty-state";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime, cn } from "@/lib/utils";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationsList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const unreadCount = notifications.filter((n) => !n.read).length;

  function markRead(id: string) {
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  if (notifications.length === 0) {
    return <EmptyState icon={Bell} title="No notifications yet" description="You'll see task assignments, review requests, and more here." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={markAll} disabled={isPending || unreadCount === 0}>
          <CheckCheck className="h-4 w-4" /> Mark all as read
        </Button>
      </div>
      <ul className="divide-y rounded-lg border bg-card">
        {notifications.map((n) => {
          const content = (
            <div className={cn("flex items-start justify-between gap-3 p-4", !n.read && "bg-accent/40")}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <Badge variant="outline" className="text-[10px]">
                    {NOTIFICATION_TYPE_LABELS[n.type] ?? n.type}
                  </Badge>
                </div>
                <p className="mt-1 text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
              </div>
              {!n.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    markRead(n.id);
                  }}
                >
                  Mark read
                </Button>
              )}
            </div>
          );

          return (
            <li key={n.id}>
              {n.link ? (
                <Link href={n.link} onClick={() => !n.read && markRead(n.id)} className="block hover:bg-accent/60">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
