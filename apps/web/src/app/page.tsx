import PaychequeCalculator from "@/components/paycheque-calculator";
import { PricingCards } from "@/components/pricing-cards";
import { Logo } from "@/components/logo";
import { LangToggle } from "@/components/lang-toggle";
import { LandingHero } from "@/components/landing-hero";
import { LandingFeaturesSection } from "@/components/landing-features";
import { LandingStats, LandingSecurity, LandingCalculatorHero, LandingFooter } from "@/components/landing-sections";
import { PricingHeader } from "@/components/pricing-header";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Nav */}
      <nav className="max-w-[1120px] mx-auto w-full px-8 flex items-center justify-between py-5">
        <Link href="/" className="flex items-center gap-2.5 font-extrabold tracking-tight no-underline">
          <Logo size={30} />
        </Link>
        <div className="flex items-center gap-7">
          <a href="#features" className="text-sm text-[#57534E] hover:text-[#1C1917] font-medium no-underline">Features</a>
          <a href="#pricing" className="text-sm text-[#57534E] hover:text-[#1C1917] font-medium no-underline">Pricing</a>
          <a href="#calculator" className="text-sm text-[#57534E] hover:text-[#1C1917] font-medium no-underline">Calculator</a>
          <LangToggle />
          <Link href="/sign-in" className="text-sm text-[#57534E] hover:text-[#1C1917] font-medium no-underline">Sign in</Link>
          <Link href="/signup" className="inline-flex items-center gap-2 px-[18px] py-2.5 rounded-[10px] bg-[#B3261E] text-white text-sm font-semibold no-underline hover:bg-[#8F1D17] transition-colors">
            14-day free trial →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-[#FEF6F5] py-[70px] pb-20 text-center">
        <div className="max-w-[1120px] mx-auto px-8">
          <LandingHero />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-[72px]">
        <div className="max-w-[1120px] mx-auto px-8">
          <LandingFeaturesSection />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-[72px] bg-[#FAFAF9]">
        <div className="max-w-[1120px] mx-auto px-8">
          <PricingHeader />
          <PricingCards />
        </div>
      </section>

      {/* Stats bar */}
      <LandingStats />

      {/* Security trust bar */}
      <LandingSecurity />

      {/* Calculator */}
      <section id="calculator" className="bg-[#070D14] py-16 sm:py-20 px-4 sm:px-8">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.35fr] gap-8 lg:gap-16 items-start lg:items-center">
          <LandingCalculatorHero />

          {/* Calculator card */}
          <div className="text-[#1C1917]">
            <PaychequeCalculator />
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
