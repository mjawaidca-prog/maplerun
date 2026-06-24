"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEmployee } from "@/lib/actions/employee";
import { CANADIAN_BANKS } from "@/lib/canadian-banks";
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
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedPayGroup, setSelectedPayGroup] = useState("");
  const [payType, setPayType] = useState("salary");
  const [payRate, setPayRate] = useState("");
  const [bankTransit, setBankTransit] = useState("");
  const [bankInstitution, setBankInstitution] = useState("");
  const [bankAccount, setBankAccount] = useState("");

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
        <input type="hidden" name="province" value={selectedProvince} />
        <input type="hidden" name="payGroupId" value={selectedPayGroup} />
        <input type="hidden" name="payType" value={payType} />
        <input type="hidden" name="payRate" value={payRate} />
        <input type="hidden" name="bankTransit" value={bankTransit} />
        <input type="hidden" name="bankInstitution" value={bankInstitution} />
        <input type="hidden" name="bankAccount" value={bankAccount} />
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
                <Select value={selectedProvince} onValueChange={(v) => setSelectedProvince(v ?? "")}>
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

        {/* Employment info */}
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">Employment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Pay type</Label>
                <select value={payType} onChange={(e) => setPayType(e.target.value)} className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="salary">Salary</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Pay rate (per period)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input className="pl-7 tabular-nums" type="number" min="0" step="0.01" placeholder="0.00" value={payRate} onChange={(e) => setPayRate(e.target.value)} />
                </div>
              </div>
              <div className="flex items-end pb-2">
                {payRate && <span className="text-xs text-[#78716C]">Annual: ${(parseFloat(payRate||"0") * (payType==="hourly"?2000:26)).toFixed(2)}</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank details */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Bank details (Direct Deposit)</CardTitle>
            <CardDescription>For CPA-005 EFT files. Encrypted at rest.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bank</Label>
              <select
                className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white"
                value={CANADIAN_BANKS.find(b=>b.institution===bankInstitution)?.name ?? "Select bank..."}
                onChange={(e) => {
                  const bank = CANADIAN_BANKS.find(b=>b.name===e.target.value);
                  if (bank) setBankInstitution(bank.institution);
                }}
              >
                {CANADIAN_BANKS.map(b=><option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Transit # (5 digits)</Label>
                <Input maxLength={5} placeholder="12345" value={bankTransit} onChange={(e) => setBankTransit(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Institution #</Label>
                <Input value={bankInstitution} disabled className="bg-[#F5F5F4]" />
              </div>
              <div className="space-y-2">
                <Label>Account #</Label>
                <Input maxLength={12} placeholder="123456789012" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
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
              <Select value={selectedPayGroup} onValueChange={(v) => { setSelectedPayGroup(v ?? ""); if (v) { const pg = payGroups.find(p => p.id === v); if (pg && !selectedProvince) setSelectedProvince(pg.defaultProvince); } }}>
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
