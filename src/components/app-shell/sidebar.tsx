"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-config";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/authorization";

const orgName = process.env.NEXT_PUBLIC_ORG_NAME || "HAVK";

export function Sidebar({ role, className }: { role: Role; className?: string }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <nav className={cn("flex h-full w-60 flex-col gap-1 border-r bg-card px-3 py-4", className)}>
      <Link href="/dashboard" className="mb-4 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-havk text-sm font-bold text-havk-foreground">
          {orgName.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-base font-semibold tracking-tight">{orgName}</span>
      </Link>

      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
