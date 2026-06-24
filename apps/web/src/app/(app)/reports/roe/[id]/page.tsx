/**
 * ROE detail — Service Canada formatted Record of Employment.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can, type Plan } from "@/lib/plan";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { StubPrintButton } from "@/components/stub-actions";
import Link from "next/link";
import { notFound } from "next/navigation";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

type Props = { params: Promise<{ id: string }> };

export default async function RoeDetailPage({ params }: Props) {
  const { id } = await params;
  const { companyId } = await requireCompany();

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { plan: true } });
  const plan: Plan = (company?.plan as Plan) ?? "growth";

  if (!can(plan, "roe")) {
    return (
      <div className="space-y-6 max-w-lg mx-auto pt-12">
        <div className="text-[13px] text-[#A8A29E]"><Link href="/reports" className="text-[#A8A29E] no-underline">Reports</Link> › ROE</div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Record of Employment</h1>
        <UpgradePrompt feature="ROE generation" requiredPlan="accountant" currentPlan={plan} />
      </div>
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { ytdLedgers: { where: { year: 2026 }, take: 1 } },
  });
  if (!employee || employee.companyId !== companyId) notFound();

  const items = await prisma.payRunItem.findMany({
    where: { employeeId: id, payRun: { status: "FINALIZED", companyId } },
    include: { payRun: { select: { payDate: true } } },
    orderBy: { payRun: { payDate: "asc" } },
  });
  if (items.length === 0) notFound();

  const first = items[0]!, last = items[items.length-1]!;
  const totalInsurable = items.reduce((s,i)=>s+(i.ei>0?i.gross:0),0);
  const totalHours = items.length * 75; // placeholder assumption
  const ytd = employee.ytdLedgers[0];

  return (
    <div className="space-y-6 max-w-[920px]">
      <div className="text-[13px] text-[#A8A29E]">
        <Link href="/reports/roe" className="text-[#A8A29E] no-underline">Records of Employment</Link> › {employee.firstName} {employee.lastName}
      </div>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em] flex items-center gap-3">
            {employee.firstName} {employee.lastName}
            <span className="inline-flex items-center text-xs font-bold tracking-[0.03em] rounded-full px-[11px] py-1 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E]">ROE READY</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Record of Employment · Service Canada</p>
        </div>
        <div className="flex gap-2.5">
          <StubPrintButton />
        </div>
      </div>

      {/* ROE document */}
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Employee info band */}
        <div className="bg-[#FAFAF9] border-b border-[#E7E5E4] px-6 py-4 flex justify-between items-center">
          <div>
            <p className="text-sm font-bold">{employee.firstName} {employee.lastName}</p>
            <p className="text-xs text-[#A8A29E] mt-0.5">SIN •••-•••-••• · {employee.province??"ON"}</p>
          </div>
        </div>

        {/* Boxes */}
        <div className="px-6 py-5">
          <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em] mb-3.5">ROE Data</p>
          <div className="grid grid-cols-4 border border-[#E7E5E4] rounded-[10px] overflow-hidden">
            {[
              ["15A","Total insurable hours",String(totalHours)],
              ["15B","Total insurable earnings",fmtCAD(totalInsurable)],
              ["","First work date",first.payRun.payDate],
              ["","Last work date",last.payRun.payDate],
            ].map(([num,label,value])=>(
              <div key={`${num}-${label}`} className="bg-white p-3.5">
                {num && <p className="text-[10px] font-bold text-[#B3261E] font-mono tabular-nums">{num}</p>}
                <p className="text-[11px] text-[#A8A29E] mt-0.5 leading-tight">{label}</p>
                <p className="text-sm font-semibold mt-1.5 font-mono tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pay period table */}
        <div className="px-6 py-5 border-t border-[#F0EFED]">
          <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em] mb-3.5">Pay Periods (Block 15C)</p>
          {items.slice(-12).reverse().map((item,i)=>(
            <div key={item.id} className="grid grid-cols-[50px_1.4fr_1fr_1fr] gap-2.5 py-[9px] border-b border-[#F7F6F4] text-[13px] items-center">
              <span className="text-[#A8A29E] font-mono tabular-nums text-xs">{items.length-i}</span>
              <span>{item.payRun.payDate}</span>
              <span className="text-right font-mono tabular-nums">{fmtCAD(item.gross)}</span>
              <span className="text-right font-mono tabular-nums">{item.ei>0?fmtCAD(item.gross):"$0.00"}</span>
            </div>
          ))}
          <div className="grid grid-cols-[50px_1.4fr_1fr_1fr] gap-2.5 pt-[11px] text-[13px] font-bold">
            <span></span>
            <span>Total</span>
            <span className="text-right font-mono tabular-nums">{fmtCAD(items.reduce((s,i)=>s+i.gross,0))}</span>
            <span className="text-right font-mono tabular-nums">{fmtCAD(totalInsurable)}</span>
          </div>
        </div>

        {/* YTD */}
        {ytd && (
          <div className="px-6 py-5 border-t border-[#F0EFED]">
            <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em] mb-3.5">YTD at Termination</p>
            <div className="grid grid-cols-4 gap-3">
              {[["Pensionable",ytd.pensionableEarnings],["CPP",ytd.cpp],["Insurable",ytd.insurableEarnings],["EI",ytd.ei]].map(([label,value])=>(
                <div key={label as string}><p className="text-[11px] text-[#A8A29E]">{label as string}</p><p className="text-sm font-semibold font-mono tabular-nums">{fmtCAD(value as number)}</p></div>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-4 bg-[#FAFAF9] border-t border-[#E7E5E4] flex gap-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] m-6 mt-0 text-[12.5px] text-[#1E40AF] leading-relaxed">
          ℹ️ Submit this ROE to Service Canada within 5 calendar days of the interruption of earnings. Use ROE Web for electronic filing.
        </div>
      </div>
    </div>
  );
}
