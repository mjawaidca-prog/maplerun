import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, Landmark, MapPin } from "lucide-react";
import { GuideCard } from "@/components/guide-card";
import { MarketingFooter, MarketingNav } from "@/components/marketing-shell";
import { GUIDES_HUB_URL, PUBLIC_GUIDES, getGuideUrl } from "@/lib/guides";
import { PAY_URL } from "@/lib/seo";

const title = "Canadian Payroll Guides for Employers";
const description =
  "Plain-language Nexvar Pay guides to the Canadian payroll rules that actually bite: province of employment, Quebec payroll, TD1 claim codes, CPP/CPP2 and EI for 2026, remittance due dates, and posting payroll to LedgerPro.";

export const metadata: Metadata = {
  title: { absolute: `${title} | Nexvar Pay` },
  description,
  alternates: { canonical: GUIDES_HUB_URL },
  openGraph: {
    title: `${title} | Nexvar Pay`,
    description,
    url: GUIDES_HUB_URL,
    type: "website",
    locale: "en_CA",
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | Nexvar Pay`,
    description,
  },
};

export default function GuidesHubPage() {
  const featuredGuide =
    PUBLIC_GUIDES.find((guide) => guide.slug === "province-of-employment-rules") ?? PUBLIC_GUIDES[0];

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description,
      url: GUIDES_HUB_URL,
      isPartOf: { "@type": "WebSite", name: "Nexvar Pay", url: PAY_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: PUBLIC_GUIDES.map((guide, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: guide.title,
        url: getGuideUrl(guide),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Nexvar Pay", item: PAY_URL },
        { "@type": "ListItem", position: 2, name: "Guides", item: GUIDES_HUB_URL },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white text-[#1C1917]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
      <MarketingNav />
      <main>
        <section className="bg-gradient-to-b from-white to-[#FEF6F5] px-5 pb-16 pt-14 text-center sm:px-8 sm:pt-20">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#B3261E]">Nexvar Pay guides</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-extrabold leading-tight tracking-[-0.03em] md:text-6xl">
            Canadian payroll rules, explained the way you actually run into them
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-[#57534E]">
            Not feature summaries — working guides to the rules behind every pay run, with the 2026 figures from CRA and
            Revenu Québec and worked examples you can check. Confirm anything year-sensitive on canada.ca before you rely
            on it; Nexvar Pay outputs are not official CRA documents.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href={`/guides/${featuredGuide.slug}`}
              className="inline-flex items-center gap-2 rounded-[11px] bg-[#B3261E] px-6 py-3.5 text-sm font-semibold text-white no-underline hover:bg-[#8F1D17]"
            >
              Start with province of employment <ArrowRight size={16} />
            </Link>
            <Link
              href="/payroll-calculator"
              className="rounded-[11px] border border-[#D6D3D1] bg-white px-6 py-3.5 text-sm font-semibold text-[#1C1917] no-underline hover:bg-[#FAFAF9]"
            >
              Try the payroll calculator
            </Link>
          </div>
        </section>

        <section className="border-y border-[#E7E5E4] py-10">
          <div className="mx-auto grid max-w-[1120px] gap-6 px-5 sm:px-8 md:grid-cols-3">
            <div className="flex gap-4">
              <MapPin className="mt-1 shrink-0 text-[#B3261E]" size={24} />
              <div>
                <h2 className="font-bold">The right province first</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#57534E]">
                  Province of employment decides the tax table, the pension plan, and the slips — before any math happens.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Landmark className="mt-1 shrink-0 text-[#B3261E]" size={24} />
              <div>
                <h2 className="font-bold">2026 figures, sourced</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#57534E]">
                  CPP, CPP2, EI, QPP, and QPIP amounts are the published 2026 values, with the worked arithmetic shown.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Calculator className="mt-1 shrink-0 text-[#B3261E]" size={24} />
              <div>
                <h2 className="font-bold">From rule to pay run</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#57534E]">
                  Each guide ends with what the rule means inside Nexvar Pay — the setting, the calculation, the record.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#B3261E]">Start anywhere</p>
              <h2 className="mt-2 text-3xl font-extrabold">Six payroll guides</h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-[#57534E]">
              Written for owners and the bookkeepers who clean up after payroll — no accounting degree required, no
              marketing fluff tolerated.
            </p>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PUBLIC_GUIDES.map((guide) => (
              <GuideCard key={guide.slug} guide={guide} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-8 text-center sm:px-8">
          <h2 className="text-3xl font-extrabold">Prefer to see the product first?</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-[#57534E]">
            Tour the features, check the plans, then come back to the guides when a rule needs a second look.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/features/canadian-payroll"
              className="rounded-[11px] border border-[#D6D3D1] bg-white px-6 py-3 text-sm font-semibold text-[#1C1917] no-underline hover:bg-[#FAFAF9]"
            >
              Explore features
            </Link>
            <Link
              href="/#pricing"
              className="rounded-[11px] bg-[#B3261E] px-6 py-3 text-sm font-semibold text-white no-underline hover:bg-[#8F1D17]"
            >
              View pricing
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
