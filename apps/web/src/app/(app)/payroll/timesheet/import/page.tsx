/**
 * Timesheet import — CSV upload + column mapping.
 */
import Link from "next/link";

export default function TimesheetImportPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="text-[13px] text-[#A8A29E]">
        <Link href="/payroll/timesheet" className="text-[#A8A29E] no-underline">Timesheet</Link> › Import CSV
      </div>
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Import timesheet</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV file of hours and map columns to employee fields.
        </p>
      </div>

      {/* Upload */}
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-8 text-center space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="w-14 h-14 rounded-[14px] bg-[#FEF2F2] flex items-center justify-center text-[26px] mx-auto">📁</div>
        <div>
          <p className="text-base font-bold">Drop a CSV or click to browse</p>
          <p className="text-[13px] text-muted-foreground mt-1">Expected columns: employee name, regular hours, overtime, stat holiday, vacation</p>
        </div>
        <input type="file" accept=".csv" className="block mx-auto text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-[9px] file:border-0 file:text-sm file:font-semibold file:bg-[#FEF2F2] file:text-[#B3261E] hover:file:bg-[#FECACA]" />
      </div>

      {/* Column mapping preview */}
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-5 py-4 border-b border-[#F0EFED]">
          <span className="text-[15px] font-bold">Column mapping</span>
          <span className="text-sm text-[#A8A29E] ml-2">Auto-detected from headers</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              ["Employee name", "emp_name ✓"],
              ["Regular hours", "reg_hrs ✓"],
              ["Overtime hours", "ot_hrs ✓"],
              ["Stat holiday hours", "stat ✓"],
              ["Vacation hours", "vac_hrs ✓"],
            ].map(([label, mapped]) => (
              <div key={label} className="flex items-center justify-between border border-[#E7E5E4] rounded-lg px-4 py-3">
                <span className="text-[13px] font-medium">{label}</span>
                <span className="text-xs text-[#16A34A] font-semibold">{mapped}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview data */}
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-5 py-4 border-b border-[#F0EFED]">
          <span className="text-[15px] font-bold">Preview</span>
          <span className="text-sm text-[#A8A29E] ml-2">3 rows detected</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#FAFAF9] text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.04em]">
                {["Employee", "Regular", "OT", "Stat", "Vacation", "Gross"].map((h) => (
                  <th key={h} className={`px-4 py-2.5 ${h === "Employee" ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Sarah Tremblay", "75.0", "0.0", "0.0", "0.0", "$2,884.62"],
                ["David Chen", "75.0", "0.0", "0.0", "0.0", "$3,100.00"],
                ["Amara Okonkwo", "75.0", "0.0", "0.0", "0.0", "$2,900.00"],
              ].map((row, i) => (
                <tr key={i} className="border-b border-[#F0EFED] last:border-b-0 hover:bg-[#FAFAF9]">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-4 py-3 ${j > 0 ? "text-right font-mono tabular-nums" : "font-semibold"}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-[#F0EFED] flex justify-between">
          <span className="text-[13px] text-[#A8A29E]">All names matched · 0 rows need attention</span>
          <Link href="/payroll/timesheet" className="rounded-[9px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-sm font-semibold px-5 py-2.5 no-underline">
            Confirm & fill timesheet →
          </Link>
        </div>
      </div>
    </div>
  );
}
