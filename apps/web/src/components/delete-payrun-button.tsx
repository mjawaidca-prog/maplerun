"use client";

import { useState } from "react";
import { deletePayRun } from "@/lib/actions/payroll";
import { Trash2 } from "lucide-react";

/**
 * Delete control for a pay run (the server action refuses FINALIZED
 * runs — those must be reversed instead; drafts and reversed runs
 * hard-delete).
 *
 * The confirmation is an in-page step, NOT the native window.confirm()
 * dialog: the original implementation gated the submit on
 * `confirm()` inside the button's onClick, and in any browsing
 * context where that modal cannot be displayed (embedded/sandboxed
 * frames without allow-modals, dialog-suppressing automation)
 * confirm() returns false instantly, the handler preventDefault()s,
 * and the button renders but never fires — no dialog, no error, no
 * state change. An in-page confirmation has no such failure mode and
 * keeps the exact message and two-step design. Same conversion as
 * ReversePayRunButton (PR #24).
 */
export function DeletePayRunButton({ id, date, ledgerSyncedAt }: { id: string; date: string; ledgerSyncedAt?: string | null }) {
  const [confirming, setConfirming] = useState(false);
  const message = ledgerSyncedAt
    ? `This run was posted to LedgerPro on ${ledgerSyncedAt.slice(0, 10)}; deleting it will reverse that journal.\n\nDelete pay run for ${date}? This cannot be undone.`
    : `Delete pay run for ${date}? This cannot be undone.`;
  return (
    <form action={deletePayRun} className="inline-flex">
      <input type="hidden" name="id" value={id} />
      {!confirming ? (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#B3261E] hover:text-[#8F1D17] border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] rounded-[7px] px-2.5 py-1.5 transition-colors"
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      ) : (
        <div
          role="alertdialog"
          aria-label={`Delete pay run for ${date}?`}
          className="w-[320px] rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] p-3 text-left shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
        >
          <p className="text-xs leading-relaxed text-[#8F1D17] whitespace-pre-line">{message}</p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-[#B3261E] hover:bg-[#8F1D17] rounded-[7px] px-2.5 py-1.5 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Delete pay run
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
