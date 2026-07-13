"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { createCategory, setCategoryActive } from "@/actions/admin-settings";
import type { CategoryOption } from "@/lib/queries/categories";

const KINDS = [
  { value: "task", label: "Task categories" },
  { value: "idea", label: "Idea categories" },
  { value: "finance", label: "Financial categories" },
] as const;

export function AdminCategoriesPanel({
  taskCategories,
  ideaCategories,
  financeCategories,
}: {
  taskCategories: CategoryOption[];
  ideaCategories: CategoryOption[];
  financeCategories: CategoryOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState<Record<string, string>>({ task: "", idea: "", finance: "" });

  const byKind: Record<string, CategoryOption[]> = { task: taskCategories, idea: ideaCategories, finance: financeCategories };

  function add(kind: "task" | "idea" | "finance") {
    const name = newName[kind]?.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createCategory({ kind, name });
      if (result.ok) {
        setNewName((prev) => ({ ...prev, [kind]: "" }));
        router.refresh();
      } else {
        toast({ title: "Couldn't add category", description: result.error, variant: "destructive" });
      }
    });
  }

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      const result = await setCategoryActive(id, active);
      if (result.ok) router.refresh();
      else toast({ title: "Couldn't update category", description: result.error, variant: "destructive" });
    });
  }

  return (
    <Tabs defaultValue="task">
      <TabsList>
        {KINDS.map((k) => (
          <TabsTrigger key={k.value} value={k.value}>
            {k.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {KINDS.map((k) => (
        <TabsContent key={k.value} value={k.value} className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="New category name"
              value={newName[k.value] ?? ""}
              onChange={(e) => setNewName((prev) => ({ ...prev, [k.value]: e.target.value }))}
            />
            <Button size="sm" onClick={() => add(k.value)} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
          <ul className="divide-y rounded-lg border bg-card">
            {byKind[k.value]!.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{c.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={c.active ? "success" : "secondary"}>{c.active ? "Active" : "Inactive"}</Badge>
                  <Button variant="ghost" size="sm" disabled={isPending} onClick={() => toggle(c.id, !c.active)}>
                    {c.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </li>
            ))}
            {byKind[k.value]!.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No categories yet.</li>}
          </ul>
        </TabsContent>
      ))}
    </Tabs>
  );
}
