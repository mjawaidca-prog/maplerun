"use client";

import { useState } from "react";

type Props = {
  totalCRA: number;
  period: string;
  onPrint?: () => void;
};

export function RemittanceActions({ totalCRA, period }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handlePrint() {
    window.print();
  }

  function handleCSV() {
    // Trigger CSV download of the active table
    const tables = document.querySelectorAll("table");
    if (tables.length === 0) return;
    let csv = "";
    const table = tables[0]!;
    const rows = table.querySelectorAll("tr");
    rows.forEach((row) => {
      const cells = row.querySelectorAll("th, td");
      const rowData: string[] = [];
      cells.forEach((cell) => {
        let text = cell.textContent?.trim().replace(/,/g, "") ?? "";
        rowData.push(`"${text}"`);
      });
      csv += rowData.join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `remittance-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePDF() {
    window.print(); // Uses print-to-PDF in browser
  }

  async function handleSubmit() {
    if (!confirm(`Mark remittance as submitted for ${period}?\n\nAmount: $${totalCRA.toFixed(2)}\n\nThis records the filing in MapleRun. You must remit the actual payment through your CRA business account or online banking.`)) return;
    setSubmitting(true);
    try {
      await fetch("/api/remittance/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period }) });
      setSubmitted(true);
    } catch { /* fall through */ }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.04em] bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] rounded-full px-3 py-1.5 mt-1">
        ✓ Marked as submitted
      </span>
    );
  }

  return (
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
        onClick={handleSubmit}
        disabled={submitting || totalCRA <= 0}
        className="rounded-[9px] bg-[#B3261E] hover:bg-[#9B1C18] text-white text-[13px] font-semibold px-4 py-2.5 inline-flex items-center gap-[7px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Records the filing in MapleRun. Remit actual payment through your CRA account."
      >
        {submitting ? "Submitting…" : "Mark as submitted"}
      </button>
    </div>
  );
}
