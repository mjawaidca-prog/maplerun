/**
 * ROE detail — Service Canada formatted Record of Employment.
 *
 * Wave 2 wiring: all figures come from `generateRoe` (lib/actions/roe.ts),
 * whose period history is built from the hours recorded on finalized
 * pay-run items. The form below re-generates the preview with an edited
 * reason code and separation payments; the vacation field is pre-filled
 * with the accrued vacation balance owed to the employee. Warnings from
 * the action (zero-hour periods, worked-date fallbacks) are shown
 * prominently — never silently.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can, type Plan } from "@/lib/plan";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { StubPrintButton } from "@/components/stub-actions";
import { generateRoe, type RoeData, type RoeOtherPaymentInput } from "@/lib/actions/roe";
import { ROE_REASON_CODES } from "@/lib/roe-constants";
import Link from "next/link";
import { notFound } from "next/navigation";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function sp1(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function RoeDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
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

  // ── Form values (reason code + separation payments) ──────────────────────
  const reasonParam = sp1(sp.reason) ?? "A";
  const reasonCode = reasonParam in ROE_REASON_CODES ? reasonParam : "A";

  const vacationRaw = sp1(sp.vacation);
  const vacationParsed =
    vacationRaw !== undefined && vacationRaw !== "" ? Number(vacationRaw) : undefined;
  const vacationPayOnTermination =
    vacationParsed !== undefined && Number.isFinite(vacationParsed)
      ? vacationParsed
      : undefined;

  const otherPayments: RoeOtherPaymentInput[] = [];
  for (let i = 0; i < 3; i++) {
    const code = (sp1(sp[`oc${i}`]) ?? "").trim();
    const amount = Number(sp1(sp[`oa${i}`]) ?? "");
    if (!code || !Number.isFinite(amount)) continue;
    otherPayments.push({
      code,
      amount,
      startDate: sp1(sp[`os${i}`]) || undefined,
      endDate: sp1(sp[`oe${i}`]) || undefined,
    });
  }

  let roe: RoeData;
  try {
    roe = await generateRoe(id, reasonCode, {
      vacationPayOnTermination,
      otherPayments: otherPayments.length > 0 ? otherPayments : undefined,
    });
  } catch {
    notFound();
  }

  const ytd = employee.ytdLedgers[0];

  // .BLK download carries the current form values.
  const blkParams = new URLSearchParams({
    reason: roe.reasonCode,
    vacation: String(roe.vacationPayOnTermination),
  });
  if (roe.otherPayments.length > 0) {
    blkParams.set("other", JSON.stringify(roe.otherPayments));
  }
  const blkHref = `/api/roe/${id}?${blkParams.toString()}`;

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
          <a
            href={blkHref}
            className="inline-flex items-center text-[13px] font-semibold rounded-[8px] px-3.5 py-2 bg-[#B3261E] text-white no-underline"
          >
            Download .BLK file
          </a>
          <StubPrintButton />
        </div>
      </div>

      {/* Data-quality warnings — verify before issuing */}
      {roe.warnings.length > 0 && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[10px] px-5 py-4 text-[13px] text-[#92400E] leading-relaxed">
          <p className="font-bold mb-1">⚠️ Verify before issuing</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {roe.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Editable preview form — reason code + separation payments */}
      <form method="GET" action={`/reports/roe/${id}`} className="bg-white border border-[#E7E5E4] rounded-[14px] px-6 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
        <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em]">Reason &amp; Separation Payments</p>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-[#57534E]">Block 16 — Reason code</span>
            <select name="reason" defaultValue={roe.reasonCode} className="mt-1 block w-full border border-[#E7E5E4] rounded-[8px] px-2.5 py-2 text-sm bg-white">
              {Object.entries(ROE_REASON_CODES).map(([code, label]) => (
                <option key={code} value={code}>{code} — {label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#57534E]">Block 17A — Vacation pay on termination ($)</span>
            <input
              name="vacation"
              type="number"
              step="0.01"
              min="0"
              defaultValue={roe.vacationPayOnTermination.toFixed(2)}
              className="mt-1 block w-full border border-[#E7E5E4] rounded-[8px] px-2.5 py-2 text-sm font-mono tabular-nums"
            />
            <span className="text-[11px] text-[#A8A29E]">Pre-filled with the accrued vacation balance on file ({fmtCAD(employee.vacationBalanceCents / 100)}). Edit if a different amount was paid.</span>
          </label>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#57534E] mb-2">Block 17C — Other monies (up to 3)</p>
          {[0, 1, 2].map((i) => {
            const p = roe.otherPayments[i];
            return (
              <div key={i} className="grid grid-cols-[110px_1fr_1fr_1fr] gap-2.5 mb-2">
                <input name={`oc${i}`} placeholder="Code (e.g. E)" defaultValue={p?.code ?? ""} className="border border-[#E7E5E4] rounded-[8px] px-2.5 py-2 text-sm font-mono" />
                <input name={`oa${i}`} type="number" step="0.01" min="0" placeholder="Amount $" defaultValue={p ? String(p.amount) : ""} className="border border-[#E7E5E4] rounded-[8px] px-2.5 py-2 text-sm font-mono tabular-nums" />
                <input name={`os${i}`} type="date" defaultValue={p?.startDate ?? ""} className="border border-[#E7E5E4] rounded-[8px] px-2.5 py-2 text-sm" />
                <input name={`oe${i}`} type="date" defaultValue={p?.endDate ?? ""} className="border border-[#E7E5E4] rounded-[8px] px-2.5 py-2 text-sm" />
              </div>
            );
          })}
          <p className="text-[11px] text-[#A8A29E]">Codes follow Service Canada Appendix D Table 17C.1 (e.g. E = severance → E00; bonuses and SUB plans need the full code, e.g. B05, U12). Invalid codes are rejected when the .BLK file is built.</p>
        </div>
        <button type="submit" className="text-[13px] font-semibold rounded-[8px] px-3.5 py-2 bg-[#FAFAF9] border border-[#E7E5E4]">Update preview</button>
      </form>

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
              ["15A","Total insurable hours",String(roe.block15A)],
              ["15B","Total insurable earnings",fmtCAD(roe.block15B)],
              ["10","First work date",roe.firstWorkDate ?? "—"],
              ["11","Last work date",roe.lastWorkDate],
              ["","Final pay date",roe.finalPayDate],
              ["16","Reason code",`${roe.reasonCode} — ${ROE_REASON_CODES[roe.reasonCode] ?? ""}`],
              ["17A","Vacation pay on termination",fmtCAD(roe.vacationPayOnTermination)],
              ["17C","Other monies",roe.otherPayments.length > 0 ? roe.otherPayments.map((p) => `${p.code}: ${fmtCAD(p.amount)}`).join(" · ") : "—"],
            ].map(([num,label,value])=>(
              <div key={`${num}-${label}`} className="bg-white p-3.5">
                {num && <p className="text-[10px] font-bold text-[#B3261E] font-mono tabular-nums">{num}</p>}
                <p className="text-[11px] text-[#A8A29E] mt-0.5 leading-tight">{label}</p>
                <p className="text-sm font-semibold mt-1.5 font-mono tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Block 16 — Reason for issuing ROE */}
        <div className="px-6 py-5 border-t border-[#F0EFED]">
          <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em] mb-3.5">Block 16 — Reason for issuing ROE</p>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(ROE_REASON_CODES).map(([code,label]) => (
              <div key={code} className={`border rounded-[8px] p-2.5 text-center ${code === roe.reasonCode ? "border-[#B3261E] bg-[#FEF2F2]" : "border-[#E7E5E4]"}`}>
                <p className="text-base font-bold font-mono">{code}</p>
                <p className="text-[10px] text-[#A8A29E] leading-tight mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#A8A29E] mt-3">Change the reason code in the form above to update this preview and the .BLK file. The reason determines EI benefit eligibility.</p>
        </div>

        {/* Pay period table */}
        <div className="px-6 py-5 border-t border-[#F0EFED]">
          <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em] mb-3.5">Pay Periods (Block 15C)</p>
          <div className="grid grid-cols-[50px_1.4fr_0.8fr_1fr] gap-2.5 py-[9px] text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.05em]">
            <span>PP</span><span>Period end</span><span className="text-right">Hours</span><span className="text-right">Insurable earnings</span>
          </div>
          {roe.block15C.slice(0, 53).map((p,i)=>(
            <div key={`${p.periodEnd}-${i}`} className="grid grid-cols-[50px_1.4fr_0.8fr_1fr] gap-2.5 py-[9px] border-b border-[#F7F6F4] text-[13px] items-center">
              <span className="text-[#A8A29E] font-mono tabular-nums text-xs">{i+1}</span>
              <span>{p.periodEnd}</span>
              <span className="text-right font-mono tabular-nums">{p.hours}</span>
              <span className="text-right font-mono tabular-nums">{fmtCAD(p.earnings)}</span>
            </div>
          ))}
          <div className="grid grid-cols-[50px_1.4fr_0.8fr_1fr] gap-2.5 pt-[11px] text-[13px] font-bold">
            <span></span>
            <span>Total</span>
            <span className="text-right font-mono tabular-nums">{roe.block15A}</span>
            <span className="text-right font-mono tabular-nums">{fmtCAD(roe.block15B)}</span>
          </div>
          <p className="text-[11px] text-[#A8A29E] mt-2">Insurable earnings use the legacy fallback (an item counts as insurable when EI was deducted on it) until per-item insurable earnings are stored.</p>
        </div>

        {/* Separation payments used */}
        <div className="px-6 py-5 border-t border-[#F0EFED]">
          <p className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.06em] mb-3.5">Separation Payments Used</p>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-[11px] text-[#A8A29E]">Vacation pay on termination (17A)</p><p className="text-sm font-semibold font-mono tabular-nums">{fmtCAD(roe.vacationPayOnTermination)}</p></div>
            <div>
              <p className="text-[11px] text-[#A8A29E]">Other monies (17C)</p>
              {roe.otherPayments.length === 0
                ? <p className="text-sm font-semibold font-mono tabular-nums">—</p>
                : roe.otherPayments.map((p, i) => (
                    <p key={i} className="text-sm font-semibold font-mono tabular-nums">{p.code}: {fmtCAD(p.amount)}{p.startDate ? ` (${p.startDate}${p.endDate ? ` → ${p.endDate}` : ""})` : ""}</p>
                  ))}
            </div>
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
          ℹ️ Submit this ROE to Service Canada within 5 calendar days of the interruption of earnings. Use ROE Web for electronic filing — the .BLK download above is the Payroll Extract upload file (Block 15B is computed by ROE Web and is not in the file).
        </div>
      </div>
    </div>
  );
}
