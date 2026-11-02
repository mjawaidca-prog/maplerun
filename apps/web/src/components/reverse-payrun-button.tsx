"use client";

import { reversePayRun } from "@/lib/actions/payroll";
import { Undo2 } from "lucide-react";

export function ReversePayRunButton({ id, date, ledgerSyncedAt }: { id: string; date: string; ledgerSyncedAt?: string | null }) {
  const message = ledgerSyncedAt
    ? `This run was posted to LedgerPro on ${ledgerSyncedAt.slice(0, 10)}; reversing it will reverse that journal first.\n\nReverse pay run for ${date}? The run stays on record as REVERSED, its YTD totals are unwound exactly, and it stops counting in reports. This cannot be undone.`
    : `Reverse pay run for ${date}? The run stays on record as REVERSED, its YTD totals are unwound exactly, and it stops counting in reports. This cannot be undone.`;
  return (
    <form action={reversePayRun} className="inline-flex">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#92400E] hover:text-[#78350F] border border-[#FDE68A] bg-[#FFFBEB] hover:bg-[#FEF3C7] rounded-[7px] px-2.5 py-1.5 transition-colors"
        onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}
      >
        <Undo2 className="h-3 w-3" /> Reverse
      </button>
    </form>
  );
}
