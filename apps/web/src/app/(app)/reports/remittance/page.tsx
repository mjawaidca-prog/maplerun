/**
 * Remittance Report — CRA deduction breakdown, per-employee, history, schedule.
 * Regular remitter: due 15th of following month.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StubPrintButton } from "@/components/stub-actions";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

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

  // Totals
  const totals = { cppEe: 0, cppEr: 0, cpp2Ee: 0, cpp2Er: 0, eiEe: 0, eiEr: 0, fedTax: 0, provTax: 0 };
  for (const r of runs) {
    totals.cppEe += r.totalCpp; totals.cppEr += r.totalEmployerCpp;
    totals.cpp2Ee += r.totalCpp2; totals.cpp2Er += r.totalEmployerCpp2;
    totals.eiEe += r.totalEi; totals.eiEr += r.totalEmployerEi;
    totals.fedTax += r.totalFederalTax; totals.provTax += r.totalProvincialTax;
  }
  const totalCRA = totals.cppEe + totals.cppEr + totals.cpp2Ee + totals.cpp2Er + totals.eiEe + totals.eiEr + totals.fedTax + totals.provTax;

  // Per-employee breakdown
  const empMap = new Map<string, { name: string; cppEe: number; cppEr: number; eiEe: number; eiEr: number; fedTax: number; provTax: number }>();
  for (const r of runs) {
    for (const i of r.items) {
      const e = empMap.get(i.employeeId) || { name: `${i.employee.firstName} ${i.employee.lastName}`, cppEe: 0, cppEr: 0, eiEe: 0, eiEr: 0, fedTax: 0, provTax: 0 };
      e.cppEe += i.cpp; e.cppEr += i.employerCpp; e.eiEe += i.ei; e.eiEr += i.employerEi;
      e.fedTax += i.federalTax; e.provTax += i.provincialTax;
      empMap.set(i.employeeId, e);
    }
  }
  const employees = Array.from(empMap.values());

  // Remittance schedule
  const dueDates = [];
  const now = new Date();
  for (let m = 0; m < 6; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 15);
    if (d.getDay() === 0) d.setDate(16);
    if (d.getDay() === 6) d.setDate(14);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const periodRuns = runs.filter((r) => r.payDate.startsWith(period));
    const amount = periodRuns.reduce((s, r) => s + r.totalCpp + r.totalEmployerCpp + r.totalCpp2 + r.totalEmployerCpp2 + r.totalEi + r.totalEmployerEi + r.totalFederalTax + r.totalProvincialTax, 0);
    dueDates.push({ date: d.toISOString().slice(0, 10), period, amount, status: amount > 0 ? "Pending" : "No activity", ref: amount > 0 ? `PD7A-${period}-${companyId.slice(-6).toUpperCase()}` : "—" });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "breakdown", label: "Deduction Breakdown" },
    { key: "employees", label: "By Employee" },
    { key: "history", label: "Remittance History" },
    { key: "schedule", label: "Schedule & Rates" },
  ];

  return (
    <div className="space-y-6">
      <div className="text-[13px] text-[#A8A29E]"><Link href="/reports" className="text-[#A8A29E] no-underline">Reports</Link> › Remittance</div>
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Remittance Report</h1>
          <p className="text-sm text-muted-foreground mt-1">CRA source deductions — Regular remitter · Due 15th of each month</p>
        </div>
        <StubPrintButton />
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-[#E7E5E4]">
        {tabs.map((t) => (
          <Link key={t.key} href={`/reports/remittance?tab=${t.key}`} className={`text-sm font-semibold pb-3 border-b-2 -mb-[1px] no-underline ${activeTab === t.key ? "text-[#B3261E] border-[#B3261E]" : "text-[#A8A29E] border-transparent hover:text-[#1C1917]"}`}>{t.label}</Link>
        ))}
      </div>

      {/* Tab: Deduction Breakdown */}
      {activeTab === "breakdown" && (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <table className="w-full">
            <thead><tr className="bg-[#FAFAF9] text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.04em] border-b border-[#E7E5E4]">
              {["Component","Rate","Employee","Employer","Total CRA","%"].map(h=><th key={h} className={`px-5 py-2.5 ${h==="Component"?"text-left":"text-right"}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {[
                ["CPP","5.95%",totals.cppEe,totals.cppEr,totals.cppEe+totals.cppEr],
                ["CPP2","4.00%",totals.cpp2Ee,totals.cpp2Er,totals.cpp2Ee+totals.cpp2Er],
                ["EI","1.63%",totals.eiEe,totals.eiEr,totals.eiEe+totals.eiEr],
                ["Federal Tax","Bracket",totals.fedTax,0,totals.fedTax],
                ["Provincial Tax","Bracket",totals.provTax,0,totals.provTax],
              ].map(([label,rate,ee,er,total],i)=>(
                <tr key={label as string} className={`border-b border-[#F0EFED] text-[13px] ${i%2?"bg-[#FAFAF9]":""}`}>
                  <td className="px-5 py-3 font-semibold">{label as string}</td>
                  <td className="text-right px-5 py-3 text-[#57534E]">{rate as string}</td>
                  <td className="text-right px-5 py-3 font-mono tabular-nums">{fmtCAD(ee as number)}</td>
                  <td className="text-right px-5 py-3 font-mono tabular-nums">{fmtCAD(er as number)}</td>
                  <td className="text-right px-5 py-3 font-mono tabular-nums font-semibold">{fmtCAD(total as number)}</td>
                  <td className="text-right px-5 py-3">
                    <div className="inline-block h-1.5 rounded-full bg-[#F0EFED] w-[60px]"><div className="h-1.5 rounded-full bg-[#B3261E]" style={{width:`${totalCRA>0?((total as number)/totalCRA*100):0}%`}}/></div>
                    <span className="text-[11px] text-[#A8A29E] ml-2">{totalCRA>0?Math.round((total as number)/totalCRA*100):0}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-[#1C1917] text-white font-bold text-[13px]">
              <td className="px-5 py-3">Total Remittance</td><td className="text-right px-5 py-3"></td>
              <td className="text-right px-5 py-3 font-mono tabular-nums">{fmtCAD(totals.cppEe+totals.cpp2Ee+totals.eiEe+totals.fedTax+totals.provTax)}</td>
              <td className="text-right px-5 py-3 font-mono tabular-nums">{fmtCAD(totals.cppEr+totals.cpp2Er+totals.eiEr)}</td>
              <td className="text-right px-5 py-3 font-mono tabular-nums">{fmtCAD(totalCRA)}</td><td className="text-right px-5 py-3">100%</td>
            </tr></tfoot>
          </table>
        </div>
      )}

      {/* Tab: By Employee */}
      {activeTab === "employees" && (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <table className="w-full">
            <thead><tr className="bg-[#FAFAF9] text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.04em] border-b border-[#E7E5E4]">
              {["Employee","CPP (ee/er)","EI (ee/er)","Fed Tax","Prov Tax","Total CRA"].map(h=><th key={h} className={`px-5 py-2.5 ${h==="Employee"?"text-left":"text-right"}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {employees.length===0?<tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-muted-foreground">No finalized pay runs.</td></tr>:
              employees.map((e,i)=>(
                <tr key={e.name} className={`border-b border-[#F0EFED] text-[13px] ${i%2?"bg-[#FAFAF9]":""}`}>
                  <td className="px-5 py-3 font-semibold">{e.name}</td>
                  <td className="text-right px-5 py-3 font-mono tabular-nums">{fmtCAD(e.cppEe)} / {fmtCAD(e.cppEr)}</td>
                  <td className="text-right px-5 py-3 font-mono tabular-nums">{fmtCAD(e.eiEe)} / {fmtCAD(e.eiEr)}</td>
                  <td className="text-right px-5 py-3 font-mono tabular-nums">{fmtCAD(e.fedTax)}</td>
                  <td className="text-right px-5 py-3 font-mono tabular-nums">{fmtCAD(e.provTax)}</td>
                  <td className="text-right px-5 py-3 font-mono tabular-nums font-bold">{fmtCAD(e.cppEe+e.cppEr+e.eiEe+e.eiEr+e.fedTax+e.provTax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Remittance History */}
      {activeTab === "history" && (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <table className="w-full">
            <thead><tr className="bg-[#FAFAF9] text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.04em] border-b border-[#E7E5E4]">
              {["Period","Due Date","Status","Amount","Reference"].map(h=><th key={h} className={`px-5 py-2.5 ${h==="Period"?"text-left":"text-right"}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {dueDates.map((d,i)=>(
                <tr key={d.period} className={`border-b border-[#F0EFED] text-[13px] ${i%2?"bg-[#FAFAF9]":""}`}>
                  <td className="px-5 py-3 font-semibold">{d.period}</td>
                  <td className="text-right px-5 py-3">{d.date}</td>
                  <td className="text-right px-5 py-3">
                    <span className={`inline-flex text-[11px] font-bold tracking-[0.03em] rounded-full px-2.5 py-1 ${d.status==="Pending"?"bg-[#FEF3C7] text-[#92400E]":d.status==="Submitted"?"bg-[#DCFCE7] text-[#15803D]":"bg-[#F0EFED] text-[#57534E]"}`}>{d.status}</span>
                  </td>
                  <td className="text-right px-5 py-3 font-mono tabular-nums">{d.amount>0?fmtCAD(d.amount):"—"}</td>
                  <td className="text-right px-5 py-3 font-mono text-xs text-[#A8A29E]">{d.ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Schedule & Rates */}
      {activeTab === "schedule" && (
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-5 py-4 border-b border-[#F0EFED]"><span className="text-[15px] font-bold">Upcoming Due Dates</span></div>
            <div className="p-5 space-y-3">
              {dueDates.filter(d=>d.amount>0).slice(0, 4).map(d=>(
                <div key={d.date} className="flex justify-between items-center border border-[#E7E5E4] rounded-lg px-4 py-3">
                  <div><p className="text-sm font-semibold">{d.period}</p><p className="text-xs text-[#A8A29E]">{d.date}</p></div>
                  <div className="text-right"><p className="text-sm font-bold font-mono tabular-nums">{fmtCAD(d.amount)}</p><span className="text-[11px] font-semibold text-[#92400E] bg-[#FEF3C7] rounded-full px-2.5 py-0.5">{d.status}</span></div>
                </div>
              ))}
              {dueDates.filter(d=>d.amount>0).length===0&&<p className="text-[13px] text-muted-foreground text-center py-8">No amounts due.</p>}
            </div>
          </div>
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-5 py-4 border-b border-[#F0EFED]"><span className="text-[15px] font-bold">2026 CRA Rates</span></div>
            <div className="p-5">
              <div className="border border-[#E7E5E4] rounded-[10px] overflow-hidden">
                {[
                  ["CPP employee rate","5.95%","On pensionable up to $74,600"],
                  ["CPP2 employee rate","4.00%","On earnings $74,600–$85,000"],
                  ["EI employee rate","1.63%","On insurable up to $68,900"],
                  ["EI QC reduced rate","1.30%","Quebec employees"],
                  ["Employer CPP","1.0× employee","Match"],
                  ["Employer EI","1.4× employee","Employer multiplier"],
                  ["Remittance frequency","Monthly","Regular remitter"],
                  ["Due date","15th","Of following month"],
                ].map(([label,rate,note],i)=>(
                  <div key={label} className={`flex justify-between px-4 py-2.5 text-[13px] border-b border-[#F0EFED] last:border-b-0 ${i%2?"bg-[#FAFAF9]":""}`}>
                    <span className="font-medium">{label}</span>
                    <span className="text-right"><span className="font-mono tabular-nums font-semibold">{rate}</span><span className="text-[11px] text-[#A8A29E] ml-2">{note}</span></span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#A8A29E] mt-3">Source: CRA T4127 123rd ed. (Jul 2026). Remit by 15th of each month for regular remitters.</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-[11px] bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] px-4 py-3.5 text-[12.5px] text-[#1E40AF] leading-relaxed">
        ℹ️ Regular remitter: payments due by the <b>15th of the following month</b>. Verify against your CRA PD7A statement. Remittance = employee + employer CPP/CPP2/EI + income tax withheld.
      </div>
    </div>
  );
}
