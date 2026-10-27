/**
 * LedgerPro sync status badge for pay-run list/detail (M6).
 * Presentational only — safe in server components.
 */

export type LedgerProSyncStatus = "PENDING" | "SYNCED" | "FAILED" | "BLOCKED" | "VOIDED";

const STYLES: Record<LedgerProSyncStatus, { label: string; classes: string }> = {
  SYNCED: { label: "LedgerPro: Synced", classes: "bg-[#DCFCE7] text-[#15803D]" },
  FAILED: { label: "LedgerPro: Failed", classes: "bg-[#FEE2E2] text-[#991B1B]" },
  BLOCKED: { label: "LedgerPro: Blocked", classes: "bg-[#FEF3C7] text-[#92400E]" },
  PENDING: { label: "LedgerPro: Pending", classes: "bg-[#F5F5F4] text-[#57534E]" },
  VOIDED: { label: "LedgerPro: Reversed", classes: "bg-[#F5F5F4] text-[#57534E]" },
};

export function LedgerProSyncBadge({ status }: { status: LedgerProSyncStatus | null | undefined }) {
  if (!status) {
    return (
      <span className="inline-flex items-center text-[11px] font-bold tracking-[0.03em] rounded-full px-2.5 py-1 bg-[#F5F5F4] text-[#A8A29E]">
        LedgerPro: Not synced
      </span>
    );
  }
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center text-[11px] font-bold tracking-[0.03em] rounded-full px-2.5 py-1 ${s.classes}`}>
      {s.label}
    </span>
  );
}
