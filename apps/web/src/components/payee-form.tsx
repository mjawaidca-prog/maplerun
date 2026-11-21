"use client";

/**
 * New payee form — individual vs business identity toggle.
 *
 * Mirrors employee-form.tsx (client component, FormData → server action,
 * inline error surface). SIN is optional at capture time (CRA has a zero
 * placeholder for unprovided SINs) but validated when supplied; it is
 * encrypted server-side and never shown again.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPayee } from "@/lib/actions/t4a";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

const inputCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PayeeForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payeeType, setPayeeType] = useState<"INDIVIDUAL" | "BUSINESS">("INDIVIDUAL");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const id = await createPayee(formData);
      router.push(`/payees/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payee");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/payees" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add payee</h1>
          <p className="text-muted-foreground mt-1">
            Non-employee recipients for T4A reporting — contractors, subcontractors, pensioners.
            SIN is encrypted at rest and never exposed.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <input type="hidden" name="payeeType" value={payeeType} />

        <Card>
          <CardHeader>
            <CardTitle>Payee type</CardTitle>
            <CardDescription>
              A T4A slip reports either an individual (name + SIN) or a business (name + BN) — never both.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            {(["INDIVIDUAL", "BUSINESS"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPayeeType(t)}
                className={`rounded-[9px] px-4 py-2 text-sm font-semibold border transition-colors ${
                  payeeType === t
                    ? "bg-[#B3261E] text-white border-[#B3261E]"
                    : "bg-white text-[#57534E] border-[#E7E5E4] hover:border-[#B3261E]"
                }`}
              >
                {t === "INDIVIDUAL" ? "Individual" : "Business / corporation"}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>As it must appear on the T4A slip.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {payeeType === "INDIVIDUAL" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name *</Label>
                  <Input id="firstName" name="firstName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name *</Label>
                  <Input id="lastName" name="lastName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initial">Middle initial</Label>
                  <Input id="initial" name="initial" maxLength={1} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sin">SIN (optional — can be added later)</Label>
                  <Input id="sin" name="sin" placeholder="9 digits" autoComplete="off" />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="businessName">Business / corporation name *</Label>
                  <Input id="businessName" name="businessName" required />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="businessName2">Name line 2</Label>
                  <Input id="businessName2" name="businessName2" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="businessNumber">Recipient business number (BN15)</Label>
              <Input id="businessNumber" name="businessNumber" placeholder="123456789RT0001" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientNumber">Recipient number (code 014)</Label>
              <Input id="recipientNumber" name="recipientNumber" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dentalBenefitsCode">Dental benefits code (box 015)</Label>
              <select id="dentalBenefitsCode" name="dentalBenefitsCode" className={inputCls} defaultValue="">
                <option value="">Not recorded</option>
                <option value="1">1 — Not eligible for dental coverage</option>
                <option value="2">2 — Payee only</option>
                <option value="3">3 — Payee, spouse and dependent children</option>
                <option value="4">4 — Payee and spouse</option>
                <option value="5">5 — Payee and dependent children</option>
              </select>
              <p className="text-xs text-muted-foreground">Required by CRA when the payee receives pension (box 016).</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
            <CardDescription>Printed on the T4A slip and used in the CRA XML.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="addressLine1">Address line 1</Label>
              <Input id="addressLine1" name="addressLine1" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="addressLine2">Address line 2</Label>
              <Input id="addressLine2" name="addressLine2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="province">Province</Label>
              <select id="province" name="province" className={inputCls} defaultValue="">
                <option value="">—</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" name="postalCode" />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} className="bg-[#B3261E] hover:bg-[#8F1D17]">
            {submitting ? "Saving…" : "Add payee"}
          </Button>
          <Link href="/payees">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
