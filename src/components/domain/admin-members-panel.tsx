"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmButton } from "@/components/domain/confirm-button";
import { useToast } from "@/components/ui/use-toast";
import { createMember, setMemberActive, setMemberRole, resetMemberCode, bulkImportMembers } from "@/actions/members";
import { ROLE_LABELS } from "@/lib/constants";
import type { MemberDirectoryEntry } from "@/lib/queries/members";

export function AdminMembersPanel({ members }: { members: MemberDirectoryEntry[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "officer" | "member">("member");
  const [addError, setAddError] = useState<string | null>(null);

  const [resetTarget, setResetTarget] = useState<MemberDirectoryEntry | null>(null);
  const [resetCode, setResetCode] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  const [importText, setImportText] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  function submitAdd() {
    setAddError(null);
    startTransition(async () => {
      const result = await createMember({ fullName: newName, code: newCode, role: newRole });
      if (result.ok) {
        setAddOpen(false);
        setNewName("");
        setNewCode("");
        setNewRole("member");
        toast({ title: "Member added" });
        router.refresh();
      } else {
        setAddError(result.error ?? "Something went wrong.");
      }
    });
  }

  function submitReset() {
    if (!resetTarget) return;
    setResetError(null);
    startTransition(async () => {
      const result = await resetMemberCode(resetTarget.id, resetCode);
      if (result.ok) {
        setResetTarget(null);
        setResetCode("");
        toast({ title: `Access code reset for ${resetTarget.fullName}` });
      } else {
        setResetError(result.error ?? "Something went wrong.");
      }
    });
  }

  async function toggleActive(m: MemberDirectoryEntry) {
    const result = await setMemberActive(m.id, !m.active);
    if (result.ok) router.refresh();
    return result;
  }

  function changeRole(m: MemberDirectoryEntry, role: "admin" | "officer" | "member") {
    startTransition(async () => {
      const result = await setMemberRole(m.id, role);
      if (result.ok) router.refresh();
      else toast({ title: "Couldn't update role", description: result.error, variant: "destructive" });
    });
  }

  function submitImport() {
    startTransition(async () => {
      const result = await bulkImportMembers(importText);
      if (result.ok) {
        toast({ title: `Imported ${result.imported ?? 0} member(s)` });
        setImportOpen(false);
        setImportText("");
        router.refresh();
      } else {
        toast({ title: "Import failed", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Bulk import (JSON)
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk import members</DialogTitle>
              <DialogDescription>
                Paste an array of {`{ fullName, code, role, active }`} objects. Codes are hashed before saving —
                nothing is stored in plain text.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              rows={10}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='[{"fullName":"Jane Doe","code":"1234","role":"member","active":true}]'
              className="font-mono text-xs"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitImport} disabled={isPending || !importText.trim()}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a member</DialogTitle>
              <DialogDescription>Assign a full name and a unique 4-digit access code.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>4-digit access code</Label>
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  maxLength={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as typeof newRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="officer">Officer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {addError && <p className="text-sm text-destructive">{addError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitAdd} disabled={isPending || !newName.trim() || newCode.length !== 4}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add member
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-4 py-2.5 font-medium">{m.fullName}</td>
                <td className="px-4 py-2.5">
                  <Select value={m.role} onValueChange={(v) => changeRole(m, v as typeof m.role)} disabled={isPending}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="officer">Officer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={m.active ? "success" : "secondary"}>{m.active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setResetTarget(m);
                        setResetCode("");
                        setResetError(null);
                      }}
                    >
                      <KeyRound className="h-3.5 w-3.5" /> Reset code
                    </Button>
                    <ConfirmButton
                      variant="outline"
                      size="sm"
                      title={m.active ? "Deactivate member?" : "Reactivate member?"}
                      description={
                        m.active
                          ? `${m.fullName} will lose access. Their historical reviews and records remain visible.`
                          : `${m.fullName} will regain access with their existing role.`
                      }
                      confirmLabel={m.active ? "Deactivate" : "Reactivate"}
                      onConfirm={() => toggleActive(m)}
                      successMessage={m.active ? "Member deactivated" : "Member reactivated"}
                    >
                      {m.active ? "Deactivate" : "Reactivate"}
                    </ConfirmButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset access code</DialogTitle>
            <DialogDescription>Set a new 4-digit code for {resetTarget?.fullName}. Share it with them directly.</DialogDescription>
          </DialogHeader>
          <Input
            value={resetCode}
            onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            placeholder="New 4-digit code"
          />
          {resetError && <p className="text-sm text-destructive">{resetError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitReset} disabled={isPending || resetCode.length !== 4}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
