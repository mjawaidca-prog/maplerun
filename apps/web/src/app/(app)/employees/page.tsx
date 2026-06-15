/**
 * Employee list — avatars, province, YTD, status, click through.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { deleteEmployee } from "@/lib/actions/employee";
import { DeleteEmployeeButton } from "@/components/delete-employee-button";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

export default async function EmployeesPage() {
  const { companyId } = await requireCompany();
  const employees = await prisma.employee.findMany({
    where: { companyId },
    include: { ytdLedgers: { where: { year: 2026 }, take: 1 } },
    orderBy: { lastName: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">{employees.length} active employee{employees.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/employees/new" className="inline-flex items-center gap-2 rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-sm font-semibold px-5 py-2.5 no-underline transition-colors">＋ Add employee</Link>
      </div>

      {employees.length === 0 ? (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-12 text-center space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="w-14 h-14 rounded-[14px] bg-[#FEF2F2] flex items-center justify-center text-[26px] mx-auto">👥</div>
          <p className="text-base font-bold">No employees yet</p>
          <p className="text-[13px] text-muted-foreground max-w-[230px] mx-auto leading-relaxed">Add your first employee to start running payroll and generating pay stubs.</p>
          <Link href="/employees/new" className="inline-flex rounded-[9px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-[13px] font-semibold px-[18px] py-2.5 no-underline">＋ Add your first employee</Link>
        </div>
      ) : (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-[2.4fr_1fr_1.2fr_1.2fr_0.8fr_48px] gap-3 px-5 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
            {["Employee","Province","Pay group","YTD gross","Status",""].map(h=><div key={h} className={`text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] ${h==="YTD gross"?"text-right":""}`}>{h}</div>)}
          </div>
          {employees.map(emp=>(
            <div key={emp.id} className="grid grid-cols-[2.4fr_1fr_1.2fr_1.2fr_0.8fr_48px] gap-3 px-5 py-3.5 border-b border-[#F0EFED] last:border-b-0 items-center hover:bg-[#FAFAF9]">
              <Link href={`/employees/${emp.id}`} className="contents no-underline text-inherit">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#B3261E] to-[#E56A5C] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{emp.firstName[0]}</div>
                <div><p className="text-sm font-semibold">{emp.firstName} {emp.lastName}</p><p className="text-xs text-[#A8A29E]">SIN •••-•••-•••</p></div>
              </div>
              <div className="text-[13px] text-[#57534E]">{emp.province??"—"}</div>
              <div className="text-[13px] text-[#57534E]">—</div>
              <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(emp.ytdLedgers[0]?.pensionableEarnings??0)}</div>
              <div><span className="inline-flex items-center text-[11px] font-bold tracking-[0.03em] rounded-full px-2.5 py-1 bg-[#DCFCE7] text-[#15803D]">ACTIVE</span></div>
              <div className="text-[#A8A29E] text-right">→</div>
            </Link>
            <DeleteEmployeeButton id={emp.id} name={`${emp.firstName} ${emp.lastName}`} />
          </div>
          ))}
        </div>
      )}
    </div>
  );
}
