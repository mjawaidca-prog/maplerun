/**
 * Payee detail — identity, record-a-payment, payment history with
 * per-classification totals. The year's tagged payments are what the
 * T4A slip aggregates (lib/actions/t4a.getT4aReport).
 */

import { getPayeeDetail } from "@/lib/actions/t4a";
import { T4A_BOX_BY_CODE } from "@/lib/filings/t4a-boxes";
import { PayeePaymentForm, DeletePayeePaymentButton, DeletePayeeButton } from "@/components/payee-payment-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

type Props = { params: Promise<{ id: string }> };

export default async function PayeeDetailPage({ params }: Props) {
  const { id } = await params;
  const payee = await getPayeeDetail(id);
  if (!payee) notFound();

  const year = new Date().getFullYear();
  const yearPayments = payee.payments.filter((p) => p.paymentDate.startsWith(String(year)));
  const byCode = new Map<string, number>();
  for (const p of yearPayments) byCode.set(p.boxCode, (byCode.get(p.boxCode) ?? 0) + p.amount);
  const yearTax = yearPayments.reduce((a, p) => a + p.incomeTaxDeducted, 0);
  const yearTotal = yearPayments.reduce((a, p) => a + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/payees" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to payees
        </Link>
        <DeletePayeeButton payeeId={payee.id} />
      </div>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">{payee.displayName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {payee.payeeType === "BUSINESS" ? "Business payee" : "Individual payee"}
            {payee.payeeType === "BUSINESS"
              ? ` · BN ${payee.businessNumber ?? "not on file"}`
              : ` · SIN ${payee.hasSin ? "on file" : "not on file"}`}
            {payee.city ? ` · ${payee.city}` : ""}{payee.province ? `, ${payee.province}` : ""}
          </p>
        </div>
        <Link href={`/reports/t4a/${payee.id}`} className="inline-flex items-center gap-2 rounded-[10px] bg-white border border-[#E7E5E4] hover:border-[#B3261E] text-[#1C1917] text-sm font-semibold px-5 py-2.5 no-underline transition-colors">
          View T4A slip →
        </Link>
      </div>

      {/* Year totals by classification */}
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-5 py-4 border-b border-[#F0EFED] flex justify-between items-center">
          <span className="text-[15px] font-bold">{year} tagged payments</span>
          <span className="text-[13px] font-mono tabular-nums font-bold">{fmtCAD(yearTotal)}</span>
        </div>
        {yearPayments.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-muted-foreground">No payments recorded in {year} yet.</p>
        ) : (
          <div className="grid grid-cols-4 gap-3.5 p-5">
            {[...byCode.entries()].map(([code, total]) => (
              <div key={code}>
                <p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.05em]"><b className="text-[#1C1917] font-bold">{code} · {T4A_BOX_BY_CODE.get(code)?.label ?? code}</b></p>
                <p className="text-base font-bold mt-1.5 font-mono tabular-nums">{fmtCAD(total)}</p>
              </div>
            ))}
            <div>
              <p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.05em]"><b className="text-[#1C1917] font-bold">022 · Income tax deducted</b></p>
              <p className="text-base font-bold mt-1.5 font-mono tabular-nums">{fmtCAD(yearTax)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Record a payment */}
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="text-[15px] font-bold mb-4">Record a payment</p>
        <PayeePaymentForm payeeId={payee.id} />
      </div>

      {/* Payment history */}
      <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em]">Payment history</p>
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr_64px] gap-3 px-5 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
          {["Date", "Description", "Class", "Tax withheld", "Amount", ""].map((h) => (
            <div key={h} className={`text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] ${["Tax withheld", "Amount"].includes(h) ? "text-right" : ""}`}>{h}</div>
          ))}
        </div>
        {payee.payments.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-muted-foreground text-center">No payments recorded yet.</p>
        ) : (
          payee.payments.map((p) => (
            <div key={p.id} className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr_64px] gap-3 px-5 py-3.5 border-b border-[#F0EFED] last:border-b-0 items-center">
              <div className="text-[13px] font-mono tabular-nums">{p.paymentDate}</div>
              <div className="text-[13px] text-[#57534E]">
                {p.description ?? "—"}
                {p.t5018Reportable && <span className="ml-2 inline-flex text-[10px] font-bold bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-full px-2 py-0.5">T5018</span>}
              </div>
              <div className="text-[13px] text-[#57534E]">{p.boxCode} · {T4A_BOX_BY_CODE.get(p.boxCode)?.label ?? p.boxCode}</div>
              <div className="text-[13px] text-right font-mono tabular-nums">{p.incomeTaxDeducted > 0 ? fmtCAD(p.incomeTaxDeducted) : "—"}</div>
              <div className="text-[13px] text-right font-mono tabular-nums font-semibold">{fmtCAD(p.amount)}</div>
              <div className="text-right"><DeletePayeePaymentButton paymentId={p.id} /></div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
