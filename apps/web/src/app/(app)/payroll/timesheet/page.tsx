/**
 * Timesheet entry — hourly staff hours grid.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function TimesheetPage() {
  const { companyId } = await requireCompany();
  const employees = await prisma.employee.findMany({
    where: { companyId, active: true },
    orderBy: { lastName: "asc" },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="text-[13px] text-[#A8A29E]">
        <Link href="/payroll" className="text-[#A8A29E] no-underline">Payroll</Link> › Timesheet
      </div>
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Timesheet</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter hours for {employees.length} active employee{employees.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2.5">
          <Link href="/payroll/timesheet/import" className="rounded-[10px] border border-[#D6D3D1] bg-white px-4 py-2.5 text-sm font-semibold no-underline text-[#1C1917] hover:border-[#B3261E]">
            ⬆ Import CSV
          </Link>
          <Link href="/payroll/new" className="rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-white px-5 py-2.5 text-sm font-semibold no-underline">
            Calculate deductions →
          </Link>
        </div>
      </div>

      {/* Period selector */}
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] block mb-1.5">Pay period ending</label>
            <input type="date" className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm font-sans" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] block mb-1.5">Pay group</label>
            <select className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm font-sans bg-white">
              <option>All staff · Biweekly</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full rounded-[9px] bg-[#1C1917] text-white text-[13px] font-semibold px-4 py-2.5">Apply</button>
          </div>
        </div>
      </div>

      {/* Hours grid */}
      {employees.length === 0 ? (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-12 text-center space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-base font-bold">No active employees</p>
          <p className="text-[13px] text-muted-foreground">Add employees to start tracking hours.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
            {["Employee", "Regular hrs", "Overtime", "Stat holiday", "Vacation"].map((h) => (
              <div key={h} className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] text-right first:text-left">{h}</div>
            ))}
          </div>
          {employees.map((emp) => (
            <div key={emp.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3.5 border-b border-[#F0EFED] last:border-b-0 items-center hover:bg-[#FAFAF9]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#B3261E] to-[#E56A5C] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {emp.firstName[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold">{emp.firstName} {emp.lastName}</p>
                  <p className="text-xs text-[#A8A29E]">{emp.province ?? "ON"} · Hourly</p>
                </div>
              </div>
              <input type="number" min="0" step="0.5" defaultValue="75" className="text-right border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm font-mono tabular-nums w-full" />
              <input type="number" min="0" step="0.5" defaultValue="0" className="text-right border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm font-mono tabular-nums w-full" />
              <input type="number" min="0" step="0.5" defaultValue="0" className="text-right border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm font-mono tabular-nums w-full" />
              <input type="number" min="0" step="0.5" defaultValue="0" className="text-right border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm font-mono tabular-nums w-full" />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Hours feed into the pay run wizard. Rate × hours = gross per employee.
      </p>
    </div>
  );
}
