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
    if (!confirm(`Submit $${totalCRA.toFixed(2)} to CRA for ${period}?`)) return;
    setSubmitting(true);
    // Simulate submission — in production this calls an API
    await new Promise((r) => setTimeout(r, 1500));
    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.04em] bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] rounded-full px-3 py-1.5">
        ✓ Submitted
      </span>
    );
  }

  return (
    <div className="flex gap-2.5">
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
      >
        {submitting ? "Submitting…" : "Submit to CRA"}
      </button>
    </div>
  );
}
