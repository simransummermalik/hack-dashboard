"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleIdeaVote } from "@/actions/ideas";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

export function IdeaVoteButton({ ideaId, voteCount, hasVoted }: { ideaId: string; voteCount: number; hasVoted: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function vote() {
    startTransition(async () => {
      const result = await toggleIdeaVote(ideaId);
      if (result.ok) {
        router.refresh();
      } else {
        toast({ title: "Couldn't vote", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <Button
      variant={hasVoted ? "default" : "outline"}
      size="sm"
      className={cn("flex-col gap-0 px-3 py-1.5 h-auto", isPending && "opacity-60")}
      onClick={vote}
      disabled={isPending}
    >
      <ArrowBigUp className="h-4 w-4" />
      <span className="text-xs font-semibold">{voteCount}</span>
    </Button>
  );
}
