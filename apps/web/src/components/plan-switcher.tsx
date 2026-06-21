"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLAN_META, type Plan } from "@/lib/plan";

export function PlanSwitcher({ currentPlan, companyId }: { currentPlan: Plan; companyId: string }) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function handleSwitch(plan: Plan) {
    if (plan === currentPlan) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/company/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, plan }),
      });
      if (res.ok) router.refresh();
    } catch {}
    setSwitching(false);
  }

  const meta = PLAN_META[currentPlan];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full" style={{ background: meta.dot }} />
        <span className="text-lg font-bold capitalize">{currentPlan}</span>
        <span className="text-sm text-[#78716C]">{meta.price}/mo base</span>
      </div>

      <div className="flex gap-2">
        {(["solo", "growth", "accountant"] as Plan[]).map((p) => (
          <button
            key={p}
            onClick={() => handleSwitch(p)}
            disabled={switching || p === currentPlan}
            className={`text-xs font-semibold px-3 py-1.5 rounded-[7px] border transition-colors ${
              p === currentPlan
                ? "bg-[#3F1413] text-white border-[#3F1413] cursor-default"
                : "border-[#D6D3D1] bg-white text-[#1C1917] hover:border-[#B3261E]"
            }`}
          >
            {p === currentPlan ? `✓ ${p}` : `Switch to ${p}`}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-[#78716C]">
        {switching ? "Updating…" : "Owner can switch plans anytime. Refresh to see changes in sidebar."}
      </p>
    </div>
  );
}
