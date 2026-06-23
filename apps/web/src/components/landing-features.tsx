"use client";

import { useLang } from "@/lib/i18n";
import { T } from "@/lib/translations";

const FEATURES = [
  { icon: "🧮", titleKey: "feature1Title" as const, descKey: "feature1Desc" as const },
  { icon: "📄", titleKey: "feature2Title" as const, descKey: "feature2Desc" as const },
  { icon: "🛡️", titleKey: "feature3Title" as const, descKey: "feature3Desc" as const },
  { icon: "⚡", titleKey: "feature4Title" as const, descKey: "feature4Desc" as const },
  { icon: "📈", titleKey: "feature5Title" as const, descKey: "feature5Desc" as const },
  { icon: "👥", titleKey: "feature6Title" as const, descKey: "feature6Desc" as const },
] as const;

export function LandingFeaturesSection() {
  const { lang } = useLang();
  const fr = lang === "fr";

  return (
    <>
      <div className="text-center max-w-[560px] mx-auto mb-11">
        <p className="text-xs font-bold text-[#B3261E] uppercase tracking-[0.08em]">
          {fr ? T.featuresLabel.fr : T.featuresLabel.en}
        </p>
        <h2 className="text-[34px] font-extrabold tracking-[-0.02em] mt-2.5">
          {fr ? T.featuresTitle.fr : T.featuresTitle.en}
        </h2>
      </div>
      <div className="grid grid-cols-3 gap-5">
        {FEATURES.map((f) => (
          <div key={f.titleKey} className="border border-[#E7E5E4] rounded-[14px] p-6 bg-white hover:border-[#B3261E]/30 hover:shadow-[0_4px_12px_rgba(179,38,30,0.06)] transition-all">
            <div className="w-11 h-11 rounded-[11px] bg-[#B3261E]/10 flex items-center justify-center text-[21px] mb-4">{f.icon}</div>
            <h3 className="text-base font-bold text-[#1C1917]">{fr ? T[f.titleKey].fr : T[f.titleKey].en}</h3>
            <p className="text-[13.5px] text-[#57534E] mt-1.5 leading-relaxed">{fr ? T[f.descKey].fr : T[f.descKey].en}</p>
          </div>
        ))}
      </div>
    </>
  );
}
