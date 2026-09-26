import Link from "next/link";
import { Logo } from "@/components/logo";
import { LEDGERPRO_URL, NEXVAR_URL } from "@/lib/seo";

export function MarketingNav() {
  return (
    <nav className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-6 px-5 py-5 sm:px-8">
      <Link href="/" className="flex items-center no-underline" aria-label="Nexvar Pay home">
        <Logo size={30} />
      </Link>
      <div className="hidden items-center gap-6 md:flex">
        <Link href="/features/canadian-payroll" className="text-sm font-medium text-[#57534E] no-underline hover:text-[#1C1917]">Features</Link>
        <Link href="/payroll-calculator" className="text-sm font-medium text-[#57534E] no-underline hover:text-[#1C1917]">Payroll Calculator</Link>
        <Link href="/#pricing" className="text-sm font-medium text-[#57534E] no-underline hover:text-[#1C1917]">Pricing</Link>
        <Link href="/sign-in" className="text-sm font-medium text-[#57534E] no-underline hover:text-[#1C1917]">Sign in</Link>
      </div>
      <Link href="/signup" className="rounded-[10px] bg-[#B3261E] px-[18px] py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#8F1D17]">
        Start free trial
      </Link>
    </nav>
  );
}

export function MarketingFooter() {
  return (
    <footer className="mt-16 border-t border-[#E7E5E4] bg-white">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Logo size={28} />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#78716C]">
            Canadian payroll calculations, pay records, remittance support, and accountant workflows from Nexvar Lab Inc.
          </p>
        </div>
        <div>
          <p className="text-sm font-bold text-[#1C1917]">Payroll</p>
          <div className="mt-3 grid gap-2 text-sm">
            <Link href="/features/pay-stubs-t4" className="text-[#78716C] no-underline hover:text-[#B3261E]">Pay stubs &amp; T4</Link>
            <Link href="/features/direct-deposit" className="text-[#78716C] no-underline hover:text-[#B3261E]">EFT &amp; direct deposit files</Link>
            <Link href="/features/payroll-for-accountants" className="text-[#78716C] no-underline hover:text-[#B3261E]">Payroll for accountants</Link>
            <Link href="/payroll-calculator" className="text-[#78716C] no-underline hover:text-[#B3261E]">Payroll calculator</Link>
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-[#1C1917]">Nexvar products</p>
          <div className="mt-3 grid gap-2 text-sm">
            <a href={LEDGERPRO_URL} className="text-[#78716C] no-underline hover:text-[#B3261E]">LedgerPro accounting</a>
            <a href={NEXVAR_URL} className="text-[#78716C] no-underline hover:text-[#B3261E]">Nexvar Lab Inc.</a>
            <a href="mailto:hello@nexvarlab.online" className="text-[#78716C] no-underline hover:text-[#B3261E]">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
