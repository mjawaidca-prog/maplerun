/**
 * Employee detail — big avatar, personal info, pay settings, TD1, YTD ledger.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

function fmtCAD(n: number): string { return `$${n.toFixed(2)}`; }

type Props = { params: Promise<{ id: string }> };

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params;
  const { companyId } = await requireCompany();
  const emp = await prisma.employee.findUnique({
    where: { id },
    include: { td1Profiles: { where: { year: 2026 }, take: 1 }, ytdLedgers: { where: { year: 2026 }, take: 1 } },
  });
  if (!emp || emp.companyId !== companyId) notFound();
  const td1 = emp.td1Profiles[0];
  const ytd = emp.ytdLedgers[0];

  return (
    <div className="space-y-6">
      <div className="text-[13px] text-[#A8A29E]"><Link href="/employees" className="text-[#A8A29E] no-underline">Employees</Link> › {emp.firstName} {emp.lastName}</div>
      <div className="flex items-center gap-4">
        <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-[#B3261E] to-[#E56A5C] flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">{emp.firstName[0]}</div>
        <div className="flex-1">
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">{emp.firstName} {emp.lastName}</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            {emp.province??"ON"} · SIN •••-•••-••• <span className="inline-flex items-center text-[11px] font-bold tracking-[0.03em] rounded-full px-2.5 py-1 bg-[#DCFCE7] text-[#15803D]">{emp.active?"ACTIVE":"INACTIVE"}</span>
          </p>
        </div>
        <div className="flex gap-2.5">
          <Link href={`/payroll/${emp.id}/stub`} className="rounded-[10px] border border-[#D6D3D1] bg-white px-4 py-2.5 text-sm font-semibold no-underline text-[#1C1917]">View latest stub</Link>
          <Link href={`/employees/${emp.id}/edit`} className="rounded-[10px] bg-[#B3261E] hover:bg-[#8F1D17] text-white px-[18px] py-2.5 text-sm font-semibold no-underline">Edit</Link>
        </div>
      </div>

      <div className="flex gap-6 border-b border-[#E7E5E4] mt-[22px] mb-6">
        {["Overview","TD1 & tax","YTD ledger"].map(t=><span key={t} className={`text-sm font-semibold pb-3 border-b-2 -mb-[1px] ${t==="Overview"?"text-[#B3261E] border-[#B3261E]":"text-[#A8A29E] border-transparent"}`}>{t}</span>)}
      </div>

      <div className="grid grid-cols-2 gap-5 items-start">
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-5 py-4 border-b border-[#F0EFED] flex justify-between items-center"><span className="text-[15px] font-bold">Personal</span></div>
          {[["Full name",`${emp.firstName} ${emp.lastName}`],["Email",emp.email??"—"],["Phone",emp.phone??"—"],["Address",[emp.addressLine1,emp.city,emp.province,emp.postalCode].filter(Boolean).join(", ")||"—"]].map(([k,v])=>(
            <div key={k} className="flex justify-between px-5 py-[11px] text-[13px] border-b border-[#F7F6F4] last:border-b-0"><span className="text-[#78716C]">{k}</span><span className="font-medium">{v as string}</span></div>
          ))}
        </div>

        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-5 py-4 border-b border-[#F0EFED] flex justify-between items-center"><span className="text-[15px] font-bold">Pay settings</span></div>
          {[["Province",emp.province??"—"],["Start date",emp.createdAt.toISOString().slice(0,10)],["Deposit","Direct"]].map(([k,v])=>(
            <div key={k} className="flex justify-between px-5 py-[11px] text-[13px] border-b border-[#F7F6F4] last:border-b-0"><span className="text-[#78716C]">{k}</span><span className="font-medium">{v}</span></div>
          ))}
        </div>

        <div className="col-span-2 bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-5 py-4 border-b border-[#F0EFED] flex justify-between items-center"><span className="text-[15px] font-bold">TD1 claim <small className="font-medium text-[#A8A29E] ml-1.5">federal & provincial</small></span></div>
          <div className="grid grid-cols-2">
            {[["Federal claim",td1?.federalClaim?fmtCAD(td1.federalClaim):"$16,129 (default)"],["Provincial claim",td1?.provincialClaim?fmtCAD(td1.provincialClaim):"Default BPA"],["Additional tax/period",td1?.extraTaxPerPeriod?fmtCAD(td1.extraTaxPerPeriod):"$0.00"],["CPP/EI exempt",`${td1?.cppExempt?"Yes":"No"} · ${td1?.eiExempt?"Yes":"No"}`]].map(([k,v])=>(
              <div key={k} className="bg-white p-3.5 px-5"><p className="text-[11px] text-[#A8A29E] uppercase tracking-[0.05em]">{k}</p><p className="text-[15px] font-bold mt-1.5 font-mono tabular-nums">{v}</p></div>
            ))}
          </div>
        </div>

        {ytd && (
          <div className="col-span-2 bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-5 py-4 border-b border-[#F0EFED] flex justify-between items-center"><span className="text-[15px] font-bold">2026 YTD ledger</span></div>
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-2.5 px-5 py-[11px] bg-[#FAFAF9] border-b border-[#E7E5E4] text-[11px] font-bold text-[#A8A29E] uppercase tracking-[0.04em]">
              <div>Box</div><div className="text-right">YTD</div><div className="text-right">This period</div><div className="text-right">Remaining room</div>
            </div>
            {[["Pensionable (CPP)",ytd.pensionableEarnings,0,(74600-ytd.pensionableEarnings)],["Insurable (EI)",ytd.insurableEarnings,0,(68900-ytd.insurableEarnings)],["CPP withheld",ytd.cpp,0,(4230.45-ytd.cpp)],["EI withheld",ytd.ei,0,(1123.07-ytd.ei)]].map(([label,ytdVal,,room])=>(
              <div key={label as string} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-2.5 px-5 py-3 text-[13px] border-b border-[#F0EFED] last:border-b-0 items-center">
                <div>{label as string}</div><div className="text-right font-mono tabular-nums">{fmtCAD(ytdVal as number)}</div><div className="text-right font-mono tabular-nums">—</div><div className="text-right font-mono tabular-nums">{fmtCAD(room as number)}</div>
              </div>
            ))}
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-2.5 px-5 py-3 text-[13px] font-bold bg-[#1C1917] text-white items-center">
              <div>Income tax withheld</div><div className="text-right font-mono tabular-nums">—</div><div className="text-right font-mono tabular-nums">—</div><div className="text-right font-mono tabular-nums">—</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
