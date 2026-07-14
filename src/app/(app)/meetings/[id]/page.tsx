import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { getMeetingDetail } from "@/lib/queries/meetings";
import { listActiveMembers } from "@/lib/queries/members";
import { listCommentsForEntity } from "@/lib/queries/comments";
import { isOfficerOrAdmin } from "@/lib/authorization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AttendanceStatusBadge } from "@/components/domain/status-badge";
import { MeetingFormDialog } from "@/components/domain/meeting-form-dialog";
import { MeetingAttendanceControl } from "@/components/domain/meeting-attendance-control";
import { MeetingActionItems } from "@/components/domain/meeting-action-items";
import { MeetingDecisions } from "@/components/domain/meeting-decisions";
import { CommentThread } from "@/components/domain/comment-thread";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const member = await requireCurrentMemberOrRedirect();
  const meeting = await getMeetingDetail(params.id);
  if (!meeting) notFound();

  // Sequential — see src/lib/queries/dashboard.ts for why.
  const members = await listActiveMembers();
  const comments = await listCommentsForEntity("meeting", meeting.id);
  const canManage = isOfficerOrAdmin(member);
  const myAttendance = meeting.attendees.find((a) => a.memberId === member.id)?.status ?? "no_response";

  return (
    <div className="space-y-6">
      <Link href="/meetings" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to meetings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(meeting.meetingDate)}
            {meeting.startTime ? ` · ${meeting.startTime.slice(0, 5)}–${meeting.endTime?.slice(0, 5) ?? ""}` : ""}
            {meeting.location ? ` · ${meeting.location}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">Organized by {meeting.organizerName}</p>
        </div>
        {canManage && (
          <MeetingFormDialog
            mode="edit"
            meeting={meeting}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            }
          />
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <MeetingAttendanceControl meetingId={meeting.id} currentStatus={myAttendance} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Agenda</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{meeting.agenda || "No agenda set."}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{meeting.notes || "No notes yet."}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Decisions</CardTitle>
            </CardHeader>
            <CardContent>
              <MeetingDecisions meetingId={meeting.id} decisions={meeting.decisions} canManage={canManage} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Action items</CardTitle>
            </CardHeader>
            <CardContent>
              <MeetingActionItems
                meetingId={meeting.id}
                actionItems={meeting.actionItems}
                members={members}
                canManage={canManage}
                currentMemberId={member.id}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentThread
                entityType="meeting"
                entityId={meeting.id}
                comments={comments}
                currentMemberId={member.id}
                memberNames={members.map((m) => m.fullName)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {meeting.links.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {meeting.links.map((l) => (
                  <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="block text-sm text-primary hover:underline">
                    {l.label}
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Attendees ({meeting.attendingCount}/{meeting.totalInvited})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {meeting.attendees.map((a) => (
                  <li key={a.memberId} className="flex items-center justify-between text-sm">
                    <span>{a.memberName}</span>
                    <AttendanceStatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
