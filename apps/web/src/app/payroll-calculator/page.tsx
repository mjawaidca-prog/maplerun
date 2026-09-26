import type { Metadata } from "next";
import Link from "next/link";
import PaychequeCalculator from "@/components/paycheque-calculator";
import { MarketingFooter, MarketingNav } from "@/components/marketing-shell";
import { PAY_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Canadian Payroll Calculator 2026",
  description:
    "Estimate Canadian take-home pay, CPP, EI, federal tax, provincial tax, employer cost, and remittance with the Nexvar Pay payroll calculator.",
  alternates: { canonical: `${PAY_URL}/payroll-calculator` },
  openGraph: {
    title: "Canadian Payroll Calculator 2026 | Nexvar Pay",
    description:
      "Estimate employee deductions, net pay, employer cost, and payroll remittance using 2026 Canadian payroll tables.",
    url: `${PAY_URL}/payroll-calculator`,
    type: "website",
    locale: "en_CA",
  },
};

const faqs = [
  {
    question: "What does the Canadian payroll calculator estimate?",
    answer:
      "It estimates CPP or CPP2 where applicable, EI, federal income tax, provincial or territorial tax, net pay, employer contributions, and total remittance from the inputs provided.",
  },
  {
    question: "Is this calculator an official CRA service?",
    answer:
      "No. Nexvar Pay is not affiliated with the Canada Revenue Agency. Verify payroll remittances and filings against current CRA guidance and your CRA account.",
  },
  {
    question: "Which province should I select?",
    answer:
      "Use the employee's province or territory of employment under the applicable payroll rules, not simply their home address.",
  },
];

export default function PayrollCalculatorPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Nexvar Pay Canadian Payroll Calculator",
        url: `${PAY_URL}/payroll-calculator`,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        description: "Calculator for Canadian payroll deductions, net pay, employer cost, and remittance estimates.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-white text-[#1C1917]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <MarketingNav />
      <main>
        <section className="bg-[#070D14] px-5 py-16 text-white sm:px-8 sm:py-20">
          <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[1fr_1.25fr] lg:items-start">
            <div className="pt-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#FCA5A5]">Free Canadian payroll calculator</p>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-[-0.03em] sm:text-6xl">
                Estimate Canadian take-home pay and employer cost
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-[#D7DDE5]">
                Calculate employee deductions, net pay, employer contributions, and total remittance using the 2026 payroll tables configured in Nexvar Pay.
              </p>
              <ul className="mt-8 grid gap-3 text-[#F3F5F7]">
                <li>✓ CPP, CPP2, EI, federal and provincial tax</li>
                <li>✓ All 13 provinces and territories</li>
                <li>✓ No account required for an estimate</li>
              </ul>
            </div>
            <div className="text-[#1C1917]">
              <PaychequeCalculator />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
          <h2 className="text-3xl font-extrabold">How to use the payroll estimate</h2>
          <p className="mt-4 leading-relaxed text-[#57534E]">
            Select the province of employment and pay frequency, then enter gross pay and any relevant advanced inputs. Review both the employee deductions and employer costs before using the result for planning.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {[
              ["1", "Choose province and frequency"],
              ["2", "Enter gross pay and adjustments"],
              ["3", "Review net pay and remittance"],
            ].map(([number, label]) => (
              <div key={number} className="rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] p-5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#B3261E] text-sm font-bold text-white">{number}</span>
                <p className="mt-4 text-sm font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-16 sm:px-8">
          <h2 className="text-3xl font-extrabold">Canadian payroll calculator questions</h2>
          <div className="mt-8 divide-y divide-[#E7E5E4] border-y border-[#E7E5E4]">
            {faqs.map((item) => (
              <details key={item.question} className="py-5">
                <summary className="cursor-pointer font-semibold">{item.question}</summary>
                <p className="mt-3 text-sm leading-relaxed text-[#57534E]">{item.answer}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 rounded-2xl bg-[#FEF6F5] p-7 text-center">
            <h2 className="text-2xl font-extrabold">Ready to run payroll?</h2>
            <p className="mt-3 text-sm text-[#57534E]">Move from an estimate to saved employees, pay runs, pay stubs, and payroll reports.</p>
            <Link href="/signup" className="mt-6 inline-flex rounded-[10px] bg-[#B3261E] px-6 py-3 text-sm font-semibold text-white no-underline hover:bg-[#8F1D17]">
              Start 14-day free trial
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
