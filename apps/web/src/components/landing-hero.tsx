"use client";

import { useLang } from "@/lib/i18n";
import Link from "next/link";

export function LandingHero() {
  const { lang } = useLang();
  const fr = lang === "fr";

  return (
    <>
      <span className="inline-flex items-center gap-[7px] text-xs font-semibold text-[#0F172A] bg-[#EFF6FF] border border-[#BFDBFE] rounded-full px-3.5 py-1.5 mb-[22px]">
        🇨🇦{" "}
        {fr
          ? "Conçu pour les PME et comptables canadiens · Un produit NexvarLab"
          : "Built for Canadian small business & accountants · A NexvarLab product"}
      </span>
      <h1 className="text-[52px] font-extrabold leading-tight tracking-[-0.03em] max-w-[760px] mx-auto">
        {fr ? (
          <>
            Une paie aussi claire qu&apos;un{" "}
            <em className="not-italic text-[#B3261E]">relevé bancaire</em>, pas un chiffrier.
          </>
        ) : (
          <>
            Payroll that feels like a{" "}
            <em className="not-italic text-[#B3261E]">bank statement</em>, not a spreadsheet.
          </>
        )}
      </h1>
      <p className="text-lg text-[#57534E] mt-5 max-w-[560px] mx-auto leading-relaxed">
        {fr
          ? "Exécutez la paie conforme au RPC, à l'AE et à l'impôt en quelques minutes. Des fiches de paie et T4 auxquels vos employés et comptable feront confiance."
          : "Run CPP, EI, and tax-accurate payroll in minutes. Pay stubs and T4s your employees and accountant will actually trust."}
      </p>
      <div className="flex gap-3 justify-center mt-[30px]">
        <Link
          href="/signup"
          className="inline-flex px-6 py-3.5 text-[15px] rounded-[11px] bg-[#B3261E] text-white font-semibold no-underline hover:bg-[#8F1D17]"
        >
          {fr ? "Essai gratuit de 14 jours" : "Start 14-day free trial"}
        </Link>
        <a
          href="#calculator"
          className="inline-flex px-6 py-3.5 text-[15px] rounded-[11px] border border-[#D6D3D1] bg-white text-[#1C1917] font-semibold no-underline hover:bg-gray-50"
        >
          {fr ? "Calculateur rapide" : "Quick calculator"}
        </a>
      </div>
      <p className="text-sm text-[#57534E] mt-[18px] font-medium">
        {fr
          ? "🔓 Aucune carte de crédit · Annulez quand vous voulez · Accès complet pendant 14 jours"
          : "🔓 No credit card required · Cancel anytime · Full access for 14 days"}
      </p>
    </>
  );
}
