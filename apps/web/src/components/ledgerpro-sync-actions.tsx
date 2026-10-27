"use client";

/**
 * Retry / Reverse controls for a pay run's LedgerPro sync (M4/M5 UI).
 * Uses the repo's form-action pattern (see delete-payrun-button.tsx).
 */

import { retryLedgerProSync, reverseLedgerProSync } from "@/lib/actions/ledgerpro";
import type { LedgerProSyncStatus } from "@/components/ledgerpro-sync-badge";

type Props = {
  payRunId: string;
  status: LedgerProSyncStatus;
  syncedAt: string | null;
};

export function LedgerProSyncActions({ payRunId, status, syncedAt }: Props) {
  const canRetry = status === "FAILED" || status === "BLOCKED" || status === "PENDING";
  const canReverse = status === "SYNCED";
  if (!canRetry && !canReverse) return null;

  const syncedLabel = syncedAt ? syncedAt.slice(0, 10) : "an earlier date";

  return (
    <span className="inline-flex gap-2">
      {canRetry && (
        <form action={retryLedgerProSync} className="inline-flex">
          <input type="hidden" name="payRunId" value={payRunId} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1C1917] border border-[#D6D3D1] bg-white hover:border-[#B3261E] rounded-[7px] px-2.5 py-1.5 transition-colors"
          >
            Retry sync
          </button>
        </form>
      )}
      {canReverse && (
        <form action={reverseLedgerProSync} className="inline-flex">
          <input type="hidden" name="payRunId" value={payRunId} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#B3261E] hover:text-[#8F1D17] border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] rounded-[7px] px-2.5 py-1.5 transition-colors"
            onClick={(e) => {
              if (!confirm(`Reverse this run's journal in LedgerPro?\n\nThis run was posted to LedgerPro on ${syncedLabel}. Reversing posts an equal-and-opposite journal dated today. The pay run itself is NOT deleted.`)) e.preventDefault();
            }}
          >
            Reverse in LedgerPro
          </button>
        </form>
      )}
    </span>
  );
}
