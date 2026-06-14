"use client";

import { useState } from "react";
import Link from "next/link";
import type { Plan } from "@/lib/plan";
import { PLAN_META } from "@/lib/plan";

type Props = {
  feature: string;
  requiredPlan: Plan;
  currentPlan?: Plan;
};

export function UpgradePrompt({ feature, requiredPlan, currentPlan }: Props) {
  const meta = PLAN_META[requiredPlan];

  return (
    <div className="rounded-[14px] border border-[#FDE68A] bg-[#FFFBEB] p-4 text-center space-y-3">
      <div className="flex items-center justify-center gap-2">
        <span className="text-[11px] font-bold tracking-[0.04em] bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-full px-2.5 py-1">
          🔒 {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan
        </span>
      </div>
      <p className="text-[13px] text-[#92400E] leading-relaxed max-w-[380px] mx-auto">
        {feature} is available on the{" "}
        <b className="text-[#1C1917]">{requiredPlan}</b> plan and above.
      </p>
      <Link
        href="/company?tab=billing"
        className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-[13px] font-semibold px-[18px] py-2.5 no-underline transition-colors"
      >
        Upgrade to unlock →
      </Link>
      <p className="text-[11px] text-[#A8A29E]">
        Current: {currentPlan ? PLAN_META[currentPlan].label : "—"} · {meta.price}/mo
      </p>
    </div>
  );
}

/** Inline small upgrade banner for use inside existing content. */
export function UpgradeBanner({ feature, requiredPlan }: { feature: string; requiredPlan: Plan }) {
  return (
    <div className="inline-flex items-center gap-2 text-[11px] font-semibold bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-full px-3 py-1.5">
      🔒 <span>{feature} — {requiredPlan} plan</span>
      <Link href="/company?tab=billing" className="text-[#B3261E] hover:underline ml-1">
        Upgrade
      </Link>
    </div>
  );
}
