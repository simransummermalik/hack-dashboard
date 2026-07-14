"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { claimTask } from "@/actions/tasks";
import { useToast } from "@/components/ui/use-toast";

export function ClaimTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function claim() {
    startTransition(async () => {
      const result = await claimTask(taskId);
      if (result.ok) {
        toast({ title: "Task claimed" });
        router.refresh();
      } else {
        toast({ title: "Couldn't claim task", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        claim();
      }}
      disabled={isPending}
    >
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hand className="h-3.5 w-3.5" />}
      Claim
    </Button>
  );
}
