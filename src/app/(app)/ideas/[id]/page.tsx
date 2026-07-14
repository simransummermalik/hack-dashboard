import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { getIdeaDetail } from "@/lib/queries/ideas";
import { listCategories } from "@/lib/queries/categories";
import { listActiveMembers } from "@/lib/queries/members";
import { listCommentsForEntity } from "@/lib/queries/comments";
import { canEditOwnedRecord, isOfficerOrAdmin } from "@/lib/authorization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IdeaStatusBadge } from "@/components/domain/status-badge";
import { IdeaVoteButton } from "@/components/domain/idea-vote-button";
import { IdeaFormDialog } from "@/components/domain/idea-form-dialog";
import { IdeaConvertDialog } from "@/components/domain/idea-convert-dialog";
import { CommentThread } from "@/components/domain/comment-thread";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function IdeaDetailPage({ params }: { params: { id: string } }) {
  const member = await requireCurrentMemberOrRedirect();
  const idea = await getIdeaDetail(params.id);
  if (!idea) notFound();

  // Sequential — see src/lib/queries/dashboard.ts for why.
  const categories = await listCategories("idea");
  const taskCategories = await listCategories("task");
  const members = await listActiveMembers();
  const comments = await listCommentsForEntity("idea", idea.id);

  const canEdit = canEditOwnedRecord(member, idea.submittedById);
  const canConvert = isOfficerOrAdmin(member);

  return (
    <div className="space-y-6">
      <Link href="/ideas" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to ideas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{idea.title}</h1>
            <IdeaStatusBadge status={idea.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Submitted by {idea.submittedByName} on {formatDate(idea.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IdeaVoteButton ideaId={idea.id} voteCount={idea.voteCount} hasVoted={idea.voterIds.includes(member.id)} />
          {canConvert && <IdeaConvertDialog ideaId={idea.id} ideaTitle={idea.title} categories={taskCategories} members={members} />}
          {canEdit && (
            <IdeaFormDialog
              mode="edit"
              idea={idea}
              categories={categories}
              showStatus={canConvert}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              }
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{idea.description || "No description provided."}</p>
              {idea.benefits && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Benefits</p>
                  <p className="text-sm">{idea.benefits}</p>
                </div>
              )}
              {idea.risks && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Possible risks</p>
                  <p className="text-sm">{idea.risks}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentThread
                entityType="idea"
                entityId={idea.id}
                comments={comments}
                currentMemberId={member.id}
                memberNames={members.map((m) => m.fullName)}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Category</span>
              <span>{idea.categoryName ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated cost</span>
              <span>{idea.estimatedCostCents != null ? formatCents(idea.estimatedCostCents) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated effort</span>
              <span>{idea.estimatedEffort ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Proposed timeline</span>
              <span>{idea.proposedTimeline ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Votes</span>
              <span>{idea.voteCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
