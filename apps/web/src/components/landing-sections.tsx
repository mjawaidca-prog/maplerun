"use client";

import { useLang } from "@/lib/i18n";
import { T } from "@/lib/translations";
import Link from "next/link";

/** Stats bar — 137 tests | 13 provinces | 2026 CRA | 100% spreadsheet-free */
export function LandingStats() {
  const { lang } = useLang();
  const fr = lang === "fr";
  return (
    <section className="py-16 bg-[#FAFAF9] border-y border-[#E7E5E4]">
      <div className="max-w-[1120px] mx-auto px-8">
        <div className="grid grid-cols-4 gap-8 text-center">
          {[
            { value: "137", label: fr ? T.stat1Label.fr : T.stat1Label.en },
            { value: "13", label: fr ? T.stat2Label.fr : T.stat2Label.en },
            { value: "2026", label: fr ? T.stat3Label.fr : T.stat3Label.en },
            { value: "100%", label: fr ? T.stat4Label.fr : T.stat4Label.en },
          ].map((s) => (
            <div key={s.label} className="space-y-2">
              <p className="text-[36px] font-extrabold tracking-[-0.02em] text-[#1C1917]">{s.value}</p>
              <p className="text-sm text-[#78716C] font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Security trust bar */
export function LandingSecurity() {
  const { lang } = useLang();
  const fr = lang === "fr";
  const items = [
    { icon: "🔒", title: T.sec1Title, desc: T.sec1Desc },
    { icon: "🗄", title: T.sec2Title, desc: T.sec2Desc },
    { icon: "💳", title: T.sec3Title, desc: T.sec3Desc },
    { icon: "📧", title: T.sec4Title, desc: T.sec4Desc },
  ];
  return (
    <section className="py-10 bg-white border-y border-[#E7E5E4]">
      <div className="max-w-[1120px] mx-auto px-8">
        <div className="grid grid-cols-4 gap-8 text-center">
          {items.map((item) => (
            <div key={item.title.en} className="space-y-2">
              <div className="text-2xl">{item.icon}</div>
              <p className="text-[13px] font-bold text-[#1C1917]">{fr ? item.title.fr : item.title.en}</p>
              <p className="text-xs text-[#A8A29E]">{fr ? item.desc.fr : item.desc.en}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Calculator dark hero section */
export function LandingCalculatorHero() {
  const { lang } = useLang();
  const fr = lang === "fr";
  return (
    <div className="text-white max-w-[560px]">
      <h2 className="text-[32px] sm:text-[42px] lg:text-[52px] font-extrabold leading-[1.15] tracking-[-0.03em] m-0 mb-5 sm:mb-7">
        {fr ? T.calcTitle.fr : T.calcTitle.en}
      </h2>
      <p className="text-base sm:text-lg lg:text-[22px] leading-relaxed text-[#D7DDE5] mb-8 sm:mb-[42px]">
        {fr ? T.calcDesc.fr : T.calcDesc.en}
      </p>

      <div className="grid gap-4 sm:gap-[22px] mb-8 sm:mb-12">
        {[T.calcTrust1, T.calcTrust2, T.calcTrust3].map((t) => (
          <div key={t.en} className="flex items-center gap-3 sm:gap-4 text-base sm:text-lg lg:text-xl text-[#F3F5F7]">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/10 grid place-items-center font-extrabold text-sm sm:text-base">✓</div>
            {fr ? t.fr : t.en}
          </div>
        ))}
      </div>

      <Link
        href="/signup"
        className="inline-block px-6 sm:px-[34px] py-3.5 sm:py-[18px] border border-white/35 rounded-lg text-white text-base sm:text-lg no-underline hover:bg-white/10 transition-colors"
      >
        {fr ? T.calcCTA.fr : T.calcCTA.en}
      </Link>
    </div>
  );
}

/** Footer */
export function LandingFooter() {
  const { lang } = useLang();
  const fr = lang === "fr";
  return (
    <footer className="border-t border-[#E7E5E4] py-9 mt-6">
      <div className="max-w-[1120px] mx-auto px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5 font-extrabold tracking-tight text-[17px]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="26" height="26" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
              <rect width="32" height="32" rx="8" fill="#0F172A" />
              <path d="M10 24V10L17 22L24 8V24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            NEXVAR
          </div>
          <div className="flex gap-[22px]">
            <a href="#features" className="text-[13px] text-[#78716C] no-underline">{fr ? T.navFeatures.fr : T.navFeatures.en}</a>
            <a href="#pricing" className="text-[13px] text-[#78716C] no-underline">{fr ? T.navPricing.fr : T.navPricing.en}</a>
            <Link href="/sign-in" className="text-[13px] text-[#78716C] no-underline">{fr ? T.navSignIn.fr : T.navSignIn.en}</Link>
            <a href="#" className="text-[13px] text-[#78716C] no-underline">{fr ? T.footerPrivacy.fr : T.footerPrivacy.en}</a>
            <a href="#" className="text-[13px] text-[#78716C] no-underline">{fr ? T.footerTerms.fr : T.footerTerms.en}</a>
          </div>
        </div>
        <p className="text-xs text-[#A8A29E] mt-[18px] leading-relaxed max-w-[620px]">
          {fr ? T.footerDisclaimer.fr : T.footerDisclaimer.en}
        </p>
      </div>
    </footer>
  );
}
