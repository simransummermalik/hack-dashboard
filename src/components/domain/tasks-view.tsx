"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskFormDialog } from "@/components/domain/task-form-dialog";
import { TasksBoard } from "@/components/domain/tasks-board";
import { TasksList } from "@/components/domain/tasks-list";
import type { TaskListItem } from "@/lib/queries/tasks";
import type { MemberSummary } from "@/lib/queries/members";
import type { CategoryOption } from "@/lib/queries/categories";

export function TasksView({
  tasks,
  members,
  categories,
  reviewExemptionReasons,
  isAdmin,
}: {
  tasks: TaskListItem[];
  members: MemberSummary[];
  categories: CategoryOption[];
  reviewExemptionReasons: { id: string; label: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateOpen(true);
      router.replace("/tasks");
    }
  }, [searchParams, router]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <TaskFormDialog
          mode="create"
          categories={categories}
          members={members}
          reviewExemptionReasons={reviewExemptionReasons}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      </div>

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>
        <TabsContent value="board">
          <TasksBoard tasks={tasks} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="list">
          <TasksList tasks={tasks} members={members} categories={categories} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
