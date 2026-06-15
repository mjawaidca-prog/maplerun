"use client";

import { useState } from "react";

type Props = {
  totalCRA: number;
  period: string;
  businessNumber?: string;
};

export function RemittanceActions({ totalCRA, period, businessNumber }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showCRA, setShowCRA] = useState(false);

  function handlePrint() { window.print(); }

  function handleCSV() {
    const tables = document.querySelectorAll("table");
    if (tables.length === 0) return;
    let csv = "";
    const table = tables[0]!;
    table.querySelectorAll("tr").forEach((row) => {
      const rowData: string[] = [];
      row.querySelectorAll("th, td").forEach((cell) => {
        rowData.push(`"${(cell.textContent?.trim() ?? "").replace(/,/g, "")}"`);
      });
      csv += rowData.join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `remittance-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function handlePDF() { window.print(); }

  async function handleMarkSubmitted() {
    if (!confirm(`Mark remittance as submitted for ${period}?\n\nAmount: $${totalCRA.toFixed(2)}\n\nThis records the filing in MapleRun. You must remit the actual payment through your CRA business account.`)) return;
    setSubmitting(true);
    try {
      await fetch("/api/remittance/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period }) });
      setSubmitted(true);
    } catch { /* */ }
    setSubmitting(false);
  }

  const pd7aRef = `PD7A-${period}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + 1);
  dueDate.setDate(15);
  if (dueDate.getDay()===0) dueDate.setDate(16);
  if (dueDate.getDay()===6) dueDate.setDate(14);

  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.04em] bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] rounded-full px-3 py-1.5 mt-1">
        ✓ Marked as submitted
      </span>
    );
  }

  return (
    <div>
      <div className="flex gap-2.5 print:hidden">
        <button onClick={handlePDF} className="rounded-[9px] border border-[#D6D3D1] bg-white text-[#1C1917] text-[13px] font-semibold px-[15px] py-2.5 inline-flex items-center gap-[7px] hover:border-[#B3261E] hover:text-[#B3261E] transition-colors">
          ⬇︎ PDF
        </button>
        <button onClick={handleCSV} className="rounded-[9px] border border-[#D6D3D1] bg-white text-[#1C1917] text-[13px] font-semibold px-[15px] py-2.5 inline-flex items-center gap-[7px] hover:border-[#B3261E] hover:text-[#B3261E] transition-colors">
          ⬇︎ CSV
        </button>
        <button onClick={handlePrint} className="rounded-[9px] border border-[#D6D3D1] bg-white text-[#1C1917] text-[13px] font-semibold px-[15px] py-2.5 inline-flex items-center gap-[7px] hover:border-[#B3261E] hover:text-[#B3261E] transition-colors">
          🖨 Print
        </button>
        <button
          onClick={() => setShowCRA(!showCRA)}
          className="rounded-[9px] bg-[#1C1917] hover:bg-[#292524] text-white text-[13px] font-semibold px-4 py-2.5 inline-flex items-center gap-[7px] transition-colors"
        >
          🏛 Remit with CRA
        </button>
        <button
          onClick={handleMarkSubmitted}
          disabled={submitting || totalCRA <= 0}
          className="rounded-[9px] bg-[#B3261E] hover:bg-[#9B1C18] text-white text-[13px] font-semibold px-4 py-2.5 inline-flex items-center gap-[7px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Records the filing in MapleRun. Remit actual payment through your CRA account."
        >
          {submitting ? "Submitting…" : "Mark as submitted"}
        </button>
      </div>

      {/* CRA Remit card */}
      {showCRA && (
        <div className="mt-4 bg-white border-2 border-[#1C1917] rounded-[14px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.10)] print:hidden">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-base font-bold">Remit to CRA</h3>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                MapleRun prepares the report — you submit through your CRA account. Copy the details below.
              </p>
            </div>
            <a
              href="https://www.canada.ca/en/revenue-agency/services/e-services/e-services-businesses/business-account.html"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[9px] bg-[#1C1917] hover:bg-[#292524] text-white text-xs font-semibold px-4 py-2 no-underline inline-flex items-center gap-[7px] flex-shrink-0"
            >
              Open CRA My Business ↗
            </a>
          </div>

          {/* Reference card */}
          <div className="grid grid-cols-2 gap-4 bg-[#FAFAF9] border border-[#E7E5E4] rounded-[10px] p-5">
            {[
              ["Remittance period", period],
              ["Payment due date", dueDate.toISOString().slice(0, 10)],
              ["Total amount to remit", `$${totalCRA.toFixed(2)}`],
              ["Business number", businessNumber || "Enter your BN"],
              ["Remitter type", "Regular — due 15th of month"],
              ["PD7A reference", pd7aRef],
              ["Tax year", "2026"],
              ["Where to pay", "CRA My Business → Payroll Remittance → PD7A"],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between items-center border-b border-[#F0EFED] pb-2 last:border-b-0 last:pb-0">
                <span className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.04em]">{label as string}</span>
                <span className={`text-[13px] font-semibold font-mono tabular-nums ${label === "Total amount to remit" ? "text-[#B3261E] text-base" : ""}`}>{value as string}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-[11px] bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] px-4 py-3.5 mt-4 text-[12.5px] text-[#1E40AF] leading-relaxed">
            💡 <span><b>How to remit:</b> Sign in to CRA My Business Account → Select "Payroll remittance" → Enter the PD7A reference and amount above → Submit payment through your bank. You may also remit through your bank's CRA tax payment service using your business number.</span>
          </div>
        </div>
      )}
    </div>
  );
}
