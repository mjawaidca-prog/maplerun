/**
 * Remittance Report — pixel-matched to MapleRun Remittance Report design spec.
 * Due dates come from the shared remitter-aware helper
 * (remittanceDueDateFor): CRA's next-business-day rule lives there, never
 * inline. The scope is URL-driven (the `period` search param, resolved by
 * resolveRemittanceScope): one period — current, or any period with
 * finalized runs — or the year-to-date totals. The scope is labelled
 * wherever a figure appears; the Reports hub PD7A figure is the YTD one
 * (PR #14 FLAG A). W4-D11: the period selector used to be hardcoded
 * decorative buttons and the report was pinned to the current period, so
 * past periods (and their Revenu Québec section) were unreachable.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  aggregateQuebecRemittances,
  aggregateRemittances,
  groupingForRemitterType,
  periodKeyForDate,
  periodKeyForPayDate,
  periodLabel,
  remittanceDueDateFor,
  remittancePeriodOptions,
  remitterTypeLabel,
  resolveRemittanceScope,
  REMITTANCE_YTD_SCOPE,
  type QuebecRemittanceItemRow,
} from "@/lib/remittance/aggregate";
import {
  getRemittanceSubmissions,
  getRemitterType,
} from "@/lib/actions/remittance";
import { RemittanceActions } from "@/components/remittance-actions";
import {
  MarkSubmittedControl,
  RemitterTypeSelector,
} from "@/components/remittance-submission-controls";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }
function pct(part: number, total: number): number { return total > 0 ? Math.round((part / total) * 1000) / 10 : 0; }

type Tab = "breakdown" | "employees" | "history" | "schedule";

export default async function RemittancePage({ searchParams }: { searchParams: Promise<{ tab?: string; period?: string }> }) {
  const { companyId } = await requireCompany();
  const { tab: rawTab, period: rawPeriod } = await searchParams;
  const activeTab: Tab = (rawTab as Tab) ?? "breakdown";

  const runs = await prisma.payRun.findMany({
    where: { companyId, status: "FINALIZED" },
    include: { payGroup: { select: { name: true, defaultProvince: true } }, items: { include: { employee: { select: { firstName: true, lastName: true, provinceOfEmployment: true } } } } },
    orderBy: { payDate: "desc" },
  });

  // Remitter type drives grouping (QUARTERLY → quarters, else monthly) and
  // due dates. Submissions are the persisted RemittanceSubmission records.
  const remitterType = await getRemitterType();
  const grouping = groupingForRemitterType(remitterType);
  const submissions = await getRemittanceSubmissions();
  const remitterLabel = remitterTypeLabel(remitterType);

  const now = new Date();
  const currentPeriod = periodKeyForDate(now, grouping);

  // Totals — computed by the shared remittance aggregation (the same code
  // path behind the Reports hub PD7A figure), never recomputed inline.
  // Grouping follows the company's remitter type.
  const remittanceAgg = aggregateRemittances(runs, grouping);
  const periodAgg = new Map(remittanceAgg.periods.map((p) => [p.period, p]));

  // Scope (W4-D11): the `period` search param selects a single period or
  // the year-to-date totals; absent/invalid → the current period, exactly
  // the pre-D11 behaviour. The selector offers the current period plus
  // every period present in the aggregation (finalized runs), and YTD.
  const scope = resolveRemittanceScope(rawPeriod, currentPeriod, grouping);
  const isYtd = scope.kind === "ytd";
  const selectedPeriod = isYtd ? null : scope.period;
  const periodOptions = remittancePeriodOptions(
    remittanceAgg.periods.map((p) => p.period),
    currentPeriod,
  );
  const scopeLabel = isYtd
    ? "Year to date"
    : selectedPeriod === currentPeriod
      ? `Current period — ${periodLabel(selectedPeriod!)}`
      : `${periodLabel(selectedPeriod!)} (${selectedPeriod})`;

  // Runs inside the scope, via the shared period-key helper (monthly
  // behaviour identical to the old payDate-prefix filter).
  const periodRuns = isYtd
    ? runs
    : runs.filter(
        (r) => periodKeyForPayDate(r.payDate, grouping) === selectedPeriod,
      );
  const employeeSet = new Set<string>(); periodRuns.forEach((r) => r.items.forEach((i) => employeeSet.add(i.employeeId)));

  // Scope figures: the selected period's Pd7aPeriod, or the aggregation
  // totals for YTD — both carry the same money fields, so every figure
  // below reads from `sel` regardless of scope. A selected period with
  // no runs (deep link only) reads zeros.
  const sel = isYtd
    ? remittanceAgg.totals
    : (periodAgg.get(selectedPeriod!) ?? {
        employeeCpp: 0, employeeCpp2: 0, employeeEi: 0,
        employerCpp: 0, employerCpp2: 0, employerEi: 0,
        federalTax: 0, provincialTax: 0, totalRemittance: 0,
      });
  // Year-to-date total (FLAG A): the totals over every period in the
  // aggregation — the same scope the Reports hub PD7A card shows.
  const ytdTotal = remittanceAgg.totals.totalRemittance;
  const t = {
    cppEe: sel.employeeCpp, cppEr: sel.employerCpp,
    cpp2Ee: sel.employeeCpp2, cpp2Er: sel.employerCpp2,
    eiEe: sel.employeeEi, eiEr: sel.employerEi,
    fedTax: sel.federalTax, provTax: sel.provincialTax,
    gross: periodRuns.reduce((s, r) => s + r.totalGross, 0),
  };
  const totalCRA = sel.totalRemittance;
  const cppTotal = t.cppEe + t.cppEr; const eiTotal = t.eiEe + t.eiEr;
  const taxTotal = t.fedTax + t.provTax;
  const employeeEeTotal = t.cppEe + t.cpp2Ee + t.eiEe + t.fedTax + t.provTax;
  const employerTotal = t.cppEr + t.cpp2Er + t.eiEr;

  // Per-employee — employer portions come from the items' actual employer
  // fields (previously fabricated as employer CPP = employee CPP and
  // employer EI = 1.4 × employee EI, which need not match the run totals).
  const empMap = new Map<string, { name: string; gross: number; cppEe: number; eiEe: number; fedTax: number; provTax: number; totalCra: number }>();
  for (const r of periodRuns) for (const i of r.items) {
    const e = empMap.get(i.employeeId) || { name: `${i.employee.firstName} ${i.employee.lastName}`, gross: 0, cppEe: 0, eiEe: 0, fedTax: 0, provTax: 0, totalCra: 0 };
    e.gross += i.gross; e.cppEe += i.cpp; e.eiEe += i.ei; e.fedTax += i.federalTax; e.provTax += i.provincialTax;
    e.totalCra += i.cpp + i.cpp2 + i.ei + i.federalTax + i.provincialTax + i.employerCpp + i.employerCpp2 + i.employerEi;
    empMap.set(i.employeeId, e);
  }
  const employees = Array.from(empMap.values());

  // W4-D3 — Revenu Québec section: the scope's Quebec items, aggregated
  // from the split columns (the CRA figures above fold QPP into CPP and
  // QPIP into EI because they are built from run totals; this section
  // separates the amounts owed to Revenu Québec instead). W4-D11: the
  // scope follows the selected period / YTD, so a past period's Quebec
  // amounts stay reachable after the period stops being current.
  const qcItems: QuebecRemittanceItemRow[] = [];
  for (const r of periodRuns) {
    for (const i of r.items) {
      const province = i.employee.provinceOfEmployment ?? r.payGroup.defaultProvince;
      if (province !== "QC") continue;
      qcItems.push({
        qpp: i.qpp, qpp2: i.qpp2, qpip: i.qpip, ei: i.ei,
        employerCpp: i.employerCpp, employerCpp2: i.employerCpp2, employerEi: i.employerEi,
        quebecTax: i.provincialTax,
      });
    }
  }
  const rq = aggregateQuebecRemittances(qcItems);

  // Due date — from the shared remitter-aware helper (PR #14 FLAG B: the
  // old inline code shifted Saturday BACK to the Friday 14th; CRA's rule
  // is the NEXT business day, and that rule now lives in
  // lib/remittance/aggregate.ts alongside every other remittance rule).
  // A single period has one due date and one submission state; the YTD
  // scope has neither, so both stay null there.
  const dueDateStr = isYtd ? null : remittanceDueDateFor(selectedPeriod!, remitterType);
  const dueDate = dueDateStr ? new Date(`${dueDateStr}T12:00:00`) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / 86400000) : null;
  const isUrgent = !isYtd && selectedPeriod === currentPeriod && daysLeft !== null && daysLeft <= 14 && daysLeft > 0 && totalCRA > 0;
  const selectedSubmission = isYtd ? undefined : submissions[selectedPeriod!];

  // URL builder for the scope selector and the tab bar: each preserves
  // the other param so switching scope keeps the tab and vice versa.
  const hrefFor = (opts: { tab?: Tab; period?: string | null }) => {
    const params = new URLSearchParams();
    const period = opts.period === undefined ? rawPeriod : opts.period;
    if (period) params.set("period", period);
    const tab = opts.tab ?? activeTab;
    if (tab !== "breakdown") params.set("tab", tab);
    const qs = params.toString();
    return qs ? `/reports/remittance?${qs}` : "/reports/remittance";
  };

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Breadcrumb */}
      <div className="text-[13px] text-[#A8A29E] print:hidden"><Link href="/reports" className="text-[#A8A29E] no-underline">Compliance</Link> › Remittances</div>

      {/* Print-only header */}
      <div className="hidden print:block text-center border-b-2 border-black pb-4 mb-4">
        <h1 className="text-xl font-bold">Nexvar Pay — Remittance Report</h1>
        <p className="text-sm">{isYtd ? "Year to date" : `${selectedPeriod === currentPeriod ? "Current period — " : ""}${periodLabel(selectedPeriod!)} (${selectedPeriod})`} · {remitterLabel}{dueDateStr ? ` · Due ${dueDateStr}` : ""}</p>
        <p className="text-sm font-bold mt-1">Total Owing to CRA: {fmtCAD(totalCRA)}</p>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-start print:hidden">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-[#1C1917]">Remittance Report</h1>
          <p className="text-sm text-[#78716C] mt-1">Source deductions owing to the CRA — {scopeLabel} · {employeeSet.size} employees</p>
        </div>
        {!isYtd && (
          <RemittanceActions totalCRA={totalCRA} period={selectedPeriod!} dueDate={dueDateStr!} remitterLabel={remitterLabel} alreadySubmitted={!!selectedSubmission} />
        )}
      </div>

      {/* Alert Banner */}
      {isUrgent && (
        <div className="flex gap-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[11px] px-[18px] py-3.5 items-center">
          <span className="text-lg flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="text-[13.5px] font-bold text-[#991B1B]">Remittance due in {daysLeft} days — {dueDateStr}</p>
            <p className="text-[12.5px] text-[#B91C1C] leading-relaxed mt-0.5">{fmtCAD(totalCRA)} due to CRA · Business No. — · {remitterLabel}</p>
          </div>
          <button className="rounded-[9px] bg-[#B3261E] hover:bg-[#9B1C18] text-white text-xs font-semibold px-3.5 py-[7px] flex-shrink-0">Review &amp; Submit</button>
        </div>
      )}

      {/* Filter Bar — W4-D11: the period control is real now (URL-driven
          Links, same pattern as the tab bar). The old bar rendered
          hardcoded decorative period buttons plus placeholder Type /
          Pay group dropdowns and a dead Apply button — those are gone;
          no control remains that does not change the report. */}
      <div className="flex items-end gap-3.5 bg-white border border-[#E7E5E4] rounded-xl px-[18px] py-3.5 flex-wrap shadow-[0_1px_3px_rgba(0,0,0,0.04)] print:hidden">
        <div className="flex flex-col gap-[5px]">
          <span className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em]">Period</span>
          <div className="inline-flex gap-0.5 bg-[#F5F5F4] border border-[#E7E5E4] rounded-[9px] p-[3px] flex-wrap">
            {periodOptions.map((p) => {
              const active = !isYtd && p === selectedPeriod;
              return (
                <Link
                  key={p}
                  href={hrefFor({ period: p === currentPeriod ? null : p })}
                  className={`text-xs font-semibold px-[11px] py-1.5 rounded-md no-underline ${active ? "bg-white text-[#1C1917] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#78716C]"}`}
                >
                  {periodLabel(p)}{p === currentPeriod ? " (current)" : ""}
                </Link>
              );
            })}
            <Link
              href={hrefFor({ period: REMITTANCE_YTD_SCOPE })}
              className={`text-xs font-semibold px-[11px] py-1.5 rounded-md no-underline ${isYtd ? "bg-white text-[#1C1917] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#78716C]"}`}
            >
              Year to date
            </Link>
          </div>
        </div>
        {/* Remitter type — Wave 1's Company.remitterType, settable here.
            Changing it regroups periods (QUARTERLY) and re-derives due dates. */}
        <RemitterTypeSelector current={remitterType} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3.5">
        <div className="bg-[#1C1917] border border-[#1C1917] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">Total owing to CRA</p>
          <p className="text-[28px] font-extrabold tracking-[-0.02em] text-white font-mono tabular-nums mt-2">{fmtCAD(totalCRA)}</p>
          {/* FLAG A scope label: this lead figure is the SELECTED scope
              only — the Reports hub PD7A figure is the year-to-date scope.
              The scope is named on the card itself (W4-D11). */}
          <p className="text-xs text-[#78716C] mt-1">{scopeLabel} · {employeeSet.size} employees</p>
          {!isYtd && <p className="text-xs text-[#78716C] mt-0.5">Year to date: {fmtCAD(ytdTotal)}</p>}
          {selectedSubmission ? (
            <span className="inline-flex mt-2 text-[11px] font-bold tracking-[0.04em] bg-[#14532D] text-[#4ADE80] rounded-full px-2.5 py-1">✓ Submitted {selectedSubmission.submittedAt.toISOString().slice(0, 10)}{selectedSubmission.reference ? ` · ${selectedSubmission.reference}` : ""}</span>
          ) : !isYtd && totalCRA > 0 ? (
            <span className="inline-flex mt-2 text-[11px] font-bold tracking-[0.04em] bg-[#3F1413] text-[#E56A5C] rounded-full px-2.5 py-1">Due {dueDateStr} · {daysLeft !== null && daysLeft > 0 ? `${daysLeft} days` : "Overdue"}</span>
          ) : null}
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
          ["Remitter type",remitterLabel],
          ["Pay period",isYtd ? "Year to date" : selectedPeriod!],
          ["Pay runs",`${periodRuns.length} finalized`],
          ["Filing status",isYtd?"—":selectedSubmission?"Submitted":totalCRA>0?"Pending review":"No activity"],
          ["Prior month","—"],
        ].map(([label,value],i)=>(
          <div key={label} className={`flex-1 px-5 py-3.5 ${i<5?"border-r border-[#F0EFED]":""}`}>
            <p className="text-[10.5px] font-bold text-[#A8A29E] uppercase tracking-[0.04em]">{label}</p>
            <p className={`text-[13.5px] font-semibold mt-0.5 ${value==="Pending review"?"text-[#D97706]":value==="No activity"?"text-[#78716C]":"text-[#1C1917]"}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tab Bar — pill style from spec */}
      <div className="inline-flex gap-0.5 bg-[#F5F5F4] border border-[#E7E5E4] rounded-[10px] p-[3px] print:hidden">
        {(["breakdown","employees","history","schedule"] as Tab[]).map((t)=>(
          <Link key={t} href={hrefFor({ tab: t })} className={`text-[13px] font-semibold px-[15px] py-[7px] rounded-[7px] no-underline capitalize ${activeTab===t?"bg-white text-[#1C1917] shadow-[0_1px_3px_rgba(0,0,0,0.08)]":"text-[#78716C]"}`}>{t==="breakdown"?"Deduction breakdown":t==="employees"?"By employee":t==="history"?"Remittance history":"Schedule & rates"}</Link>
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
                {[["EI Employee",`${totalCRA>0?pct(t.eiEe,totalCRA):0}%`,t.eiEe,0,"#2563EB","1.63%"],["EI Employer",`${totalCRA>0?pct(t.eiEr,totalCRA):0}%`,0,t.eiEr,"#60A5FA","2.28% (×1.4)"]].map(([label,pctVal,ee,er,dot,rateStr],i)=>(
                  <tr key={label as string} className="border-b border-[#F0EFED] hover:bg-[#FAFAF9] text-[13px]">
                    <td className="px-4 py-[13px] font-semibold"><span className="inline-block w-2 h-2 rounded-full mr-2" style={{background:dot as string}}/>{label as string}</td>
                    <td className="text-right px-4 py-[13px]">{rateStr as string}</td>
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
                <td className="px-4 py-3">Total remittance to CRA — {isYtd ? "Year to date" : selectedPeriod}</td><td className="text-right px-4 py-3"></td>
                <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(employeeEeTotal)}</td>
                <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(employerTotal)}</td>
                <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(totalCRA)}</td><td className="px-4 py-3"></td>
              </tr></tfoot>
            </table>
          </div>
          {/* W4-D3 — Revenu Québec: QPP/QPP2/QPIP/Québec tax are remitted
              to Revenu Québec, not the CRA. These amounts are currently
              ALSO inside the CRA totals above (which are built from run
              totals) — this section separates them for the RQ payment. */}
          {rq.items > 0 && (
            <>
              <p className="text-[13px] font-bold text-[#78716C] uppercase tracking-[0.06em] pt-2">Revenu Québec — {isYtd ? "Year to date" : periodLabel(selectedPeriod!)}</p>
              <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <table className="w-full">
                  <thead><tr className="bg-[#FAFAF9] text-[11px] font-bold text-[#78716C] uppercase tracking-[0.04em] border-b border-[#E7E5E4]">
                    {["Component","Employee","Employer","Total"].map(h=><th key={h} className={`px-4 py-[11px] ${h==="Component"?"text-left":"text-right"}`}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {[
                      ["QPP contributions", rq.qppEmployee, rq.qppEmployer],
                      ["QPP2 contributions", rq.qpp2Employee, rq.qpp2Employer],
                      ["QPIP premiums", rq.qpipEmployee, rq.qpipEmployer],
                      ["Québec income tax withheld", rq.quebecTax, 0],
                    ].map(([label, ee, er]) => (
                      <tr key={label as string} className="border-b border-[#F0EFED] text-[13px]">
                        <td className="px-4 py-[11px] font-semibold">{label as string}</td>
                        <td className="text-right px-4 py-[11px] font-mono tabular-nums">{(ee as number) > 0 ? fmtCAD(ee as number) : "—"}</td>
                        <td className="text-right px-4 py-[11px] font-mono tabular-nums">{(er as number) > 0 ? fmtCAD(er as number) : "—"}</td>
                        <td className="text-right px-4 py-[11px] font-mono tabular-nums font-semibold">{fmtCAD((ee as number) + (er as number))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="bg-[#1C1917] text-white font-bold text-[13px]">
                    <td className="px-4 py-3">Total remittance to Revenu Québec — {isYtd ? "Year to date" : selectedPeriod}</td>
                    <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(rq.qppEmployee + rq.qpp2Employee + rq.qpipEmployee + rq.quebecTax)}</td>
                    <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(rq.qppEmployer + rq.qpp2Employer + rq.qpipEmployer)}</td>
                    <td className="text-right px-4 py-3 font-mono tabular-nums">{fmtCAD(rq.totalRq)}</td>
                  </tr></tfoot>
                </table>
              </div>
              <p className="text-[12.5px] text-[#78716C] leading-relaxed">
                Remit these amounts to Revenu Québec (RL-1 / RQ remittance), not to the CRA. They are shown separately here because the CRA totals above are built from run totals, where QPP rides in the CPP figures and QPIP in the EI figures.
              </p>
            </>
          )}
          <div className="flex gap-[11px] bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] px-4 py-3.5 text-[12.5px] text-[#1E40AF] leading-relaxed">
            💡 CPP employer matches employee 1:1. EI employer = 1.4× employee. Income tax = federal + provincial withheld. All remitted together to CRA. {remitterType === "ACCELERATED1"
              ? "Accelerated Threshold 1 has TWO deadlines each month: amounts for the 1st–15th are due by the 25th of the same month, and amounts for the 16th–month-end by the 10th of the following month (the period-closing deadline shown here)."
              : remitterType === "ACCELERATED2"
                ? "Accelerated Threshold 2: each period's amount is due 3 business days after the period ends."
                : remitterType === "QUARTERLY"
                  ? "Quarterly remitters: due by the 15th of the month after the quarter ends."
                  : "Regular remitters: due by the 15th of the following month."} When a due date falls on a weekend, CRA's deadline moves to the next business day.
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
                  const total = e.totalCra;
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
                {["Period","Due date","Submitted","CPP total","EI total","Tax withheld","Total remitted","Status","Reference","Action"].map(h=><th key={h} className={`px-4 py-[11px] ${h==="Period"?"text-left":"text-right"}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {Array.from({length:6}).map((_,i)=>{
                  const stepMonths = grouping === "quarterly" ? i * 3 : i;
                  const d = new Date(now.getFullYear(), now.getMonth() - stepMonths, 1);
                  const period = periodKeyForDate(d, grouping);
                  // Figures come from the shared aggregation — the old inline
                  // sums here omitted CPP2, so history totals disagreed with
                  // the breakdown tab and the Reports hub for the same period.
                  const p = periodAgg.get(period);
                  const cpp = p ? p.employeeCpp + p.employerCpp + p.employeeCpp2 + p.employerCpp2 : 0;
                  const ei = p ? p.employeeEi + p.employerEi : 0;
                  const tax = p?.incomeTax ?? 0;
                  const tot = p?.totalRemittance ?? 0;
                  // Due date from the shared remitter-aware helper (FLAG B).
                  const due = remittanceDueDateFor(period, remitterType);
                  const isCurrent = i===0;
                  // W4-D11: the row for the period being viewed is
                  // highlighted, so the history tab reflects the scope
                  // selected in the filter bar.
                  const isSelected = !isYtd && period === selectedPeriod;
                  // Submission state comes from the persisted
                  // RemittanceSubmission records — a date/reference is shown
                  // ONLY when a real record exists (PR #14 removed the
                  // fabricated ones; this restores them on real data).
                  const sub = submissions[period];
                  return (
                    <tr key={period} className={`border-b border-[#F0EFED] hover:bg-[#FAFAF9] text-[13px] ${isSelected ? "bg-[#EFF6FF]" : ""}`}>
                      <td className="px-4 py-3 font-semibold">{period}{isSelected ? <span className="ml-2 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#2563EB]">Viewing</span> : null}</td>
                      <td className="text-right px-4 py-3">{due}</td>
                      <td className="text-right px-4 py-3">{sub ? sub.submittedAt.toISOString().slice(0, 10) : <span className="text-[#A8A29E]">—</span>}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{cpp>0?fmtCAD(cpp):"—"}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{ei>0?fmtCAD(ei):"—"}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums">{tax>0?fmtCAD(tax):"—"}</td>
                      <td className="text-right px-4 py-3 font-mono tabular-nums font-semibold">{sub?fmtCAD(sub.totalRemittance):tot>0?fmtCAD(tot):"—"}</td>
                      <td className="text-right px-4 py-3">
                        <span className={`inline-flex items-center gap-[5px] text-[11px] font-bold tracking-[0.04em] rounded-full px-2.5 py-[3px] ${sub?"bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]":tot>0?"bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]":"bg-[#F5F5F4] text-[#78716C]"}`}>
                          {sub?"Submitted":isCurrent&&tot>0?"Pending":tot>0?"Not submitted":"No activity"}
                        </span>
                      </td>
                      <td className="text-right px-4 py-3 font-mono text-xs">{sub?.reference ?? <span className="text-[#A8A29E]">—</span>}</td>
                      <td className="text-right px-4 py-3">{!sub && tot>0 ? <MarkSubmittedControl periodKey={period} /> : null}</td>
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
              // The period steps forward from the current period (monthly,
              // or quarterly for QUARTERLY remitters); its due date comes
              // from the shared remitter-aware helper — never an inline
              // 15th-of-next-month construction (the old one also produced
              // "2027-00" period keys for January due dates).
              const stepMonths = grouping === "quarterly" ? i * 3 : i;
              const period = periodKeyForDate(new Date(now.getFullYear(), now.getMonth() + stepMonths, 1), grouping);
              const rowDueStr = remittanceDueDateFor(period, remitterType);
              const d = new Date(`${rowDueStr}T12:00:00`);
              const rowDaysLeft = Math.ceil((d.getTime() - now.getTime()) / 86400000);
              const tot = periodAgg.get(period)?.totalRemittance ?? 0;
              const isNext = i===0;
              return (
                <div key={period} className="flex gap-3.5 px-[18px] py-3.5 border-b border-[#F0EFED] last:border-b-0 hover:bg-[#FAFAF9] items-center">
                  <div className={`w-[46px] h-[46px] rounded-[10px] border flex flex-col items-center justify-center flex-shrink-0 ${isNext&&tot>0?"bg-[#FEF2F2] border-[#FECACA] text-[#B3261E]":"bg-[#F5F5F4] border-[#E7E5E4]"}`}>
                    <span className="text-[9px] font-bold uppercase text-[#A8A29E]">{d.toLocaleString('default',{month:'short'})}</span>
                    <span className="text-lg font-extrabold tracking-[-0.02em]">{d.getDate()}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{periodLabel(period)} remittance</p>
                    <p className="text-xs text-[#A8A29E]">CRA · {remitterLabel} · Due {rowDueStr}{isNext&&tot>0?` · ${rowDaysLeft} days remaining`:""}</p>
                  </div>
                  <span className={`text-sm font-bold font-mono tabular-nums ${isNext&&tot>0?"text-[#B3261E]":"text-[#A8A29E"}`}>{tot>0?fmtCAD(tot):isNext?"~$0":"~$0"}</span>
                </div>
              );
            })}
            {remitterType === "ACCELERATED1" && (
              <p className="px-[18px] py-3 text-xs text-[#78716C] leading-relaxed">Threshold 1 also has a mid-period deadline: amounts for the 1st–15th of a month are due by the 25th of that month. The dates above are the period-closing deadlines (10th of the following month).</p>
            )}
          </div>

          {/* Statutory rates */}
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <p className="text-[15px] font-bold mb-4">2026 statutory rates</p>
            {[
              ["🧮", "#FEF2F2", "CPP employee rate", "Pensionable above $3,500/yr exemption. Max $74,600.", "5.95%"],
              ["🧮", "#FEF2F2", "CPP2 additional", "Earnings $74,600–$85,000. Higher earners only.", "4.00%"],
              ["🔹", "#EFF6FF", "EI employee premium", "Insurable up to max annual $68,900.", "1.63%"],
              ["🔹", "#EFF6FF", "EI employer multiplier", "1.4× employee premium.", "×1.4"],
              ["📅", "#F0FDF4", "Remitter type", `This company: ${remitterLabel}. Regular: avg monthly $1,000–$24,999, due 15th.`, remitterType === "ACCELERATED1" ? "10th" : remitterType === "ACCELERATED2" ? "+3 days" : "15th"],
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
