/**
 * Payroll history — table with pay date, period, employees, gross, net, status.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

export default async function PayrollHistoryPage() {
  const { companyId } = await requireCompany();
  const runs = await prisma.payRun.findMany({
    where: { companyId },
    include: { payGroup: { select: { name: true, frequency: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Payroll</h1>
          <p className="text-sm text-muted-foreground mt-1">Pay run history</p>
        </div>
        <Link href="/payroll/new" className="inline-flex items-center gap-2 rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-sm font-semibold px-5 py-2.5 no-underline transition-colors">＋ Run payroll</Link>
      </div>

      {runs.length === 0 ? (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-12 text-center space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="w-14 h-14 rounded-[14px] bg-[#FEF2F2] flex items-center justify-center text-[26px] mx-auto">💵</div>
          <p className="text-base font-bold">No pay runs yet</p>
          <p className="text-[13px] text-muted-foreground max-w-[230px] mx-auto">Run your first payroll to see history here.</p>
          <Link href="/payroll/new" className="inline-flex rounded-[9px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-[13px] font-semibold px-[18px] py-2.5 no-underline">＋ Run payroll</Link>
        </div>
      ) : (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-[1.3fr_1.4fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
            {["Pay date","Pay period","Employees","Gross","Net","Status",""].map(h=><div key={h} className={`text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] ${["Gross","Net"].includes(h)?"text-right":""}`}>{h}</div>)}
          </div>
          {runs.map(run=>(
            <Link key={run.id} href={run.status === "DRAFT" ? "/payroll/new" : `/payroll/${run.id}`} className="grid grid-cols-[1.3fr_1.4fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-[15px] border-b border-[#F0EFED] last:border-b-0 items-center hover:bg-[#FAFAF9] no-underline text-inherit">
              <div className="text-sm font-semibold">{run.payDate}</div>
              <div className="text-[13px] text-[#57534E]">{run.payGroup.name} · {run.payGroup.frequency.toLowerCase()}</div>
              <div className="text-[13px] font-mono tabular-nums">{run.itemCount}</div>
              <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(run.totalGross)}</div>
              <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(run.totalNetPay)}</div>
              <div><span className={`inline-flex items-center text-[11px] font-bold tracking-[0.03em] rounded-full px-2.5 py-1 ${run.status==="FINALIZED"?"bg-[#DCFCE7] text-[#15803D]":"bg-[#FEF3C7] text-[#92400E]"}`}>{run.status}</span></div>
              <div className="text-[#A8A29E] text-right">→</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
