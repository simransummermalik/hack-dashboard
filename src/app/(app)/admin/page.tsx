import { requireCurrentMemberOrRedirect } from "@/lib/current-member";
import { requireAdmin } from "@/lib/authorization";
import { getMemberDirectory } from "@/lib/queries/members";
import { listCategories, listReviewExemptionReasons } from "@/lib/queries/categories";
import { getOrgSetting } from "@/lib/queries/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminMembersPanel } from "@/components/domain/admin-members-panel";
import { AdminCategoriesPanel } from "@/components/domain/admin-categories-panel";
import { AdminReviewRulesPanel } from "@/components/domain/admin-review-rules-panel";
import { AdminOrganizationPanel } from "@/components/domain/admin-organization-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const member = await requireCurrentMemberOrRedirect();
  requireAdmin(member);

  // Sequential rather than Promise.all — see src/lib/queries/dashboard.ts
  // for why: the Supabase pooler on this project's compute tier can't
  // reliably handle many concurrent query chains from one request.
  const directory = await getMemberDirectory();
  const taskCategories = await listCategories("task", false);
  const ideaCategories = await listCategories("idea", false);
  const financeCategories = await listCategories("finance", false);
  const exemptionReasons = await listReviewExemptionReasons(false);
  const orgName = await getOrgSetting("org_name", process.env.NEXT_PUBLIC_ORG_NAME || "HAVK");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin settings</h1>
        <p className="text-sm text-muted-foreground">Manage members, categories, review rules, and organization branding.</p>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="review-rules">Review rules</TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <AdminMembersPanel members={directory} />
        </TabsContent>
        <TabsContent value="categories">
          <AdminCategoriesPanel taskCategories={taskCategories} ideaCategories={ideaCategories} financeCategories={financeCategories} />
        </TabsContent>
        <TabsContent value="review-rules">
          <AdminReviewRulesPanel reasons={exemptionReasons} />
        </TabsContent>
        <TabsContent value="organization">
          <AdminOrganizationPanel orgName={String(orgName)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
