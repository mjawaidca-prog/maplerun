/**
 * Company onboarding — shown to users who have authenticated but have no company.
 * Creates a company + owner membership + default pay group in one step.
 */

import { requireSession } from "@/lib/session";
import { createCompany } from "@/lib/actions/company";
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

export default async function OnboardingPage() {
  const user = await requireSession();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <span className="text-4xl" role="img" aria-label="Maple leaf">
            🍁
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Set up your company</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;re signed in as <strong>{user.email}</strong>. Let&apos;s get your
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
            <form action={createCompany} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Company name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Acme Canadian Inc."
                  required
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL slug</Label>
                <Input
                  id="slug"
                  name="slug"
                  placeholder="acme"
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
                  <Select name="defaultProvince" required defaultValue="ON">
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
                  <Select name="payFrequency" required defaultValue="BIWEEKLY">
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

              <Button type="submit" className="w-full" size="lg">
                Create company
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
