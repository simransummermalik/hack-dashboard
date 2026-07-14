import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { getFinanceSummary } from "@/lib/queries/finance";
import { listCategories } from "@/lib/queries/categories";
import { listActiveMembers } from "@/lib/queries/members";
import { isOfficerOrAdmin } from "@/lib/authorization";
import { FinanceView } from "@/components/domain/finance-view";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const member = await requireCurrentMemberOrRedirect();
  // Sequential — see src/lib/queries/dashboard.ts for why.
  const data = await getFinanceSummary();
  const categories = await listCategories("finance");
  const members = await listActiveMembers();

  return (
    <FinanceView
      data={data}
      categories={categories}
      members={members}
      currentMemberId={member.id}
      canManage={isOfficerOrAdmin(member)}
    />
  );
}
