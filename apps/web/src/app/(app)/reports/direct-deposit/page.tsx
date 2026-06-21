/**
 * Direct Deposit — EFT file download per finalized pay run.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

function fmtCount(employees: number): string {
  const emp = employees || 0;
  return emp > 0 ? `${emp} employee${emp!==1?"s":""}` : "—";
}

export default async function DirectDepositPage() {
  const { companyId } = await requireCompany();

  const runs = await prisma.payRun.findMany({
    where: { companyId, status: "FINALIZED" },
    include: { payGroup: { select: { name: true } } },
    orderBy: { payDate: "desc" },
    take: 10,
  });

  // Check which employees have bank details
  const empWithBank = await prisma.employee.count({
    where: { companyId, active: true, bankEncrypted: { not: "" } },
  });
  const totalEmp = await prisma.employee.count({ where: { companyId, active: true } });

  return (
    <div className="space-y-6">
      <div className="text-[13px] text-[#A8A29E]">
        <Link href="/reports" className="text-[#A8A29E] no-underline">Reports</Link> › Direct Deposit
      </div>
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Direct Deposit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Download CPA-005 EFT files for your bank. {empWithBank}/{totalEmp} employees have bank details.
          </p>
        </div>
      </div>

      {/* Bank details alert */}
      {empWithBank < totalEmp && (
        <div className="flex gap-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-[11px] px-[18px] py-3.5 text-[13px] text-[#92400E]">
          ⚠️ {totalEmp - empWithBank} employee{totalEmp-empWithBank!==1?"s":""} missing bank details. Edit employees to add transit, institution, and account numbers for direct deposit.
        </div>
      )}

      {/* EFT-ready runs */}
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
          {["Pay date","Pay group","Employees","Net pay","EFT file",""].map(h=>(
            <div key={h} className={`text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] ${h!=="Pay date"&&h!=="Pay group"?"text-right":""}`}>{h}</div>
          ))}
        </div>

        {runs.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-muted-foreground">No finalized pay runs. Run payroll first.</div>
        ) : (
          runs.map((run) => (
            <div key={run.id} className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3.5 border-b border-[#F0EFED] last:border-b-0 items-center hover:bg-[#FAFAF9]">
              <div className="text-sm font-semibold">{run.payDate}</div>
              <div className="text-[13px] text-[#57534E]">{run.payGroup.name}</div>
              <div className="text-right text-[13px] text-[#57534E]">{fmtCount(run.itemCount)}</div>
              <div className="text-right text-[13px] font-mono tabular-nums font-semibold">{fmtCAD(run.totalNetPay)}</div>
              <div className="text-right">
                {run.totalNetPay > 0 ? (
                  <Link
                    href={`/api/eft?payRunId=${run.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#F0FDF4] text-[#16A34A] rounded-full px-3 py-1.5 no-underline hover:bg-[#DCFCE7]"
                  >
                    ⬇ EFT
                  </Link>
                ) : (
                  <span className="text-xs text-[#A8A29E]">—</span>
                )}
              </div>
              <div></div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-[11px] bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] px-4 py-3.5 text-[12.5px] text-[#1E40AF] leading-relaxed">
        ℹ️ <span><b>CPA-005</b> is the standard Canadian EFT format. Download the file and upload it to your bank's business portal. Supported by RBC, TD, Scotiabank, BMO, CIBC, and most credit unions. <b>Add bank details</b> for each employee on their Edit page.</span>
      </div>
    </div>
  );
}
