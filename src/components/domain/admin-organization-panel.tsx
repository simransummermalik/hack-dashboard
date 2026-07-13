"use client";

import { useState, useTransition } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { updateOrgSetting, sendAdminAnnouncement } from "@/actions/admin-settings";

export function AdminOrganizationPanel({ orgName }: { orgName: string }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(orgName);

  const [announceOpenState, setAnnounceOpenState] = useState({ title: "", body: "" });
  const [isSending, startSending] = useTransition();

  function saveName() {
    startTransition(async () => {
      const result = await updateOrgSetting("org_name", name.trim());
      if (result.ok) toast({ title: "Organization name updated" });
      else toast({ title: "Couldn't update", description: result.error, variant: "destructive" });
    });
  }

  function sendAnnouncement() {
    if (!announceOpenState.title.trim()) return;
    startSending(async () => {
      const result = await sendAdminAnnouncement(announceOpenState);
      if (result.ok) {
        toast({ title: `Announcement sent to ${result.recipientCount ?? 0} member(s)` });
        setAnnounceOpenState({ title: "", body: "" });
      } else {
        toast({ title: "Couldn't send announcement", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Organization branding</CardTitle>
          <CardDescription>Shown in the sidebar and page titles. Requires a redeploy of NEXT_PUBLIC_ORG_NAME for full branding.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label>Organization name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button onClick={saveName} disabled={isPending || !name.trim()}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4" /> Send an announcement
          </CardTitle>
          <CardDescription>Creates an in-app notification for every active member.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={announceOpenState.title}
              onChange={(e) => setAnnounceOpenState((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Meeting time changed"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea
              value={announceOpenState.body}
              onChange={(e) => setAnnounceOpenState((prev) => ({ ...prev, body: e.target.value }))}
              rows={3}
            />
          </div>
          <Button onClick={sendAnnouncement} disabled={isSending || !announceOpenState.title.trim()}>
            {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send announcement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
