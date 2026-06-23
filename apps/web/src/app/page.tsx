import PaychequeCalculator from "@/components/paycheque-calculator";
import { PricingCards } from "@/components/pricing-cards";
import { Logo } from "@/components/logo";
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
          <button className="text-sm text-[#57534E] hover:text-[#1C1917] font-medium bg-transparent border border-[#D6D3D1] rounded-md px-2 py-0.5 cursor-pointer" title="Français bientôt disponible">
            EN
          </button>
          <Link href="/sign-in" className="text-sm text-[#57534E] hover:text-[#1C1917] font-medium no-underline">Sign in</Link>
          <Link href="/signup" className="inline-flex items-center gap-2 px-[18px] py-2.5 rounded-[10px] bg-[#B3261E] text-white text-sm font-semibold no-underline hover:bg-[#8F1D17] transition-colors">
            14-day free trial →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-[#FEF6F5] py-[70px] pb-20 text-center">
        <div className="max-w-[1120px] mx-auto px-8">
          <span className="inline-flex items-center gap-[7px] text-xs font-semibold text-[#0F172A] bg-[#EFF6FF] border border-[#BFDBFE] rounded-full px-3.5 py-1.5 mb-[22px]">
            🇨🇦 Built for Canadian small business & accountants · A NexvarLab product
          </span>
          <h1 className="text-[52px] font-extrabold leading-tight tracking-[-0.03em] max-w-[760px] mx-auto">
            Payroll that feels like a <em className="not-italic text-[#B3261E]">bank statement</em>, not a spreadsheet.
          </h1>
          <p className="text-lg text-[#57534E] mt-5 max-w-[560px] mx-auto leading-relaxed">
            Run CPP, EI, and tax-accurate payroll in minutes. Pay stubs and T4s your employees and accountant will actually trust.
          </p>
          <div className="flex gap-3 justify-center mt-[30px]">
            <Link href="/signup" className="inline-flex px-6 py-3.5 text-[15px] rounded-[11px] bg-[#B3261E] text-white font-semibold no-underline hover:bg-[#8F1D17]">
              Start 14-day free trial
            </Link>
            <a href="#calculator" className="inline-flex px-6 py-3.5 text-[15px] rounded-[11px] border border-[#D6D3D1] bg-white text-[#1C1917] font-semibold no-underline hover:bg-gray-50">
              Quick calculator
            </a>
          </div>
          <p className="text-sm text-[#57534E] mt-[18px] font-medium">
            🔓 No credit card required · Cancel anytime · Full access for 14 days
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-[72px]">
        <div className="max-w-[1120px] mx-auto px-8">
          <div className="text-center max-w-[560px] mx-auto mb-11">
            <p className="text-xs font-bold text-[#B3261E] uppercase tracking-[0.08em]">Everything in one place</p>
            <h2 className="text-[34px] font-extrabold tracking-[-0.02em] mt-2.5">Built for the way payroll actually works</h2>
          </div>
          <div className="grid grid-cols-3 gap-5">
            {[
              { icon: "🧮", title: "Accurate calculations", desc: "CPP, CPP2, EI, federal and provincial tax — using the current year's CRA tables, every run." },
              { icon: "📄", title: "Pay stubs & T4s", desc: "Bank-statement-quality documents your team can download, print, or receive by email." },
              { icon: "🛡️", title: "Guided & safe", desc: "Preview every deduction and confirm before you finalize. Drafts are saved automatically." },
              { icon: "⚡", title: "Minutes, not hours", desc: "A three-step wizard takes a full pay run from gross amounts to net deposit." },
              { icon: "📈", title: "Always up to date", desc: "Rate tables update each tax year. Past runs keep their original year's rates." },
              { icon: "👥", title: "Built for owners & accountants", desc: "Multi-company dashboard for bookkeepers. Full CRA reports for accountants. Your whole team stays in sync." },
            ].map((f) => (
              <div key={f.title} className="border border-[#E7E5E4] rounded-[14px] p-6 bg-white hover:border-[#B3261E]/30 hover:shadow-[0_4px_12px_rgba(179,38,30,0.06)] transition-all">
                <div className="w-11 h-11 rounded-[11px] bg-[#B3261E]/10 flex items-center justify-center text-[21px] mb-4">{f.icon}</div>
                <h3 className="text-base font-bold text-[#1C1917]">{f.title}</h3>
                <p className="text-[13.5px] text-[#57534E] mt-1.5 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-[72px] bg-[#FAFAF9]">
        <div className="max-w-[1120px] mx-auto px-8">
          <div className="text-center max-w-[560px] mx-auto mb-11">
            <p className="text-xs font-bold text-[#B3261E] uppercase tracking-[0.08em]">Simple pricing</p>
            <h2 className="text-[34px] font-extrabold tracking-[-0.02em] mt-2.5">One plan per team size</h2>
            <p className="text-[15px] text-[#78716C] mt-2.5">
              Prices in CAD. 14-day free trial on all plans · No credit card required · Cancel anytime.
            </p>
          </div>
          <PricingCards />
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-[72px]">
        <div className="max-w-[1120px] mx-auto px-8">
          <div className="text-center max-w-[560px] mx-auto mb-11">
            <p className="text-xs font-bold text-[#B3261E] uppercase tracking-[0.08em]">Trusted by Canadian teams</p>
            <h2 className="text-[34px] font-extrabold tracking-[-0.02em] mt-2.5">Less dread, more done</h2>
          </div>
          <div className="grid grid-cols-3 gap-5">
            {[
              { q: '"I switched from a spreadsheet and a prayer. Now payroll takes ten minutes and I actually trust the numbers."', name: "Marcus Reid", role: "Owner, Northwind Carpentry", initial: "M" },
              { q: '"The pay stubs look like they came from a bank. My employees stopped asking me to explain their deductions."', name: "Priya Sharma", role: "Founder, Lumen Studio", initial: "P" },
              { q: '"As the bookkeeper for six clients, the journal export and ROE tools save me a full day each month."', name: "Jean‑Luc Caron", role: "CPA, Caron Accounting", initial: "J" },
            ].map((t) => (
              <div key={t.name} className="border border-[#E7E5E4] rounded-[14px] p-6 bg-[#FAFAF9]">
                <p className="text-sm text-[#1C1917] leading-relaxed">{t.q}</p>
                <div className="flex items-center gap-[11px] mt-[18px]">
                  <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-br from-[#B3261E] to-[#E56A5C] flex items-center justify-center text-white font-bold text-sm">{t.initial}</div>
                  <div>
                    <p className="text-[13px] font-bold">{t.name}</p>
                    <p className="text-xs text-[#A8A29E]">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security trust bar */}
      <section className="py-10 bg-white border-y border-[#E7E5E4]">
        <div className="max-w-[1120px] mx-auto px-8">
          <div className="grid grid-cols-4 gap-8 text-center">
            {[
              { icon: "🔒", title: "AES-256-GCM", desc: "SIN & bank details encrypted at rest" },
              { icon: "🗄", title: "Neon PostgreSQL", desc: "Canada-adjacent infrastructure · SSL" },
              { icon: "💳", title: "Stripe PCI DSS Level 1", desc: "Payments never touch our servers" },
              { icon: "📧", title: "Resend DKIM/SPF", desc: "Encrypted email delivery, verified" },
            ].map((t) => (
              <div key={t.title} className="space-y-2">
                <div className="text-2xl">{t.icon}</div>
                <p className="text-[13px] font-bold text-[#1C1917]">{t.title}</p>
                <p className="text-xs text-[#A8A29E]">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section id="calculator" className="bg-[#070D14] py-16 sm:py-20 px-4 sm:px-8">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.35fr] gap-8 lg:gap-16 items-start lg:items-center">
          {/* Hero */}
          <div className="text-white max-w-[560px]">
            <h2 className="text-[32px] sm:text-[42px] lg:text-[52px] font-extrabold leading-[1.15] tracking-[-0.03em] m-0 mb-5 sm:mb-7">
              Estimate Canadian take-home pay in seconds
            </h2>
            <p className="text-base sm:text-lg lg:text-[22px] leading-relaxed text-[#D7DDE5] mb-8 sm:mb-[42px]">
              NEXVAR shows employee deductions, employer cost, and total remittance before you run payroll.
            </p>

            <div className="grid gap-4 sm:gap-[22px] mb-8 sm:mb-12">
              <div className="flex items-center gap-3 sm:gap-4 text-base sm:text-lg lg:text-xl text-[#F3F5F7]">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/10 grid place-items-center font-extrabold text-sm sm:text-base">✓</div>
                Uses 2026 CRA payroll deduction tables
              </div>
              <div className="flex items-center gap-3 sm:gap-4 text-base sm:text-lg lg:text-xl text-[#F3F5F7]">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/10 grid place-items-center font-extrabold text-sm sm:text-base">✓</div>
                Includes CPP, EI, federal and provincial tax
              </div>
              <div className="flex items-center gap-3 sm:gap-4 text-base sm:text-lg lg:text-xl text-[#F3F5F7]">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/10 grid place-items-center font-extrabold text-sm sm:text-base">✓</div>
                No account required
              </div>
            </div>

            <Link
              href="/signup"
              className="inline-block px-6 sm:px-[34px] py-3.5 sm:py-[18px] border border-white/35 rounded-lg text-white text-base sm:text-lg no-underline hover:bg-white/10 transition-colors"
            >
              See NEXVAR payroll
            </Link>
          </div>

          {/* Calculator card */}
          <div className="text-[#1C1917]">
            <PaychequeCalculator />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E7E5E4] py-9 mt-6">
        <div className="max-w-[1120px] mx-auto px-8">
          <div className="flex justify-between items-center">
            <Logo size={26} />
            <div className="flex gap-[22px]">
              <a href="#features" className="text-[13px] text-[#78716C] no-underline">Features</a>
              <a href="#pricing" className="text-[13px] text-[#78716C] no-underline">Pricing</a>
              <Link href="/sign-in" className="text-[13px] text-[#78716C] no-underline">Sign in</Link>
              <a href="#" className="text-[13px] text-[#78716C] no-underline">Privacy</a>
              <a href="#" className="text-[13px] text-[#78716C] no-underline">Terms</a>
            </div>
          </div>
          <p className="text-xs text-[#A8A29E] mt-[18px] leading-relaxed max-w-[620px]">
            © {new Date().getFullYear()} NexvarLab. Nexvar Pay is a payroll calculation tool. Outputs are not official CRA documents. Verify all remittances and filings against your CRA account. NexvarLab is not affiliated with the Canada Revenue Agency.
          </p>
        </div>
      </footer>
    </div>
  );
}
