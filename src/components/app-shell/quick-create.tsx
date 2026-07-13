"use client";

import Link from "next/link";
import { Plus, ListTodo, Lightbulb, CalendarPlus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/lib/authorization";

export function QuickCreate({ role }: { role: Role }) {
  const canManageEvents = role === "admin" || role === "officer";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Quick create
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Create new</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/tasks?new=1">
            <ListTodo className="h-4 w-4" /> Task
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/ideas?new=1">
            <Lightbulb className="h-4 w-4" /> Idea
          </Link>
        </DropdownMenuItem>
        {canManageEvents && (
          <DropdownMenuItem asChild>
            <Link href="/meetings?new=1">
              <CalendarPlus className="h-4 w-4" /> Meeting
            </Link>
          </DropdownMenuItem>
        )}
        {canManageEvents && (
          <DropdownMenuItem asChild>
            <Link href="/finance?new=expense">
              <ReceiptText className="h-4 w-4" /> Expense
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
