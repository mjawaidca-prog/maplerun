/**
 * Timesheet import — functional CSV upload + column mapping.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Row { name: string; regular: string; overtime: string; stat: string; vacation: string; gross: string }

export default function TimesheetImportPage() {
  const router = useRouter();
  const [data, setData] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const rows = parseCSV(text);
        setData(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse CSV");
      }
    };
    reader.readAsText(file);
  }

  function handleConfirm() {
    if (data.length === 0) return;
    setSaving(true);
    // Save parsed data to sessionStorage so wizard can pick it up
    const hoursMap: Record<string, string> = {};
    data.forEach((row) => {
      hoursMap[row.name.trim()] = row.regular || "75";
    });
    try {
      sessionStorage.setItem("maplerun-timesheet-hours", JSON.stringify(hoursMap));
    } catch {}
    router.push("/payroll/new");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="text-[13px] text-[#A8A29E]">
        <Link href="/payroll/timesheet" className="text-[#A8A29E] no-underline">Timesheet</Link> › Import CSV
      </div>
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Import timesheet</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV file with employee names and hours. Columns are auto-detected.
        </p>
      </div>

      {/* Upload */}
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-8 text-center space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="w-14 h-14 rounded-[14px] bg-[#FEF2F2] flex items-center justify-center text-[26px] mx-auto">📁</div>
        <div>
          <p className="text-base font-bold">{fileName ? fileName : "Drop a CSV or click to browse"}</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            Columns: Employee name, Regular hours, OT hours, Stat hours, Vacation hours
          </p>
        </div>
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="block mx-auto text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-[9px] file:border-0 file:text-sm file:font-semibold file:bg-[#FEF2F2] file:text-[#B3261E] hover:file:bg-[#FECACA]"
        />
        {error && <p className="text-sm text-[#B3261E]">{error}</p>}
      </div>

      {/* Preview */}
      {data.length > 0 && (
        <>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-5 py-4 border-b border-[#F0EFED] flex justify-between">
              <span className="text-[15px] font-bold">Preview</span>
              <span className="text-sm text-[#A8A29E]">{data.length} rows detected</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#FAFAF9] text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.04em]">
                    {["Employee", "Regular hrs", "OT hrs", "Stat hrs", "Vacation hrs"].map((h) => (
                      <th key={h} className={`px-4 py-2.5 ${h === "Employee" ? "text-left" : "text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} className="border-b border-[#F0EFED] last:border-b-0 hover:bg-[#FAFAF9]">
                      <td className="px-4 py-3 font-semibold">{row.name}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{row.regular}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{row.overtime}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{row.stat}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{row.vacation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 border-t border-[#F0EFED] flex justify-between items-center">
              <span className="text-[13px] text-[#A8A29E]">{data.length} rows ready</span>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="rounded-[9px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Confirm & go to payroll →"}
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Hours will pre-fill in the pay run wizard. Gross = rate × hours.
          </p>
        </>
      )}
    </div>
  );
}

/** Parse CSV into array of Row objects. Auto-detects columns from headers. */
function parseCSV(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""));
  const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("employee"));
  const regIdx = headers.findIndex((h) => h.includes("reg") || h.includes("hrs") || h.includes("hours") || h.includes("regular"));
  const otIdx = headers.findIndex((h) => h.includes("ot") || h.includes("overtime") || h.includes("over"));
  const statIdx = headers.findIndex((h) => h.includes("stat") || h.includes("holiday"));
  const vacIdx = headers.findIndex((h) => h.includes("vac") || h.includes("vacation") || h.includes("leave"));

  if (nameIdx === -1) throw new Error("Could not find employee name column. Expected header like 'Employee Name' or 'Name'.");
  if (regIdx === -1) throw new Error("Could not find hours column. Expected header like 'Regular Hours' or 'Hours'.");

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",").map((c) => c.trim());
    if (cols.length < 2 || !cols[nameIdx]) continue; // skip empty rows
    rows.push({
      name: cols[nameIdx]!,
      regular: cols[regIdx] ?? "0",
      overtime: otIdx >= 0 ? (cols[otIdx] ?? "0") : "0",
      stat: statIdx >= 0 ? (cols[statIdx] ?? "0") : "0",
      vacation: vacIdx >= 0 ? (cols[vacIdx] ?? "0") : "0",
      gross: "0", // computed later in wizard
    });
  }
  return rows;
}
