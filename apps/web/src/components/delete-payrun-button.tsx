"use client";

import { deletePayRun } from "@/lib/actions/payroll";
import { Trash2 } from "lucide-react";

export function DeletePayRunButton({ id, date, ledgerSyncedAt }: { id: string; date: string; ledgerSyncedAt?: string | null }) {
  const message = ledgerSyncedAt
    ? `This run was posted to LedgerPro on ${ledgerSyncedAt.slice(0, 10)}; deleting it will reverse that journal.\n\nDelete pay run for ${date}? This cannot be undone.`
    : `Delete pay run for ${date}? This cannot be undone.`;
  return (
    <form action={deletePayRun} className="inline-flex">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#B3261E] hover:text-[#8F1D17] border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] rounded-[7px] px-2.5 py-1.5 transition-colors"
        onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}
      >
        <Trash2 className="h-3 w-3" /> Delete
      </button>
    </form>
  );
}
