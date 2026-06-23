"use client";

import { useLang } from "@/lib/i18n";
import { T } from "@/lib/translations";

export function PricingHeader() {
  const { lang } = useLang();
  const fr = lang === "fr";
  return (
    <div className="text-center max-w-[560px] mx-auto mb-11">
      <p className="text-xs font-bold text-[#B3261E] uppercase tracking-[0.08em]">
        {fr ? T.pricingLabel.fr : T.pricingLabel.en}
      </p>
      <h2 className="text-[34px] font-extrabold tracking-[-0.02em] mt-2.5">
        {fr ? T.pricingTitle.fr : T.pricingTitle.en}
      </h2>
      <p className="text-[15px] text-[#78716C] mt-2.5">
        {fr ? T.pricingSub.fr : T.pricingSub.en}
      </p>
    </div>
  );
}
