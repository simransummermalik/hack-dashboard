"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { searchAction } from "@/actions/search";
import type { SearchResult } from "@/lib/search";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  task: "Task",
  idea: "Idea",
  meeting: "Meeting",
  member: "Member",
  grant: "Grant",
  expense: "Expense",
};

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchAction(query);
        setResults(res);
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <Popover open={open && results.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {isPending && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search tasks, ideas, meetings, members..."
            className="pl-8 pr-8"
            aria-label="Global search"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-[420px] max-h-96 overflow-y-auto p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
        {results.map((r) => (
          <button
            key={`${r.type}-${r.id}`}
            onClick={() => go(r.href)}
            className={cn(
              "flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
            )}
          >
            <span className="font-medium">{r.title}</span>
            <span className="text-xs text-muted-foreground">
              {TYPE_LABELS[r.type]}
              {r.subtitle ? ` · ${r.subtitle.replace(/^\w+ · /, "")}` : ""}
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
