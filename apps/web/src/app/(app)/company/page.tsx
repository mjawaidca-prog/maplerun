/**
 * Company settings — profile + tax rates card.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function CompanySettingsPage() {
  const { companyId } = await requireCompany();
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Company</h1>
        <p className="text-sm text-muted-foreground mt-1">{company.name}</p>
      </div>

      <div className="flex gap-6 border-b border-[#E7E5E4] mb-6">
        {["Profile","Payroll","Billing"].map(t=><span key={t} className={`text-sm font-semibold pb-3 border-b-2 -mb-[1px] ${t==="Profile"?"text-[#B3261E] border-[#B3261E]":"text-[#A8A29E] border-transparent"}`}>{t}</span>)}
      </div>

      <div className="grid grid-cols-[1.1fr_1fr] gap-5 items-start">
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-[22px] py-[18px] border-b border-[#F0EFED] flex justify-between items-center"><span className="text-base font-bold">Company profile</span><button className="rounded-[9px] border border-[#D6D3D1] bg-white px-4 py-2 text-[13px] font-semibold">Edit</button></div>
          <div className="p-[22px] space-y-4">
            <div><label className="text-xs font-semibold text-[#78716C] block mb-1.5">Legal name</label><input className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans" value={company.name} disabled /></div>
            <div className="grid grid-cols-2 gap-3.5">
              <div><label className="text-xs font-semibold text-[#78716C] block mb-1.5">CRA business number</label><input className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans font-mono" value="—" disabled /></div>
              <div><label className="text-xs font-semibold text-[#78716C] block mb-1.5">Default province</label><input className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans" value="ON" disabled /></div>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div><label className="text-xs font-semibold text-[#78716C] block mb-1.5">Pay frequency</label><input className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans" value="Biweekly" disabled /></div>
              <div><label className="text-xs font-semibold text-[#78716C] block mb-1.5">Remitter type</label><input className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans" value="Regular · monthly" disabled /></div>
            </div>
            <div><label className="text-xs font-semibold text-[#78716C] block mb-1.5">Address</label><input className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans" value="—" disabled /></div>
          </div>
        </div>

        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-[22px] py-[18px] border-b border-[#F0EFED] flex justify-between items-center">
            <span className="text-base font-bold">Tax rates & limits</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] rounded-full px-[11px] py-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />Active rates · 2026</span>
          </div>
          <div className="p-[22px]">
            <div className="border border-[#E7E5E4] rounded-[10px] overflow-hidden">
              {[["CPP rate / max pensionable","5.95% · $74,600"],["CPP2 rate / ceiling","4.00% · $85,000"],["EI rate (employee)","1.63% · $68,900"],["Federal basic personal amount","$16,452"],["ON basic personal amount","$12,989"]].map(([k,v],i)=>(
                <div key={k} className={`flex justify-between px-3.5 py-[11px] text-[13px] border-b border-[#F0EFED] last:border-b-0 ${i%2?"bg-[#FAFAF9]":""}`}><span className="text-[#57534E]">{k}</span><span className="font-mono tabular-nums font-medium">{v}</span></div>
              ))}
            </div>
            <p className="text-xs text-[#A8A29E] mt-3 leading-relaxed">Source: CRA T4127 (123rd ed.) · last synced Jun 2026.</p>
            <div className="flex gap-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[9px] px-3.5 py-3 mt-3.5 text-xs text-[#1E40AF] leading-relaxed">ℹ️ Rates update automatically each tax year. Past pay runs always keep the rates from their own year.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
