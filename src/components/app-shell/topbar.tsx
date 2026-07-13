import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlobalSearch } from "./global-search";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import { QuickCreate } from "./quick-create";
import type { SessionMember } from "@/lib/session";

export function Topbar({ member, unreadCount }: { member: SessionMember; unreadCount: number }) {
  return (
    <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
      <MobileNav role={member.role} />
      <div className="flex-1">
        <GlobalSearch />
      </div>
      <QuickCreate role={member.role} />
      <Button variant="ghost" size="icon" className="relative" asChild aria-label="Notifications">
        <Link href="/notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Link>
      </Button>
      <UserMenu fullName={member.fullName} role={member.role} />
    </header>
  );
}
