"use client";

import { useState } from "react";
import { reversePayRun } from "@/lib/actions/payroll";
import { Undo2 } from "lucide-react";

/**
 * Reverse control for a FINALIZED pay run (Wave 1 PR #11 workflow).
 *
 * The confirmation is an in-page step, NOT the native window.confirm()
 * dialog: the original implementation gated the submit on
 * `confirm()` inside the button's onClick, and in any browsing
 * context where that modal cannot be displayed (embedded/sandboxed
 * frames without allow-modals, dialog-suppressing automation)
 * confirm() returns false instantly, the handler preventDefault()s,
 * and the button renders but never fires — no dialog, no error, no
 * state change. An in-page confirmation has no such failure mode and
 * keeps the exact message and two-step design PR #11 specified.
 */
export function ReversePayRunButton({ id, date, ledgerSyncedAt }: { id: string; date: string; ledgerSyncedAt?: string | null }) {
  const [confirming, setConfirming] = useState(false);
  const message = ledgerSyncedAt
    ? `This run was posted to LedgerPro on ${ledgerSyncedAt.slice(0, 10)}; reversing it will reverse that journal first.\n\nReverse pay run for ${date}? The run stays on record as REVERSED, its YTD totals are unwound exactly, and it stops counting in reports. This cannot be undone.`
    : `Reverse pay run for ${date}? The run stays on record as REVERSED, its YTD totals are unwound exactly, and it stops counting in reports. This cannot be undone.`;
  return (
    <form action={reversePayRun} className="inline-flex">
      <input type="hidden" name="id" value={id} />
      {!confirming ? (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#92400E] hover:text-[#78350F] border border-[#FDE68A] bg-[#FFFBEB] hover:bg-[#FEF3C7] rounded-[7px] px-2.5 py-1.5 transition-colors"
          onClick={() => setConfirming(true)}
        >
          <Undo2 className="h-3 w-3" /> Reverse
        </button>
      ) : (
        <div
          role="alertdialog"
          aria-label={`Reverse pay run for ${date}?`}
          className="w-[320px] rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] p-3 text-left shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
        >
          <p className="text-xs leading-relaxed text-[#78350F] whitespace-pre-line">{message}</p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-[#B45309] hover:bg-[#92400E] rounded-[7px] px-2.5 py-1.5 transition-colors"
            >
              <Undo2 className="h-3 w-3" /> Reverse pay run
            </button>
            <button
              type="button"
              className="inline-flex items-center text-[11px] font-semibold text-[#57534E] hover:text-[#1C1917] border border-[#E7E5E4] bg-white hover:bg-[#FAFAF9] rounded-[7px] px-2.5 py-1.5 transition-colors"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
