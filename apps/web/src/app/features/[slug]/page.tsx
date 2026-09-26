import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { MarketingFooter, MarketingNav } from "@/components/marketing-shell";
import { PAYROLL_FEATURES, PAYROLL_FEATURE_SLUGS, PAY_URL } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PAYROLL_FEATURE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const feature = PAYROLL_FEATURES[slug];
  if (!feature) return {};
  const url = `${PAY_URL}/features/${feature.slug}`;

  return {
    title: { absolute: feature.metaTitle },
    description: feature.description,
    alternates: { canonical: url },
    openGraph: {
      title: feature.metaTitle,
      description: feature.description,
      url,
      type: "website",
      locale: "en_CA",
    },
    twitter: {
      card: "summary_large_image",
      title: feature.metaTitle,
      description: feature.description,
    },
  };
}

export default async function PayrollFeaturePage({ params }: Props) {
  const { slug } = await params;
  const feature = PAYROLL_FEATURES[slug];
  if (!feature) notFound();
  const url = `${PAY_URL}/features/${feature.slug}`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: feature.metaTitle,
      description: feature.description,
      url,
      isPartOf: { "@type": "WebSite", name: "Nexvar Pay", url: PAY_URL },
      about: { "@type": "SoftwareApplication", name: "Nexvar Pay", applicationCategory: "FinanceApplication" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Nexvar Pay", item: PAY_URL },
        { "@type": "ListItem", position: 2, name: feature.title, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: feature.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-white text-[#1C1917]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <MarketingNav />
      <main>
        <section className="bg-gradient-to-b from-white to-[#FEF6F5] px-5 pb-16 pt-14 text-center sm:px-8 sm:pt-20">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#B3261E]">{feature.eyebrow}</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-extrabold leading-tight tracking-[-0.03em] md:text-6xl">{feature.title}</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-[#57534E]">{feature.intro}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-[11px] bg-[#B3261E] px-6 py-3.5 text-sm font-semibold text-white no-underline hover:bg-[#8F1D17]">
              Start 14-day free trial <ArrowRight size={16} />
            </Link>
            <Link href="/payroll-calculator" className="rounded-[11px] border border-[#D6D3D1] bg-white px-6 py-3.5 text-sm font-semibold text-[#1C1917] no-underline hover:bg-[#FAFAF9]">
              Try payroll calculator
            </Link>
          </div>
        </section>

        <section className="border-y border-[#E7E5E4] py-16">
          <div className="mx-auto grid max-w-[1120px] gap-5 px-5 sm:grid-cols-2 sm:px-8">
            {feature.benefits.map((benefit) => (
              <article key={benefit.title} className="rounded-[14px] border border-[#E7E5E4] bg-white p-6">
                <CheckCircle2 className="mb-4 text-[#B3261E]" size={22} />
                <h2 className="text-lg font-bold">{benefit.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#57534E]">{benefit.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-[1120px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_.85fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#B3261E]">How it works</p>
            <h2 className="mt-3 text-3xl font-extrabold">A controlled payroll workflow from inputs to records</h2>
            <ol className="mt-7 grid gap-4">
              {feature.workflow.map((step, index) => (
                <li key={step} className="flex gap-4 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] p-4 text-sm leading-relaxed text-[#44403C]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#B3261E] font-bold text-white">{index + 1}</span>
                  <span className="pt-1">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <aside className="rounded-2xl bg-[#070D14] p-8 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#FCA5A5]">Important</p>
            <h2 className="mt-3 text-3xl font-extrabold">Payroll software supports your process</h2>
            <p className="mt-4 leading-relaxed text-[#D7DDE5]">
              Nexvar Pay calculates and organizes payroll information. Employers remain responsible for verifying employee inputs, remittances, payment files, and filings against current CRA and bank requirements.
            </p>
          </aside>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-16 sm:px-8">
          <h2 className="text-center text-3xl font-extrabold">Common questions</h2>
          <div className="mt-8 divide-y divide-[#E7E5E4] border-y border-[#E7E5E4]">
            {feature.faq.map((item) => (
              <details key={item.question} className="py-5">
                <summary className="cursor-pointer font-semibold">{item.question}</summary>
                <p className="mt-3 text-sm leading-relaxed text-[#57534E]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
