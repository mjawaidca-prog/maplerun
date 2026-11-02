"use client";

import { useState } from "react";
import { deleteEmployee } from "@/lib/actions/employee";
import { Trash2 } from "lucide-react";

/**
 * Delete control for an employee row.
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
export function DeleteEmployeeButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const message = `Delete ${name}?`;
  return (
    <form action={deleteEmployee} className="flex items-center justify-center">
      <input type="hidden" name="id" value={id} />
      {!confirming ? (
        <button
          type="button"
          className="text-[#A8A29E] hover:text-[#B3261E] transition-colors p-1"
          title={`Delete ${name}`}
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div
          role="alertdialog"
          aria-label={message}
          className="w-[320px] rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] p-3 text-left shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
        >
          <p className="text-xs leading-relaxed text-[#8F1D17] whitespace-pre-line">{message}</p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-[#B3261E] hover:bg-[#8F1D17] rounded-[7px] px-2.5 py-1.5 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Delete employee
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
