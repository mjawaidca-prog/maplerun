"use client";

import { useState } from "react";

export function UpgradePlanButton({
  planId,
  label,
  annual = false,
}: {
  planId: string;
  label: string;
  annual?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, employeeCount: 1, annual }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "Failed to start checkout");
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="inline-flex rounded-[9px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-xs font-semibold px-4 py-2 transition-colors disabled:opacity-50"
      >
        {loading ? "Redirecting…" : label}
      </button>
      {error && <p className="text-[10px] text-[#B3261E] mt-1">{error}</p>}
    </div>
  );
}

/**
 * Billing section with monthly/annual toggle — used in Company > Billing tab.
 */
export function BillingUpgradeCards({
  currentPlan,
}: {
  currentPlan: string;
}) {
  const [annual, setAnnual] = useState(false);

  const plans = [
    {
      id: "solo",
      name: "Solo",
      monthlyPrice: 7,
      annualPrice: 70,
      annualMonthly: "5.83",
    },
    {
      id: "growth",
      name: "Growth",
      monthlyPrice: 19,
      annualPrice: 190,
      annualMonthly: "15.83",
    },
    {
      id: "accountant",
      name: "Accountant",
      monthlyPrice: 49,
      annualPrice: 490,
      annualMonthly: "40.83",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Toggle */}
      <div className="flex items-center gap-3">
        <span className={`text-[13px] font-semibold ${!annual ? "text-[#1C1917]" : "text-[#A8A29E]"}`}>
          Monthly
        </span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative w-10 h-[22px] rounded-full transition-colors ${
            annual ? "bg-[#B3261E]" : "bg-[#D6D3D1]"
          }`}
        >
          <span
            className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${
              annual ? "left-[20px]" : "left-[2px]"
            }`}
          />
        </button>
        <span className={`text-[13px] font-semibold ${annual ? "text-[#1C1917]" : "text-[#A8A29E]"}`}>
          Annual
        </span>
        {annual && (
          <span className="text-[11px] font-bold text-[#15803D] bg-[#F0FDF4] rounded-full px-2 py-0.5">
            Save 2 months
          </span>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-3 gap-3.5">
        {plans.map((p) => {
          const isCurrent = p.id === currentPlan;
          const displayPrice = annual ? p.annualPrice : p.monthlyPrice;
          const displayPer = annual ? "/yr" : "/mo";

          return (
            <div
              key={p.id}
              className={`bg-white border rounded-[14px] p-5 text-center space-y-3 ${
                isCurrent
                  ? "border-[#B3261E] ring-2 ring-[#B3261E]/20"
                  : "border-[#E7E5E4]"
              } shadow-[0_1px_3px_rgba(0,0,0,0.04)]`}
            >
              <p className="text-sm font-bold capitalize">{p.name}</p>
              <p className="text-2xl font-extrabold tracking-[-0.02em]">
                ${displayPrice}
                <span className="text-xs font-medium text-[#A8A29E]">{displayPer}</span>
              </p>
              {annual && (
                <p className="text-[11px] text-[#15803D] -mt-2">
                  ${p.annualMonthly}/mo equivalent
                </p>
              )}
              {isCurrent ? (
                <span className="inline-flex rounded-[9px] bg-[#F0EFED] text-[#A8A29E] text-xs font-semibold px-4 py-2">
                  Current plan
                </span>
              ) : (
                <UpgradePlanButton
                  planId={p.id}
                  label={`Upgrade to ${p.name}`}
                  annual={annual}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
