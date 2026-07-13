import type { Role } from "@/lib/authorization";
import {
  LayoutDashboard,
  KanbanSquare,
  ClipboardCheck,
  Lightbulb,
  CalendarDays,
  Wallet,
  Users,
  Bell,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: KanbanSquare },
  { href: "/reviews", label: "Reviews", icon: ClipboardCheck },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/members", label: "Members", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/audit-log", label: "Activity Log", icon: ScrollText },
  { href: "/admin", label: "Admin Settings", icon: Settings, roles: ["admin"] },
];
