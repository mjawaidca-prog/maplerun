"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEmployee } from "@/lib/actions/employee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

type PayGroup = { id: string; name: string; frequency: string; defaultProvince: string };

type Props = { payGroups: PayGroup[] };

export function EmployeeForm({ payGroups }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      await createEmployee(formData);
      router.push("/employees");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create employee");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/employees" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add employee</h1>
          <p className="text-muted-foreground mt-1">
            Personal information is encrypted at rest. SIN is never logged or exposed.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Personal information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name *</Label>
                <Input id="firstName" name="firstName" required maxLength={100} disabled={submitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name *</Label>
                <Input id="lastName" name="lastName" required maxLength={100} disabled={submitting} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sin">Social Insurance Number (SIN) *</Label>
              <Input id="sin" name="sin" placeholder="123 456 789" required maxLength={11} disabled={submitting} />
              <p className="text-xs text-muted-foreground">Encrypted with AES-256-GCM. Never stored in plaintext.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" disabled={submitting} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" disabled={submitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" disabled={submitting} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Address (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Address line 1</Label>
              <Input id="addressLine1" name="addressLine1" disabled={submitting} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" disabled={submitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <Select name="province">
                  <SelectTrigger id="province">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal code</Label>
                <Input id="postalCode" name="postalCode" maxLength={7} disabled={submitting} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Payroll settings</CardTitle>
            <CardDescription>
              A default TD1 profile and YTD ledger will be created automatically for 2026.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payGroupId">Pay group</Label>
              <Select name="payGroupId">
                <SelectTrigger id="payGroupId">
                  <SelectValue placeholder="Select a pay group…" />
                </SelectTrigger>
                <SelectContent>
                  {payGroups.map((pg) => (
                    <SelectItem key={pg.id} value={pg.id}>
                      {pg.name} ({pg.frequency.toLowerCase()}, {pg.defaultProvince})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Creating…" : "Create employee"}
          </Button>
          <Link href="/employees">
            <Button type="button" variant="outline" size="lg">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
