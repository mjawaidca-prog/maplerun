"use client";

import { useState } from "react";
import Link from "next/link";

const PLANS = [
  { name: "Solo", price: "$15", emp: "1 employee", features: ["Unlimited pay runs","Pay stubs & T4 slips","CRA-aligned calculations"], off: ["ROE generation","Payroll journals"], current: true },
  { name: "Growth", price: "$25", emp: "Up to 10 employees", features: ["Everything in Solo","Multiple pay groups","PD7A remittance"], off: ["Payroll journals"], reco: true },
  { name: "Accountant", price: "$59", emp: "Unlimited employees", features: ["Everything in Growth","ROE generation","Payroll journals","Multi-company"], off: [] },
];

export function UpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-[rgba(28,25,23,0.55)] backdrop-blur-[3px] flex items-center justify-center p-8 z-50" onClick={onClose}>
      <div className="w-full max-w-[780px] bg-white rounded-[20px] shadow-[0_24px_60px_rgba(0,0,0,0.4)] overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="px-[30px] pt-[26px] pb-5 border-b border-[#E7E5E4] flex justify-between items-start">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.04em] bg-[#FEF2F2] text-[#B3261E] rounded-full px-[11px] py-1.5 mb-3">🔒 Accountant feature</span>
            <h2 className="text-[21px] font-extrabold tracking-[-0.02em]">Unlock ROE & payroll journals</h2>
            <p className="text-sm text-[#78716C] mt-1.5">Record of Employment and journal exports are part of the Accountant plan.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-[#E7E5E4] bg-white text-[#78716C] text-lg leading-none flex-shrink-0">×</button>
        </div>

        <div className="grid grid-cols-3 gap-3.5 px-[30px] py-6">
          {PLANS.map(plan=>(
            <div key={plan.name} className={`relative flex flex-col border rounded-[14px] p-5 ${plan.reco?"border-2 border-[#B3261E] shadow-[0_8px_30px_rgba(179,38,30,0.12)]":"border-[#E7E5E4]"}`}>
              {plan.current&&<span className="absolute top-[18px] right-4 text-[10px] font-bold tracking-[0.05em] text-[#57534E] bg-[#F0EFED] rounded-full px-2.5 py-1">CURRENT</span>}
              {plan.reco&&<span className="absolute -top-[11px] left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-[0.05em] bg-[#B3261E] text-white rounded-full px-[11px] py-1 whitespace-nowrap">RECOMMENDED</span>}
              <p className="text-sm font-bold">{plan.name}</p>
              <p className="text-[30px] font-extrabold tracking-[-0.02em] mt-2.5">{plan.price}<span className="text-[13px] font-medium text-[#A8A29E]"> /mo</span></p>
              <p className="text-xs text-[#78716C] mt-1">{plan.emp}</p>
              <ul className="list-none my-4 flex-1 space-y-0">
                {plan.features.map(f=><li key={f} className="text-[13px] text-[#44403C] leading-[1.7] flex gap-2"><span className="text-[#16A34A] font-bold">✓</span>{f}</li>)}
                {plan.off.map(f=><li key={f} className="text-[13px] text-[#C0BCB8] leading-[1.7] flex gap-2"><span className="text-[#D6D3D1] font-bold">–</span>{f}</li>)}
              </ul>
              <button className={`w-full py-[11px] rounded-[10px] text-sm font-semibold font-sans ${plan.current?"bg-[#F0EFED] text-[#A8A29E] cursor-default":plan.reco?"bg-[#B3261E] text-white border-none":"border border-[#D6D3D1] bg-white text-[#1C1917]"}`}>
                {plan.current?"Current plan":`Upgrade to ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        <div className="bg-[#FAFAF9] border-t border-[#E7E5E4] px-[30px] py-4 flex justify-between items-center">
          <span className="text-xs text-[#A8A29E]">Plans change instantly · cancel anytime · prices in CAD</span>
          <button onClick={onClose} className="text-[13px] font-semibold text-[#78716C]">Maybe later</button>
        </div>
      </div>
    </div>
  );
}
