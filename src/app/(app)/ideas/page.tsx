import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { listIdeas } from "@/lib/queries/ideas";
import { listCategories } from "@/lib/queries/categories";
import { IdeasView } from "@/components/domain/ideas-view";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const member = await requireCurrentMemberOrRedirect();
  // Sequential — see src/lib/queries/dashboard.ts for why.
  const ideas = await listIdeas();
  const categories = await listCategories("idea");

  return <IdeasView ideas={ideas} categories={categories} currentMemberId={member.id} />;
}
