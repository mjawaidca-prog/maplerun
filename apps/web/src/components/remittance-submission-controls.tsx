"use client";

/**
 * Client controls for the Remittances page: the remitter-type selector and
 * the per-period "Mark as submitted" form. Both post to the server actions
 * in lib/actions/remittance.ts — the submitted amount is always computed
 * server-side from the shared aggregation, never sent from here.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markRemittanceSubmitted,
  updateRemitterType,
} from "@/lib/actions/remittance";
import {
  REMITTER_TYPES,
  remitterTypeLabel,
  type RemitterType,
} from "@/lib/remittance/aggregate";

export function RemitterTypeSelector({
  current,
}: {
  current: RemitterType | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const value: RemitterType = current ?? "REGULAR";

  return (
    <form
      className="flex items-end gap-2 print:hidden"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const type = String(fd.get("remitterType") ?? "");
        setError(null);
        startTransition(async () => {
          try {
            await updateRemitterType(type);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save remitter type.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-[5px]">
        <span className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em]">Remitter type</span>
        <select
          name="remitterType"
          defaultValue={value}
          className="border border-[#D6D3D1] rounded-lg px-3 py-2 text-[13px] bg-white"
        >
          {REMITTER_TYPES.map((t) => (
            <option key={t} value={t}>{remitterTypeLabel(t)}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[9px] bg-[#1C1917] hover:bg-[#292524] text-white text-[13px] font-semibold px-4 py-2 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {error && <span className="text-xs text-[#B3261E] pb-2">{error}</span>}
    </form>
  );
}

export function MarkSubmittedControl({ periodKey }: { periodKey: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="inline-flex items-center gap-1.5 justify-end"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const reference = String(fd.get("reference") ?? "").trim();
        setError(null);
        startTransition(async () => {
          try {
            await markRemittanceSubmitted(periodKey, reference || undefined);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not record submission.");
          }
        });
      }}
    >
      <input
        name="reference"
        type="text"
        placeholder="Reference (optional)"
        className="border border-[#D6D3D1] rounded-md px-2 py-1 text-xs w-[130px] bg-white"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[#B3261E] hover:bg-[#9B1C18] text-white text-[11px] font-semibold px-2.5 py-1.5 disabled:opacity-50 whitespace-nowrap"
      >
        {pending ? "Saving…" : "Mark as submitted"}
      </button>
      {error && <span className="text-[11px] text-[#B3261E]">{error}</span>}
    </form>
  );
}
