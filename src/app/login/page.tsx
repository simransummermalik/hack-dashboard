"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";

const orgName = process.env.NEXT_PUBLIC_ORG_NAME || "HAVK";

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("fullName", fullName);
    formData.set("code", code);

    startTransition(async () => {
      const result = await login(formData);
      if (result.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.error ?? "Invalid name or access code.");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-havk/10 via-background to-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-havk text-lg font-bold text-havk-foreground shadow-md">
            {orgName.slice(0, 2).toUpperCase()}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{orgName} Dashboard</h1>
          <p className="text-sm text-muted-foreground">Sign in with your name and 4-digit access code.</p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Member sign in</CardTitle>
            <CardDescription>Access codes are assigned by an admin. There is no self-registration.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Name</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  autoComplete="name"
                  placeholder="e.g. Summer"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Use whatever name an admin added you with — often just your first name.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code">4-digit access code</Label>
                <Input
                  id="code"
                  name="code"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  placeholder="••••"
                  maxLength={4}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  required
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isPending || fullName.trim().length === 0 || code.length !== 4}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Forgot your code or need an account? Ask an admin to add or reset your access.
        </p>
      </div>
    </div>
  );
}
