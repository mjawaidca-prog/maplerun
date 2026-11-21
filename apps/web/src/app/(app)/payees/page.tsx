/**
 * Payee list — non-employee recipients for T4A reporting.
 */
import { getPayees } from "@/lib/actions/t4a";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

export default async function PayeesPage() {
  let payees: Awaited<ReturnType<typeof getPayees>> = [];
  try { payees = await getPayees(); } catch {}

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Payees</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contractors, subcontractors and other non-employee recipients · {payees.length} payee{payees.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2.5">
          <Link href="/reports/t4a" className="inline-flex items-center gap-2 rounded-[10px] bg-white border border-[#E7E5E4] hover:border-[#B3261E] text-[#1C1917] text-sm font-semibold px-5 py-2.5 no-underline transition-colors">T4A slips →</Link>
          <Link href="/payees/new" className="inline-flex items-center gap-2 rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-sm font-semibold px-5 py-2.5 no-underline transition-colors">＋ Add payee</Link>
        </div>
      </div>

      <div className="flex gap-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] px-4 py-3.5 text-[13px] text-[#1E40AF] leading-relaxed">
        ℹ️ Record each payment when you make it and tag it with its T4A classification — the year-end
        T4A then builds itself. Payments tagged as construction contract payments also feed the T5018.
      </div>

      {payees.length === 0 ? (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-12 text-center space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="w-14 h-14 rounded-[14px] bg-[#FEF2F2] flex items-center justify-center text-[26px] mx-auto">🧾</div>
          <p className="text-base font-bold">No payees yet</p>
          <p className="text-[13px] text-muted-foreground max-w-[300px] mx-auto leading-relaxed">
            Add the people and businesses you pay outside payroll — subcontractors, contract workers,
            pension recipients — and record their payments as you go.
          </p>
          <Link href="/payees/new" className="inline-flex rounded-[9px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-[13px] font-semibold px-[18px] py-2.5 no-underline">＋ Add your first payee</Link>
        </div>
      ) : (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-[2.4fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
            {["Payee", "Type", "Payments", "T5018-tagged", "Total paid", ""].map((h) => (
              <div key={h} className={`text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] ${["Payments", "T5018-tagged", "Total paid"].includes(h) ? "text-right" : ""}`}>{h}</div>
            ))}
          </div>
          {payees.map((p) => (
            <Link key={p.id} href={`/payees/${p.id}`} className="grid grid-cols-[2.4fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3.5 border-b border-[#F0EFED] last:border-b-0 items-center hover:bg-[#FAFAF9] no-underline text-inherit">
              <div className="flex items-center gap-3">
                <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-[#B3261E] to-[#E56A5C] flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">{p.displayName[0]}</div>
                <div>
                  <p className="text-sm font-semibold">{p.displayName}</p>
                  <p className="text-xs text-[#A8A29E]">{p.payeeType === "BUSINESS" ? (p.businessNumber ?? "No BN on file") : (p.hasSin ? "SIN on file" : "No SIN on file")}</p>
                </div>
              </div>
              <div className="text-[13px] text-[#57534E]">{p.payeeType === "BUSINESS" ? "Business" : "Individual"}</div>
              <div className="text-[13px] text-right font-mono tabular-nums">{p.paymentCount}</div>
              <div className="text-[13px] text-right font-mono tabular-nums">{p.t5018PaymentCount > 0 ? p.t5018PaymentCount : "—"}</div>
              <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(p.totalPaid)}</div>
              <div className="text-right text-[#B3261E] text-[13px] font-semibold">→</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
