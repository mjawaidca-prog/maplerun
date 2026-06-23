"use client";

import { useState } from "react";
import Link from "next/link";

const MONTHLY_PRICES = { Solo: 7, Growth: 19, Accountant: 49 };
const EMPLOYEE_PRICES = { Solo: "$2", Growth: "$2", Accountant: "$1.50" };

const PLANS = [
  {
    name: "Solo" as const,
    features: [
      "Unlimited pay runs",
      "Pay stubs with PDF download",
      "T4 slips per employee",
      "CRA-aligned T4127 calculations",
      "All 13 provinces & territories",
      "Email employee pay stubs",
      "Email support",
    ],
  },
  {
    name: "Growth" as const,
    features: [
      "Everything in Solo",
      "PD7A remittance reports",
      "Timesheets with CSV import",
      "ROE (Record of Employment)",
      "EFT / Direct Deposit files",
      "Multiple pay groups",
      "Multi-admin access",
      "Priority support",
    ],
  },
  {
    name: "Accountant" as const,
    features: [
      "Everything in Growth",
      "Multi-company workspace",
      "GL Journal for accounting",
      "Year-End Centre (T4 wizard)",
      "Audit log & compliance",
      "Payroll Summary reports",
      "Bulk pay runs",
      "Priority support · SLA",
    ],
  },
];

export function PricingCards() {
  const [active, setActive] = useState("Growth");
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      {/* Monthly / Annual toggle */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <span className={`text-sm font-semibold ${!annual ? "text-[#1C1917]" : "text-[#A8A29E]"}`}>
          Monthly
        </span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative w-12 h-[26px] rounded-full transition-colors ${
            annual ? "bg-[#B3261E]" : "bg-[#D6D3D1]"
          }`}
          aria-label="Toggle annual billing"
        >
          <span
            className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-transform ${
              annual ? "left-[25px]" : "left-[3px]"
            }`}
          />
        </button>
        <span className={`text-sm font-semibold ${annual ? "text-[#1C1917]" : "text-[#A8A29E]"}`}>
          Annual
        </span>
        {annual && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] rounded-full px-2.5 py-1">
            Save 2 months
          </span>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px] items-start">
        {PLANS.map((plan) => {
          const isActive = active === plan.name;
          const isPopular = plan.name === "Growth";
          const monthlyPrice = MONTHLY_PRICES[plan.name];
          const annualPrice = monthlyPrice * 10; // 2 months free
          const empPrice = EMPLOYEE_PRICES[plan.name];

          return (
            <div
              key={plan.name}
              onClick={() => setActive(plan.name)}
              className={`relative flex flex-col border rounded-2xl p-7 bg-white cursor-pointer transition-all ${
                isActive
                  ? "border-2 border-[#B3261E] shadow-[0_8px_30px_rgba(179,38,30,0.12)]"
                  : `border-[#E7E5E4] ${isPopular ? "shadow-[0_4px_12px_rgba(0,0,0,0.04)]" : ""}`
              }`}
            >
              {isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-[0.05em] bg-[#B3261E] text-white rounded-full px-3 py-1.5">
                  MOST POPULAR
                </span>
              )}

              <p className="text-[15px] font-bold">{plan.name}</p>

              {/* Price — shows monthly rate, annual shows equivalent monthly */}
              {annual ? (
                <>
                  <p className="text-[40px] font-extrabold tracking-[-0.02em] mt-3">
                    ${(annualPrice / 12).toFixed(2)}
                    <span className="text-sm font-medium text-[#A8A29E]"> /mo</span>
                  </p>
                  <p className="text-[13px] text-[#78716C] mt-1">
                    Billed annually at ${annualPrice}/yr
                  </p>
                  <p className="text-[13px] text-[#15803D] mt-0.5 font-medium">
                    Save ${monthlyPrice * 12 - annualPrice} vs monthly
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[40px] font-extrabold tracking-[-0.02em] mt-3">
                    ${monthlyPrice}
                    <span className="text-sm font-medium text-[#A8A29E]"> /mo</span>
                  </p>
                  <p className="text-[13px] text-[#78716C] mt-1">
                    + ${empPrice} / employee / month
                  </p>
                </>
              )}

              <ul className="list-none my-5 flex-1 space-y-0">
                {plan.features.map((f) => (
                  <li key={f} className="text-[13.5px] text-[#44403C] leading-[1.85] flex gap-2.5">
                    <span className="text-[#16A34A] font-bold">✓</span> {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                onClick={(e) => e.stopPropagation()}
                className={`text-center py-2.5 px-[18px] rounded-[10px] text-sm font-semibold no-underline ${
                  isActive || isPopular
                    ? "bg-[#B3261E] text-white hover:bg-[#8F1D17]"
                    : "border border-[#D6D3D1] bg-white text-[#1C1917] hover:border-[#B3261E]"
                }`}
              >
                Start 14-day free trial
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
