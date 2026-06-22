/**
 * Pay run detail — totals grid, employee breakdown with stub links.
 */
import { getPayRun } from "@/lib/actions/payroll";
import { requireCompany } from "@/lib/session";
import { StubPrintButton } from "@/components/stub-actions";
import { DeletePayRunButton } from "@/components/delete-payrun-button";
import Link from "next/link";
import { notFound } from "next/navigation";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

type Props = { params: Promise<{ id: string }> };

export default async function PayRunDetailPage({ params }: Props) {
  const { id } = await params;
  const { companyId } = await requireCompany();
  const run = await getPayRun(id).catch(() => null);
  if (!run || run.companyId !== companyId) notFound();

  return (
    <div className="space-y-6">
      <div className="text-[13px] text-[#A8A29E]"><Link href="/payroll" className="text-[#A8A29E] no-underline">Payroll</Link> › {run.payDate}</div>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em] flex items-center gap-3">
            {run.payDate}
            <span className={`inline-flex items-center text-xs font-bold tracking-[0.03em] rounded-full px-[11px] py-1 ${run.status==="FINALIZED"?"bg-[#DCFCE7] text-[#15803D]":"bg-[#FEF3C7] text-[#92400E]"}`}>{run.status}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{run.payGroup.name} · {run.payGroup.frequency.toLowerCase()} · {run.items.length} employees</p>
        </div>
        <div className="flex gap-2.5 items-center">
          <DeletePayRunButton id={run.id} date={run.payDate} />
          <StubPrintButton />
        </div>
      </div>

      <div className="grid grid-cols-4 border border-[#E7E5E4] rounded-[14px] overflow-hidden">
        {[["Gross",run.totalGross],["Deductions",run.totalDeductions],["Net pay",run.totalNetPay],["Employer cost",run.totalEmployerCost]].map(([label,value])=>(
          <div key={label as string} className={`bg-white p-[18px] ${label==="Net pay"?"bg-gradient-to-br from-[#FEF2F2] to-[#FEE2E2]":""}`}>
            <p className={`text-[11px] font-bold uppercase tracking-[0.06em] ${label==="Net pay"?"text-[#991B1B]":"text-[#A8A29E]"}`}>{label as string}</p>
            <p className={`text-2xl font-bold mt-2 tracking-[-0.01em] font-mono tabular-nums ${label==="Net pay"?"text-[#B3261E]":""}`}>{fmtCAD(value as number)}</p>
          </div>
        ))}
      </div>

      <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-3">Employees in this run</p>
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
          {["Employee","Gross","Deductions","Net",""].map(h=><div key={h} className={`text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em] ${h!=="Employee"?"text-right":""}`}>{h}</div>)}
        </div>
        {run.items.map(item=>(
          <Link key={item.id} href={`/payroll/${run.id}/stub/${item.id}`} className="grid grid-cols-[2fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3.5 border-b border-[#F0EFED] last:border-b-0 items-center hover:bg-[#FAFAF9] no-underline text-inherit">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#B3261E] to-[#E56A5C] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{item.employee.firstName[0]}</div>
              <div><p className="text-sm font-semibold">{item.employee.firstName} {item.employee.lastName}</p><p className="text-xs text-[#A8A29E]">Ontario · {run.payGroup.frequency.toLowerCase()}</p></div>
            </div>
            <div className="text-[13px] text-right font-mono tabular-nums">{fmtCAD(item.gross)}</div>
            <div className="text-[13px] text-right font-mono tabular-nums text-[#57534E]">{fmtCAD(item.totalDeductions)}</div>
            <div className="text-[13px] text-right font-mono tabular-nums font-semibold">{fmtCAD(item.netPay)}</div>
            <div className="text-right text-[#B3261E] text-[13px] font-semibold">Stub →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
