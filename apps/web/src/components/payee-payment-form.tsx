"use client";

/**
 * Record-a-payment form (payee detail page) + delete buttons.
 *
 * The payment is TAGGED with its T4A classification here, at payment
 * time — this is the capture point the whole T4A design rests on
 * (DESIGN-TAX-DOMAIN.md §6.1.3). The classification list comes straight
 * from the pure catalogue in lib/filings/t4a-boxes.ts.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordPayeePayment, deletePayeePayment, deletePayee } from "@/lib/actions/t4a";
import { T4A_BOXES } from "@/lib/filings/t4a-boxes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const inputCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PayeePaymentForm({ payeeId }: { payeeId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await recordPayeePayment(formData);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="payeeId" value={payeeId} />
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="paymentDate">Payment date *</Label>
          <Input id="paymentDate" name="paymentDate" type="date" required defaultValue={today} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="boxCode">T4A classification *</Label>
          <select id="boxCode" name="boxCode" className={inputCls} required defaultValue="048">
            {T4A_BOXES.map((b) => (
              <option key={b.code} value={b.code}>
                {b.code} — {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount paid *</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0" required placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="incomeTaxDeducted">Income tax withheld (→ box 022)</Label>
          <Input id="incomeTaxDeducted" name="incomeTaxDeducted" type="number" step="0.01" min="0" defaultValue="0" />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" placeholder="e.g. Invoice 1042 — framing subcontract, October" />
        </div>
      </div>
      <label className="flex items-start gap-2.5 text-sm text-[#57534E] cursor-pointer">
        <input type="checkbox" name="t5018Reportable" className="mt-0.5" />
        <span>
          <b className="text-[#1C1917]">Construction contract payment (T5018)</b> — tag it now;
          T5018 slips are generated from the same tags in a later build.
        </span>
      </label>
      <Button type="submit" disabled={submitting} className="bg-[#B3261E] hover:bg-[#8F1D17]">
        {submitting ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}

export function DeletePayeePaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    if (!window.confirm("Delete this payment? The payee's T4A totals will change.")) return;
    setBusy(true);
    const formData = new FormData();
    formData.set("paymentId", paymentId);
    try {
      await deletePayeePayment(formData);
      router.refresh();
    } catch {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-[13px] font-semibold text-[#B3261E] hover:text-[#8F1D17] disabled:opacity-50"
    >
      {busy ? "…" : "Delete"}
    </button>
  );
}

export function DeletePayeeButton({ payeeId }: { payeeId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    if (!window.confirm("Delete this payee AND all of its recorded payments? This cannot be undone.")) return;
    setBusy(true);
    const formData = new FormData();
    formData.set("payeeId", payeeId);
    try {
      await deletePayee(formData);
      router.push("/payees");
    } catch {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-[13px] font-semibold text-[#B3261E] hover:text-[#8F1D17] disabled:opacity-50"
    >
      {busy ? "Deleting…" : "Delete payee"}
    </button>
  );
}
