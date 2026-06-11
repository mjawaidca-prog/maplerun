/**
 * Company onboarding — client-rendered to avoid session cookie race conditions
 * with the Next.js proxy middleware.
 */

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROVINCES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
];

const FREQUENCIES = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Biweekly" },
  { value: "SEMIMONTHLY", label: "Semi-monthly" },
  { value: "MONTHLY", label: "Monthly" },
];

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [defaultProvince, setDefaultProvince] = useState("ON");
  const [payFrequency, setPayFrequency] = useState("BIWEEKLY");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session?.user) {
    router.push("/sign-in");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, defaultProvince, payFrequency }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create company");
      }

      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <span className="text-4xl" role="img" aria-label="Maple leaf">
            🍁
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Set up your company</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;re signed in as <strong>{session.user.email}</strong>. Let&apos;s get your
            payroll account set up.
          </p>
        </div>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Company details</CardTitle>
            <CardDescription>
              This will be your payroll workspace. You can invite team members later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Company name</Label>
                <Input
                  id="name"
                  placeholder="Acme Canadian Inc."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL slug</Label>
                <Input
                  id="slug"
                  placeholder="acme"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  maxLength={50}
                  pattern="[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]"
                />
                <p className="text-xs text-muted-foreground">
                  Letters, numbers, and hyphens. Used in your workspace URL.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultProvince">Default province</Label>
                  <Select value={defaultProvince} onValueChange={(v) => setDefaultProvince(v ?? "ON")}>
                    <SelectTrigger id="defaultProvince">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payFrequency">Pay frequency</Label>
                  <Select value={payFrequency} onValueChange={(v) => setPayFrequency(v ?? "BIWEEKLY")}>
                    <SelectTrigger id="payFrequency">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Creating…" : "Create company"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
