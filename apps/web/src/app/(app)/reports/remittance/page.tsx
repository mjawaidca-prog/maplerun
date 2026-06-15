/**
 * Remittance Report — pixel-matched to MapleRun Remittance Report design spec.
 * Regular remitter: due 15th of following month.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { RemittanceActions } from "@/components/remittance-actions";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }
function pct(part: number, total: number): number { return total > 0 ? Math.round((part / total) * 1000) / 10 : 0; }

type Tab = "breakdown" | "employees" | "history" | "schedule";

export default async function RemittancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { companyId } = await requireCompany();
  const { tab: rawTab } = await searchParams;
  const activeTab: Tab = (rawTab as Tab) ?? "breakdown";

  const runs = await prisma.payRun.findMany({
    where: { companyId, status: "FINALIZED" },
    include: { payGroup: { select: { name: true } }, items: { include: { employee: { select: { firstName: true, lastName: true } } } } },
    orderBy: { payDate: "desc" },
  });

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const periodRuns = runs.filter((r) => r.payDate.startsWith(currentPeriod));
  const employeeSet = new Set<string>(); periodRuns.forEach((r) => r.items.forEach((i) => employeeSet.add(i.employeeId)));

  // Totals
  const t = { cppEe: 0, cppEr: 0, cpp2Ee: 0, cpp2Er: 0, eiEe: 0, eiEr: 0, fedTax: 0, provTax: 0, gross: 0 };
  for (const r of periodRuns) {
    t.cppEe += r.totalCpp; t.cppEr += r.totalEmployerCpp;
    t.cpp2Ee += r.totalCpp2; t.cpp2Er += r.totalEmployerCpp2;
    t.eiEe += r.totalEi; t.eiEr += r.totalEmployerEi;
    t.fedTax += r.totalFederalTax; t.provTax += r.totalProvincialTax;
    t.gross += r.totalGross;
  }
  const totalCRA = t.cppEe + t.cppEr + t.cpp2Ee + t.cpp2Er + t.eiEe + t.eiEr + t.fedTax + t.provTax;
  const cppTotal = t.cppEe + t.cppEr; const eiTotal = t.eiEe + t.eiEr;
  const taxTotal = t.fedTax + t.provTax;
  const employeeEeTotal = t.cppEe + t.cpp2Ee + t.eiEe + t.fedTax + t.provTax;
  const employerTotal = t.cppEr + t.cpp2Er + t.eiEr;

  // Per-employee
  const empMap = new Map<string, { name: string; gross: number; cppEe: number; eiEe: number; fedTax: number; provTax: number }>();
  for (const r of periodRuns) for (const i of r.items) {
    const e = empMap.get(i.employeeId) || { name: `${i.employee.firstName} ${i.employee.lastName}`, gross: 0, cppEe: 0, eiEe: 0, fedTax: 0, provTax: 0 };
    e.gross += i.gross; e.cppEe += i.cpp; e.eiEe += i.ei; e.fedTax += i.federalTax; e.provTax += i.provincialTax;
    empMap.set(i.employeeId, e);
  }
  const employees = Array.from(empMap.values());

  // Due date
  const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  if (dueDate.getDay() === 0) dueDate.setDate(16); if (dueDate.getDay() === 6) dueDate.setDate(14);
  const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
  const isUrgent = daysLeft <= 14 && daysLeft > 0 && totalCRA > 0;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="text-[13px] text-[#A8A29E]"><Link href="/reports" className="text-[#A8A29E] no-underline">Compliance</Link> › Remittances</div>

      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-[#1C1917]">Remittance Report</h1>
          <p className="text-sm text-[#78716C] mt-1">Source deductions owing to the CRA — {currentPeriod} · {employeeSet.size} employees</p>
        </div>
        <RemittanceActions totalCRA={totalCRA} period={currentPeriod} />
      </div>

      {/* Alert Banner */}
      {isUrgent && (
        <div className="flex gap-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[11px] px-[18px] py-3.5 items-center">
          <span className="text-lg flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="text-[13.5px] font-bold text-[#991B1B]">Remittance due in {daysLeft} days — {dueDate.toISOString().slice(0, 10)}</p>
            <p className="text-[12.5px] text-[#B91C1C] leading-relaxed mt-0.5">{fmtCAD(totalCRA)} due to CRA · Business No. — · Regular remitter</p>
          </div>
          <button className="rounded-[9px] bg-[#B3261E] hover:bg-[#9B1C18] text-white text-xs font-semibold px-3.5 py-[7px] flex-shrink-0">Review &amp; Submit</button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-end gap-3.5 bg-white border border-[#E7E5E4] rounded-xl px-[18px] py-3.5 flex-wrap shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-[5px]">
          <span className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em]">Period</span>
          <div className="inline-flex gap-0.5 bg-[#F5F5F4] border border-[#E7E5E4] rounded-[9px] p-[3px]">
            {["Current month","Jan 2026","Year to date","Custom"].map((l,i)=>(
              <button key={l} className={`text-xs font-semibold px-[11px] py-1.5 rounded-md ${i===0?"bg-white text-[#1C1917] shadow-[0_1px_2px_rgba(0,0,0,0.08)]":"text-[#78716C]"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-[5px]">
          <span className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em]">Type</span>
          <select className="border border-[#D6D3D1] rounded-lg px-3 py-2 text-[13px] bg-white"><option>All types</option></select>
        </div>
        <div className="flex flex-col gap-[5px]">
          <span className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em]">Pay group</span>
          <select className="border border-[#D6D3D1] rounded-lg px-3 py-2 text-[13px] bg-white"><option>All staff</option></select>
        </div>
        <button className="rounded-[9px] border border-[#D6D3D1] bg-white text-[#1C1917] text-[13px] font-semibold px-4 py-2">Apply</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3.5">
        <div className="bg-[#1C1917] border border-[#1C1917] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">Total owing to CRA</p>
          <p className="text-[28px] font-extrabold tracking-[-0.02em] text-white font-mono tabular-nums mt-2">{fmtCAD(totalCRA)}</p>
          <p className="text-xs text-[#78716C] mt-1">{currentPeriod} · {employeeSet.size} employees</p>
          {totalCRA > 0 && <span className="inline-flex mt-2 text-[11px] font-bold tracking-[0.04em] bg-[#3F1413] text-[#E56A5C] rounded-full px-2.5 py-1">Due {dueDate.toISOString().slice(0,10)} · {daysLeft > 0 ? `${daysLeft} days` : "Overdue"}</span>}
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">CPP contributions</p>
          <p className="text-[28px] font-extrabold tracking-[-0.02em] font-mono tabular-nums mt-2">{fmtCAD(cppTotal)}</p>
          <p className="text-xs text-[#78716C] mt-1">Employee {fmtCAD(t.cppEe+t.cpp2Ee)} + Employer {fmtCAD(t.cppEr+t.cpp2Er)}</p>
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">EI premiums</p>
          <p className="text-[28px] font-extrabold tracking-[-0.02em] font-mono tabular-nums mt-2">{fmtCAD(eiTotal)}</p>
          <p className="text-xs text-[#78716C] mt-1">Employee {fmtCAD(t.eiEe)} + Employer {fmtCAD(t.eiEr)}</p>
        </div>
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">Income tax withheld</p>
          <p className="text-[28px] font-extrabold tracking-[-0.02em] font-mono tabular-nums mt-2">{fmtCAD(taxTotal)}</p>
          <p className="text-xs text-[#78716C] mt-1">Federal {fmtCAD(t.fedTax)} + Provincial {fmtCAD(t.provTax)}</p>
        </div>
      </div>

      {/* Account Info Strip */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden flex">
        {[
          ["Business number","—"],
          ["Remitter type","Regular remitter"],
          ["Pay period",currentPeriod],
          ["Pay runs",`${periodRuns.length} finalized`],
          ["Filing status",totalCRA>0?"Pending review":"No activity"],
          ["Prior month","—"],
        ].map(([label,value],i)=>(
          <div key={label} className={`flex-1 px-5 py-3.5 ${i<5?"border-r border-[#F0EFED]":""}`}>
            <p className="text-[10.5px] font-bold text-[#A8A29E] uppercase tracking-[0.04em]">{label}</p>
            <p className={`text-[13.5px] font-semibold mt-0.5 ${value==="Pending review"?"text-[#D97706]":value==="No activity"?"text-[#78716C]":"text-[#1C1917]"}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tab Bar — pill style from spec */}
      <div className="inline-flex gap-0.5 bg-[#F5F5F4] border border-[#E7E5E4] rounded-[10px] p-[3px]">
        {(["breakdown","employees","history","schedule"] as Tab[]).map((t)=>(
          <Link key={t} href={`/reports/remittance?tab=${t}`} className={`text-[13px] font-semibold px-[15px] py-[7px] rounded-[7px] no-underline capitalize ${activeTab===t?"bg-white text-[#1C1917] shadow-[0_1px_3px_rgba(0,0,0,0.08)]":"text-[#78716C]"}`}>{t==="breakdown"?"Deduction breakdown":t==="employees"?"By employee":t==="history"?"Remittance history":"Schedule & rates"}</Link>
        ))}
      </div>

      {/* ═══ Panel A: Deduction Breakdown ═══ */}
      {activeTab === "breakdown" && (
        <div className="space-y-3">
          <p className="text-[13px] font-bold text-[#78716C] uppercase tracking-[0.06em]">Deduction Breakdown</p>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <table className="w-full">
              <thead><tr className="bg-[#FAFAF9] text-[11px] font-bold text-[#78716C] uppercase tracking-[0.04em] border-b border-[#E7E5E4]">
                {["Component","Rate/basis","Employee","Employer","Total","%"].map(h=><th key={h} className={`px-4 py-[11px] ${h==="Component"?"text-left":h==="%"?`text-center`:"text-right"}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {/* CPP group */}
                <tr className="bg-[#FAFAF9]"><td colSpan={6} className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em] px-4 py-1.5">Canada Pension Plan</td></tr>
                {[["CPP Employee",`${totalCRA>0?pct(t.cppEe+t.cpp2Ee,totalCRA):0}%`,t.cppEe+t.cpp2Ee,0,"#B3261E"],["CPP Employer",`${totalCRA>0?pct(t.cppEr+t.cpp2Er,totalCRA):0}%`,0,t.cppEr+t.cpp2Er,"#E56A5C"]].map(([label,pctVal,ee,er,dot],i)=>(
                  <tr key={label as string} className="border-b border-[#F0EFED] hover:bg-[#FAFAF9] text-[13px]">
                    <td className="px-4 py-[13px] font-semibold"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{background:dot as string}}/>{label as string}</td>
                    <td className="text-right px-4 py-[13px]">5.95%</td>
                    <td className="text-right px-4 py-[13px] font-mono tabular-nums">{ee as number>0?fmtCAD(ee as number):"—"}</td>
                    <td className="text-right px-4 py-[13px] font-mono tabular-nums">{er as number>0?fmtCAD(er as number):"—"}</td>
                    <td className="text-right px-4 py-[13px] font-mono tabular-nums font-semibold">{fmtCAD((ee as number)+(er as number))}</td>
                    <td className="px-4 py-[13px]"><Bar pct={parseFloat(pctVal as string)} color={dot as string}/></td>
                  </tr>
                ))}
                {/* EI group */}
                <tr className="bg-[#FAFAF9]"><td colSpan={6} className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em] px-4 py-1.5">Employment Insurance</td></tr>
                {[["EI Employee",`${totalCRA>0?pct(t.eiEe,totalCRA):0}%`,t.eiEe,0,"#2563EB"],["EI Employer",`${totalCRA>0?pct(t.eiEr,totalCRA):0}%`,0,t.eiEr,"#60A5FA"]].map(([label,pctVal,ee,er,dot],i)=>(
                  <tr key={label as string} className="border-b border-[#F0EFED] hover:bg-[#FAFAF9] text-[13px]">
                    <td className="px-4 py-[13px] font-semibold"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{background:dot as string}}/>{label as string}</td>
                    <td className="text-right px-4 py-[13px]">1.63% / 2.28%</td>
                    <td className="text-right px-4 py-[13px] font-mono tabular-nums">{ee as number>0?fmtCAD(ee as number):"—"}</td>
                    <td className="text-right px-4 py-[13px] font-mono tabular-nums">{er as number>0?fmtCAD(er as number):"—"}</td>
                    <td className="text-right px-4 py-[13px] font-mono tabular-nums font-semibold">{fmtCAD((ee as number)+(er as number))}</td>
                    <td className="px-4 py-[13px]"><Bar pct={parseFloat(pctVal as string)} color={dot as string}/></td>
                  </tr>
                ))}
                {/* Tax group */}
                <tr className="bg-[#FAFAF9]"><td colSpan={6} className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em] px-4 py-1.5">Income Tax</td></tr>
                {[["Federal income tax",`${totalCRA>0?pct(t.fedTax,totalCRA):0}%`,t.fedTax,0,"#16A34A"],["Provincial income tax",`${totalCRA>0?pct(t.provTax,totalCRA):0}%`,t.provTax,0,"#4ADE80"]].map(([label,pctVal,ee,er,dot],i)=>(
                  <tr key={label as string} className="border-b border-[#F0EFED] hover:bg-[#FAFAF9] text-[13px]">
                    <td className="px-4 py-[13px] font-semibold"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{background:dot as string}}/>{label as string}</td>
                    <td className="text-right px-4 py-[13px]">Varies</td>
                    <td className="text-right px-4 py-[13px] font-mono tabular-nums">{ee as number>0?fmtCAD(ee as number):"—"}</td>
                    <td className="text-right px-4 py-[13px] font-mono tabular-nums">—</td>
                    <td className="text-right px-4 py-[13px] font-mono tabular-nums font-semibold">{fmtCAD(ee as number)}</td>
                    <td className="px-4 py-[13px]"><Bar pct={parseFloat(pctVal as string)} color={dot as string}/></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-[#1C1917] text-white font-bold text-[13px]">
                <td className="px-4 py-3">Total remittance to CRA — {currentPeriod}</td><td className="text-right px-4 py-3"></td>
                <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(employeeEeTotal)}</td>
                <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(employerTotal)}</td>
                <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(totalCRA)}</td><td className="px-4 py-3"></td>
              </tr></tfoot>
            </table>
          </div>
          <div className="flex gap-[11px] bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] px-4 py-3.5 text-[12.5px] text-[#1E40AF] leading-relaxed">
            💡 CPP employer matches employee 1:1. EI employer = 1.4× employee. Income tax = federal + provincial withheld. All remitted together to CRA by the 15th of the following month for regular remitters.
          </div>
        </div>
      )}

      {/* ═══ Panel B: By Employee ═══ */}
      {activeTab === "employees" && (
        <div className="space-y-3">
          <p className="text-[13px] font-bold text-[#78716C] uppercase tracking-[0.06em]">By Employee</p>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <table className="w-full">
              <thead><tr className="bg-[#FAFAF9] text-[11px] font-bold text-[#78716C] uppercase tracking-[0.04em] border-b border-[#E7E5E4]">
                {["Employee","Gross pay","CPP (ee)","EI (ee)","Fed tax","Prov tax","Total CRA"].map(h=><th key={h} className={`px-4 py-[11px] ${h==="Employee"?"text-left":"text-right"}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {employees.length===0?<tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-muted-foreground">No pay runs finalized for this period.</td></tr>:
                employees.slice(0,7).map((e,i)=>{
                  const cppEr = e.cppEe; const eiEr = e.eiEe * 1.4;
                  const total = e.cppEe + cppEr + e.eiEe + eiEr + e.fedTax + e.provTax;
                  const colors = ["#B3261E","#E56A5C","#1D4ED8","#60A5FA","#15803D","#4ADE80","#B45309","#FBBF24"];
                  return (
                    <tr key={e.name} className="border-b border-[#F0EFED] hover:bg-[#FAFAF9] text-[13px]">
                      <td className="px-4 py-3 flex items-center gap-2.5">
                        <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{background:`linear-gradient(135deg,${colors[i%8]},${colors[(i+1)%8]})`}}>{e.name[0]}</div>
                        <span className="font-semibold">{e.name}</span>
                      </td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(e.gross)}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(e.cppEe)}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(e.eiEe)}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(e.fedTax)}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(e.provTax)}</td>
                      <td className="text-right px-4 py-3 font-bold text-[#B3261E] font-mono tabular-nums">{fmtCAD(total)}</td>
                    </tr>
                  );
                })}
                {employees.length > 7 && (
                  <tr className="border-b border-[#F0EFED] text-[13px]"><td colSpan={7} className="px-4 py-3 text-center text-[#A8A29E]">+{employees.length-7} more employees</td></tr>
                )}
              </tbody>
              <tfoot><tr className="bg-[#1C1917] text-white font-bold text-[13px]">
                <td className="px-4 py-3">{employees.length} employees</td>
                <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(employees.reduce((s,e)=>s+e.gross,0))}</td>
                <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(employees.reduce((s,e)=>s+e.cppEe,0))}</td>
                <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(employees.reduce((s,e)=>s+e.eiEe,0))}</td>
                <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(employees.reduce((s,e)=>s+e.fedTax,0))}</td>
                <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(employees.reduce((s,e)=>s+e.provTax,0))}</td>
                <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(totalCRA)}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Panel C: Remittance History ═══ */}
      {activeTab === "history" && (
        <div className="space-y-3">
          <p className="text-[13px] font-bold text-[#78716C] uppercase tracking-[0.06em]">Remittance History</p>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <table className="w-full">
              <thead><tr className="bg-[#FAFAF9] text-[11px] font-bold text-[#78716C] uppercase tracking-[0.04em] border-b border-[#E7E5E4]">
                {["Period","Due date","Submitted","CPP total","EI total","Tax withheld","Total remitted","Status","Reference"].map(h=><th key={h} className={`px-4 py-[11px] ${h==="Period"?"text-left":"text-right"}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {Array.from({length:6}).map((_,i)=>{
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  const period = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
                  const pr = runs.filter((r) => r.payDate.startsWith(period));
                  const cpp = pr.reduce((s,r)=>s+r.totalCpp+r.totalEmployerCpp,0);
                  const ei = pr.reduce((s,r)=>s+r.totalEi+r.totalEmployerEi,0);
                  const tax = pr.reduce((s,r)=>s+r.totalFederalTax+r.totalProvincialTax,0);
                  const tot = cpp+ei+tax;
                  const due = new Date(d.getFullYear(), d.getMonth() + 1, 15);
                  const isCurrent = i===0;
                  const isLate = !isCurrent && tot===0;
                  return (
                    <tr key={period} className="border-b border-[#F0EFED] hover:bg-[#FAFAF9] text-[13px]">
                      <td className="px-4 py-3 font-semibold">{period}</td>
                      <td className="text-right px-4 py-3">{due.toISOString().slice(0,10)}</td>
                      <td className="text-right px-4 py-3 text-[#A8A29E]">{isCurrent?"—":due.toISOString().slice(0,10)}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{cpp>0?fmtCAD(cpp):"—"}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{ei>0?fmtCAD(ei):"—"}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{tax>0?fmtCAD(tax):"—"}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums font-semibold">{tot>0?fmtCAD(tot):"—"}</td>
                      <td className="text-right px-4 py-3">
                        <span className={`inline-flex items-center gap-[5px] text-[11px] font-bold tracking-[0.04em] rounded-full px-2.5 py-[3px] ${isCurrent&&tot>0?"bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]":tot>0?"bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]":"bg-[#F5F5F4] text-[#78716C]"}`}>
                          {isCurrent&&tot>0?"Pending":tot>0?"Submitted":"No activity"}
                        </span>
                      </td>
                      <td className="text-right px-4 py-3 font-mono text-xs text-[#A8A29E]">{tot>0?`PD7A-${period}-${companyId.slice(-6).toUpperCase()}`:"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Panel D: Schedule & Rates ═══ */}
      {activeTab === "schedule" && (
        <div className="grid grid-cols-2 gap-5">
          {/* Upcoming schedule */}
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-[18px] py-4 border-b border-[#F0EFED]"><span className="text-[15px] font-bold">Upcoming schedule</span></div>
            {Array.from({length:5}).map((_,i)=>{
              const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 15);
              const period = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
              const pr = runs.filter((r) => r.payDate.startsWith(period));
              const tot = pr.reduce((s,r)=>s+r.totalCpp+r.totalEmployerCpp+r.totalEi+r.totalEmployerEi+r.totalFederalTax+r.totalProvincialTax,0);
              const isNext = i===0; const isPast = i<0;
              return (
                <div key={d.toISOString()} className="flex gap-3.5 px-[18px] py-3.5 border-b border-[#F0EFED] last:border-b-0 hover:bg-[#FAFAF9] items-center">
                  <div className={`w-[46px] h-[46px] rounded-[10px] border flex flex-col items-center justify-center flex-shrink-0 ${isNext&&tot>0?"bg-[#FEF2F2] border-[#FECACA] text-[#B3261E]":"bg-[#F5F5F4] border-[#E7E5E4]"}`}>
                    <span className="text-[9px] font-bold uppercase text-[#A8A29E]">{d.toLocaleString('default',{month:'short'})}</span>
                    <span className="text-lg font-extrabold tracking-[-0.02em]">{d.getDate()}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{period} remittance</p>
                    <p className="text-xs text-[#A8A29E]">CRA · Regular remitter{isNext&&tot>0?` · ${daysLeft} days remaining`:""}</p>
                  </div>
                  <span className={`text-sm font-bold font-mono tabular-nums ${isNext&&tot>0?"text-[#B3261E]":"text-[#A8A29E"}`}>{tot>0?fmtCAD(tot):isNext?"~$0":"~$0"}</span>
                </div>
              );
            })}
          </div>

          {/* Statutory rates */}
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <p className="text-[15px] font-bold mb-4">2026 statutory rates</p>
            {[
              ["🧮", "#FEF2F2", "CPP employee rate", "Pensionable above $3,500/yr exemption. Max $74,600.", "5.95%"],
              ["🧮", "#FEF2F2", "CPP2 additional", "Earnings $74,600–$85,000. Higher earners only.", "4.00%"],
              ["🔹", "#EFF6FF", "EI employee premium", "Insurable up to max annual $68,900.", "1.63%"],
              ["🔹", "#EFF6FF", "EI employer multiplier", "1.4× employee premium.", "×1.4"],
              ["📅", "#F0FDF4", "Remitter type threshold", "Regular: avg monthly $1,000–$24,999. Due 15th.", "15th"],
            ].map(([icon,iconBg,name,desc,value],i)=>(
              <div key={name} className={`flex gap-3 py-2.5 ${i<4?"border-b border-[#F0EFED]":""} items-center`}>
                <div className="w-9 h-9 rounded-[9px] flex items-center justify-center text-lg flex-shrink-0" style={{background:iconBg}}>{icon}</div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold">{name}</p>
                  <p className="text-[11px] text-[#A8A29E]">{desc}</p>
                </div>
                <span className="text-[13px] font-bold font-mono tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[120px] h-1.5 rounded-full bg-[#F0EFED]">
        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="text-[11px] text-[#A8A29E] font-mono tabular-nums">{pct}%</span>
    </div>
  );
}
