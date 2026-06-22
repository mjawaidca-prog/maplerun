"use client";

import { useState } from "react";
import Link from "next/link";

const PLANS = [
  { name: "Solo", price: "$15", emp: "1 employee", features: ["Unlimited pay runs", "Pay stubs & T4 slips", "CRA-aligned calculations"] },
  { name: "Growth", price: "$25", emp: "Up to 10 employees", features: ["Everything in Solo", "Multiple pay groups", "PD7A remittance"] },
  { name: "Accountant", price: "$59", emp: "Unlimited employees", features: ["Everything in Growth", "ROE generation", "Payroll journals · multi-company"] },
];

export function PricingCards() {
  const [active, setActive] = useState("Growth");

  return (
    <div className="grid grid-cols-3 gap-[18px] items-start">
      {PLANS.map((plan) => {
        const isActive = active === plan.name;
        const isPopular = plan.name === "Growth";
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
            <p className="text-[40px] font-extrabold tracking-[-0.02em] mt-3">
              {plan.price}<span className="text-sm font-medium text-[#A8A29E]"> /mo</span>
            </p>
            <p className="text-[13px] text-[#78716C] mt-1">{plan.emp}</p>
            <ul className="list-none my-5 flex-1 space-y-0">
              {plan.features.map((f) => (
                <li key={f} className="text-[13.5px] text-[#44403C] leading-[1.85] flex gap-2.5">
                  <span className="text-[#16A34A] font-bold">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-in"
              onClick={(e) => e.stopPropagation()}
              className={`text-center py-2.5 px-[18px] rounded-[10px] text-sm font-semibold no-underline ${
                isActive || isPopular
                  ? "bg-[#B3261E] text-white hover:bg-[#8F1D17]"
                  : "border border-[#D6D3D1] bg-white text-[#1C1917] hover:border-[#B3261E]"
              }`}
            >
              Start free
            </Link>
          </div>
        );
      })}
    </div>
  );
}
