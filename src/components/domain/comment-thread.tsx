"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/domain/member-avatar";
import { addComment, updateComment } from "@/actions/comments";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTime } from "@/lib/utils";

export interface CommentItem {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  edited: boolean;
}

export function CommentThread({
  entityType,
  entityId,
  comments,
  currentMemberId,
  memberNames,
}: {
  entityType: "task" | "idea" | "meeting" | "grant" | "expense";
  entityId: string;
  comments: CommentItem[];
  currentMemberId: string;
  memberNames: string[];
}) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const { toast } = useToast();

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await addComment({ entityType, entityId, body });
      if (result.ok) {
        setBody("");
      } else {
        toast({ title: "Couldn't post comment", description: result.error, variant: "destructive" });
      }
    });
  }

  function saveEdit(commentId: string) {
    startTransition(async () => {
      const result = await updateComment(commentId, { body: editBody });
      if (result.ok) {
        setEditingId(null);
      } else {
        toast({ title: "Couldn't update comment", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <MemberAvatar fullName={c.authorName} size="sm" showTooltip={false} />
            <div className="flex-1 space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{c.authorName}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                {c.edited && <span className="text-xs text-muted-foreground">(edited)</span>}
                {c.authorId === currentMemberId && editingId !== c.id && (
                  <button
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditBody(c.body);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
              {editingId === c.id ? (
                <div className="space-y-2">
                  <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(c.id)} disabled={isPending}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-foreground/90">{c.body}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t pt-3">
        <Textarea
          placeholder={`Add a comment... use @Full Name to mention someone (e.g. ${memberNames[0] ?? "Jane Doe"})`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={isPending || !body.trim()}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
