/**
 * Direct Deposit — CPA-005 EFT file download per finalized pay run.
 *
 * Each run is previewed through the same loader the download uses
 * (previewEftFile), so what the page lists as included/excluded is
 * exactly what the downloaded file will contain. Employees the CPA-005
 * builder excludes (missing/invalid banking, zero net pay) are named
 * WITH their reasons — never silently dropped. When the company's EFT
 * originator profile is incomplete, no file can be built at all and the
 * page points at Settings → Payroll instead of offering a download.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { previewEftFile, type EftPreviewResult } from "@/lib/actions/eft";
import Link from "next/link";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }
function fmtCents(cents: number): string { return `$${(cents / 100).toFixed(2)}`; }

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

  // Preview every listed run (pure dry-run build — no side effects).
  const previews = new Map<string, EftPreviewResult>();
  for (const run of runs) {
    try {
      previews.set(run.id, await previewEftFile(run.id));
    } catch {
      /* a run that cannot even load simply gets no preview block */
    }
  }
  const profileProblems = [...previews.values()].find((p) => p.profileProblems.length > 0)?.profileProblems ?? [];

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

      {/* Originator profile incomplete — no file can be built */}
      {profileProblems.length > 0 && (
        <div className="flex gap-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[11px] px-[18px] py-3.5 text-[13px] text-[#991B1B]">
          <span>⛔ EFT downloads are unavailable until your EFT originator profile is complete. Missing or invalid: <b>{profileProblems.join(", ")}</b>.{" "}
          <Link href="/company?tab=payroll" className="font-semibold underline">Complete your EFT originator profile in Settings → Payroll</Link>.</span>
        </div>
      )}

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
          runs.map((run) => {
            const preview = previews.get(run.id);
            const downloadable = !!preview && preview.profileProblems.length === 0 && preview.includedCount > 0;
            return (
              <div key={run.id} className="border-b border-[#F0EFED] last:border-b-0 hover:bg-[#FAFAF9]">
                <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr_32px] gap-3 px-5 py-3.5 items-center">
                  <div className="text-sm font-semibold">{run.payDate}</div>
                  <div className="text-[13px] text-[#57534E]">{run.payGroup.name}</div>
                  <div className="text-right text-[13px] text-[#57534E]">
                    {preview && preview.profileProblems.length === 0
                      ? `${preview.includedCount} of ${preview.includedCount + preview.excluded.length}`
                      : (run.itemCount > 0 ? `${run.itemCount} employee${run.itemCount!==1?"s":""}` : "—")}
                  </div>
                  <div className="text-right text-[13px] font-mono tabular-nums font-semibold">{fmtCAD(run.totalNetPay)}</div>
                  <div className="text-right">
                    {downloadable ? (
                      <Link
                        href={`/api/eft?payRunId=${run.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#F0FDF4] text-[#16A34A] rounded-full px-3 py-1.5 no-underline hover:bg-[#DCFCE7]"
                      >
                        ⬇ EFT
                      </Link>
                    ) : preview && preview.profileProblems.length === 0 ? (
                      <span className="text-xs text-[#A8A29E]" title="No payable employees in this run — see the exclusions below.">Unavailable</span>
                    ) : (
                      <span className="text-xs text-[#A8A29E]">—</span>
                    )}
                  </div>
                  <div></div>
                </div>

                {/* Per-run inclusion / exclusion detail */}
                {preview && preview.profileProblems.length === 0 && (
                  <div className="px-5 pb-4 -mt-1 space-y-2">
                    {preview.included.length > 0 && (
                      <div className="text-[12.5px] text-[#57534E]">
                        <span className="font-semibold text-[#16A34A]">Included ({preview.includedCount} · {fmtCents(preview.totalCents)}):</span>{" "}
                        {preview.included.map((e) => `${e.employeeName} (${fmtCents(e.amountCents)})`).join(", ")}
                      </div>
                    )}
                    {preview.excluded.length > 0 && (
                      <div className="text-[12.5px] text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2">
                        <span className="font-semibold">Excluded from this file:</span>
                        <ul className="list-disc ml-5 mt-1 space-y-0.5">
                          {preview.excluded.map((e) => (
                            <li key={e.employeeName}><b>{e.employeeName}</b> — {e.reasons.join("; ")}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {preview.includedCount === 0 && (
                      <p className="text-[12.5px] text-[#991B1B]">
                        Download disabled: no employee in this run can be paid by EFT. Fix the exclusions above, then re-check this page.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-[11px] bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] px-4 py-3.5 text-[12.5px] text-[#1E40AF] leading-relaxed">
        ℹ️ <span><b>CPA-005</b> is the standard Canadian EFT format. Download the file and upload it to your bank's business portal. Supported by RBC, TD, Scotiabank, BMO, CIBC, and most credit unions. <b>Add bank details</b> for each employee on their Edit page.</span>
      </div>
    </div>
  );
}
