import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { listMeetings } from "@/lib/queries/meetings";
import { isOfficerOrAdmin } from "@/lib/authorization";
import { MeetingsView } from "@/components/domain/meetings-view";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const member = await requireCurrentMemberOrRedirect();
  const meetings = await listMeetings();

  return <MeetingsView meetings={meetings} canCreate={isOfficerOrAdmin(member)} />;
}
