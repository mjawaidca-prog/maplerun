/**
 * Individual T4A slip — CRA-style layout with box chips, mirroring the
 * T4 slip page. Printable via the browser print flow (StubPrintButton).
 */

import { getT4aReport } from "@/lib/actions/t4a";
import { T4A_BOX_BY_CODE } from "@/lib/filings/t4a-boxes";
import { StubPrintButton } from "@/components/stub-actions";
import { Logo } from "@/components/logo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

type Props = { params: Promise<{ payeeId: string }> };

export default async function T4aSlipPage({ params }: Props) {
  const { payeeId } = await params;
  const report = await getT4aReport(2026);
  const row = report.slips.find((s) => s.payeeId === payeeId);
  if (!row) notFound();
  const slip = row.slip;

  const mainBoxes: [string, string, number][] = [
    ["016", "Pension or superannuation", slip.box016],
    ["018", "Lump-sum payments", slip.box018],
    ["020", "Self-employed commissions", slip.box020],
    ["022", "Income tax deducted", slip.box022],
    ["024", "Annuities", slip.box024],
    ["048", "Fees for services", slip.box048],
    ["012", "Recipient SIN", NaN],
    ["013", "Recipient BN", NaN],
  ];

  return (
    <div className="space-y-6 max-w-[816px] print:max-w-full">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/reports/t4a" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to T4A list
        </Link>
        <StubPrintButton />
      </div>

      <div className="rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.10)] border border-[#E7E5E4] bg-white print:shadow-none print:rounded-none print:border-0">
        {/* Header */}
        <div className="px-10 py-7 border-b-[3px] border-[#B3261E] flex justify-between items-start">
          <div>
            <div className="mb-3.5">
              <Logo size={28} />
            </div>
            <p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.1em]">Canada Revenue Agency</p>
            <p className="text-[21px] font-bold mt-0.5 leading-tight">Statement of Pension, Retirement, Annuity, and Other Income</p>
            <p className="text-[13px] text-[#78716C] mt-0.5">T4A · Tax Year 2026</p>
          </div>
          <div className="border-2 border-[#1C1917] rounded-lg px-4 py-2 text-center">
            <p className="text-[11px] text-[#78716C] uppercase tracking-[0.1em]">Year</p>
            <p className="text-[26px] font-bold font-mono tabular-nums">2026</p>
          </div>
        </div>

        {/* Parties */}
        <div className="px-10 py-6 grid grid-cols-2 gap-6 border-b border-[#E7E5E4]">
          <div>
            <p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.08em]">Payer's name</p>
            <p className="text-base font-bold mt-0.5">{report.companyName}</p>
          </div>
          <div>
            <p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.08em]">Recipient</p>
            <p className="text-base font-bold mt-0.5">{row.displayName}</p>
            <p className="text-[13px] text-[#78716C] mt-0.5">
              {row.payeeType === "BUSINESS"
                ? <>BN <span className="font-mono tabular-nums">{slip.recipientBn}</span></>
                : <>SIN <span className="font-mono tabular-nums">••• ••• •••</span>{slip.recipientBn !== "000000000RC0000" ? <> &nbsp;·&nbsp; BN <span className="font-mono tabular-nums">{slip.recipientBn}</span></> : null}</>}
            </p>
            {(slip.address.city || slip.address.province) && (
              <p className="text-[13px] text-[#78716C]">{slip.address.city ?? ""}{slip.address.province ? `, ${slip.address.province}` : ""}{slip.address.postalCode ? ` ${slip.address.postalCode}` : ""}</p>
            )}
          </div>
        </div>

        {/* Main boxes */}
        <div className="px-10 py-6 grid grid-cols-4 gap-3.5">
          {mainBoxes.map(([num, label, value]) => (
            <div key={num} className="border border-[#D6D3D1] rounded-[10px] p-3.5 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-1.5 bg-[#1C1917] text-white text-xs font-bold rounded-[5px] font-mono tabular-nums">
                  {num}
                </span>
                <span className="text-[11px] text-[#78716C] uppercase tracking-[0.04em] leading-tight">{label}</span>
              </div>
              <p className="text-xl font-semibold text-[#1C1917] text-right font-mono tabular-nums">
                {num === "012" ? "••• ••• •••" : num === "013" ? <span className="text-[13px]">{slip.recipientBn}</span> : fmtCAD(value)}
              </p>
            </div>
          ))}
        </div>

        {/* Other information */}
        {slip.otherInfo.length > 0 && (
          <div className="px-10 pb-6">
            <p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.08em] mb-3">Other information</p>
            <div className="border border-[#D6D3D1] rounded-[10px] overflow-hidden">
              {slip.otherInfo.map((o) => (
                <div key={o.code} className="flex justify-between items-center px-4 py-2.5 border-b border-[#F0EFED] last:border-b-0">
                  <span className="text-[13px] text-[#57534E]">
                    <span className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-1.5 bg-[#1C1917] text-white text-xs font-bold rounded-[5px] font-mono tabular-nums mr-2">{o.code}</span>
                    {T4A_BOX_BY_CODE.get(o.code)?.label ?? o.code}
                  </span>
                  <span className="text-[13px] font-semibold font-mono tabular-nums">{fmtCAD(o.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {slip.dentalBenefitsCode !== undefined && (
          <div className="px-10 pb-6">
            <p className="text-[13px] text-[#78716C]">
              <strong className="text-[#1C1917]">Box 015 · Payer-offered dental benefits:</strong> code {slip.dentalBenefitsCode}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-10 py-[18px] pb-7 border-t border-[#E7E5E4] bg-[#FAFAF9] flex justify-between items-center">
          <p className="text-xs text-[#78716C]">
            <strong className="text-[#1C1917]">Filing deadline:</strong> Distribute to recipients &amp; file with CRA by <strong className="text-[#B3261E]">Feb 28, 2027</strong>
          </p>
          <p className="text-[11px] text-[#A8A29E] text-right max-w-[320px]">
            Generated by Nexvar Pay from {slip.paymentCount} tagged payment{slip.paymentCount !== 1 ? "s" : ""}. Verify against your CRA filing. Not a substitute for the official CRA T4A.
          </p>
        </div>
      </div>

      {slip.warnings.length > 0 && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[10px] px-4 py-3.5 text-[13px] text-[#92400E] leading-relaxed space-y-1 print:hidden">
          <p><b>⚠️ Before you file:</b></p>
          {slip.warnings.map((w, i) => <p key={i}>• {w}</p>)}
        </div>
      )}
    </div>
  );
}
