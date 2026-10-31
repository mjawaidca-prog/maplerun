import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, ShieldAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { GuideCard } from "@/components/guide-card";
import { MarketingFooter, MarketingNav } from "@/components/marketing-shell";
import { GUIDES_HUB_URL, PUBLIC_GUIDE_SLUGS, getGuideUrl, getPublicGuide, getRelatedPublicGuides } from "@/lib/guides";
import { PAY_URL } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return PUBLIC_GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getPublicGuide(slug);
  if (!guide) return {};
  const url = getGuideUrl(guide);

  return {
    title: { absolute: guide.metaTitle },
    description: guide.description,
    alternates: { canonical: url },
    openGraph: {
      title: guide.metaTitle,
      description: guide.description,
      url,
      type: "article",
      locale: "en_CA",
    },
    twitter: {
      card: "summary_large_image",
      title: guide.metaTitle,
      description: guide.description,
    },
  };
}

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = getPublicGuide(slug);
  if (!guide) notFound();

  const url = getGuideUrl(guide);
  const relatedGuides = getRelatedPublicGuides(guide);
  const organization = {
    "@type": "Organization",
    name: "Nexvar Lab Inc.",
    url: "https://www.nexvarlab.online",
  };
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      author: organization,
      publisher: organization,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      articleSection: guide.category,
      inLanguage: "en-CA",
      about: { "@type": "SoftwareApplication", name: "Nexvar Pay", applicationCategory: "FinanceApplication" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Nexvar Pay", item: PAY_URL },
        { "@type": "ListItem", position: 2, name: "Guides", item: GUIDES_HUB_URL },
        { "@type": "ListItem", position: 3, name: guide.title, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: guide.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
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
        <article>
          <header className="mx-auto max-w-5xl px-5 pb-12 pt-14 text-center sm:px-8 md:pt-20">
            <nav aria-label="Breadcrumb" className="flex items-center justify-center gap-2 text-sm text-[#57534E]">
              <Link href="/guides" className="inline-flex items-center gap-2 font-medium text-[#B3261E] no-underline">
                <ArrowLeft size={15} /> All guides
              </Link>
              <span aria-hidden="true">/</span>
              <span>{guide.category}</span>
            </nav>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.12em] text-[#B3261E]">Nexvar Pay guide</p>
            <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-extrabold leading-tight tracking-[-0.03em] md:text-6xl">
              {guide.title}
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-[#57534E]">{guide.intro}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 text-sm text-[#57534E]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-white px-4 py-2">
                <BookOpenCheck size={16} /> {guide.sections.length} sections
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-white px-4 py-2">
                <CheckCircle2 size={16} /> 2026 figures from CRA &amp; Revenu Québec
              </span>
            </div>
          </header>

          <div className="mx-auto grid max-w-[1120px] gap-10 px-5 pb-16 sm:px-8 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <nav aria-label="Guide contents" className="sticky top-24 rounded-2xl border border-[#E7E5E4] bg-[#FAFAF9] p-5">
                <h2 className="text-sm font-bold uppercase tracking-[0.08em]">In this guide</h2>
                <ol className="mt-4 space-y-3 text-sm leading-relaxed">
                  {guide.sections.map((section, index) => (
                    <li key={section.heading}>
                      <a href={`#section-${index + 1}`} className="text-[#57534E] no-underline hover:text-[#B3261E]">
                        {section.heading}
                      </a>
                    </li>
                  ))}
                </ol>
                <div className="mt-6 border-t border-[#E7E5E4] pt-5">
                  <p className="text-sm leading-relaxed text-[#57534E]">Run payroll with these rules already applied.</p>
                  <Link href="/signup" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#B3261E] no-underline">
                    Start free trial <ArrowRight size={15} />
                  </Link>
                </div>
              </nav>
            </aside>

            <div className="min-w-0">
              {guide.sections.map((section, sectionIndex) => (
                <section
                  key={section.heading}
                  id={`section-${sectionIndex + 1}`}
                  className="scroll-mt-24 border-t border-[#E7E5E4] py-10 first:border-t-0 first:pt-0"
                >
                  <h2 className="text-3xl font-extrabold leading-tight">{section.heading}</h2>

                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph.slice(0, 48)} className="mt-4 leading-[1.85] text-[#44403C]">
                      {paragraph}
                    </p>
                  ))}

                  {section.steps && (
                    <ol className="mt-6 grid gap-3">
                      {section.steps.map((step, stepIndex) => (
                        <li
                          key={`${section.heading}-${stepIndex}`}
                          className="flex gap-4 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] p-4 leading-relaxed text-[#44403C]"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#B3261E] text-sm font-bold text-white">
                            {stepIndex + 1}
                          </span>
                          <span className="pt-1">{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {section.table && (
                    <figure className="mt-6 overflow-x-auto rounded-2xl border border-[#E7E5E4]">
                      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="bg-[#FAFAF9]">
                            {section.table.headers.map((header) => (
                              <th key={header} className="border-b border-[#E7E5E4] px-4 py-3 font-bold text-[#1C1917]">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.table.rows.map((row) => (
                            <tr key={row.join("|")} className="border-b border-[#E7E5E4] last:border-b-0">
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={`${row[0]}-${cellIndex}`}
                                  className={`px-4 py-3 leading-relaxed ${cellIndex === 0 ? "font-semibold text-[#1C1917]" : "text-[#44403C]"}`}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {section.table.caption && (
                        <figcaption className="border-t border-[#E7E5E4] bg-[#FAFAF9] px-4 py-3 text-sm leading-relaxed text-[#57534E]">
                          {section.table.caption}
                        </figcaption>
                      )}
                    </figure>
                  )}

                  {section.notes && (
                    <div className="mt-6 rounded-xl border border-[#E7E5E4] bg-[#FAFAF9] p-5">
                      <h3 className="text-sm font-bold uppercase tracking-[0.08em]">Good to know</h3>
                      <ul className="mt-3 space-y-2">
                        {section.notes.map((note) => (
                          <li key={note} className="flex gap-3 text-sm leading-relaxed text-[#57534E]">
                            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#B3261E]" />
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              ))}

              <section className="rounded-2xl border border-[#FECACA] bg-[#FEF6F5] p-6">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <ShieldAlert size={18} className="text-[#B3261E]" /> A note on figures
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#57534E]">
                  Rates, ceilings, and deadlines in this guide are the published 2026 amounts from CRA and Revenu Québec.
                  Payroll rules change — confirm current figures on canada.ca or revenuquebec.ca before relying on them.
                  Nexvar Pay calculates and records payroll; its outputs are not official CRA or Revenu Québec documents,
                  and your business remains responsible for its remittances and filings.
                </p>
              </section>

              <section className="mt-8 rounded-2xl bg-[#070D14] p-7 text-white md:p-9">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#FCA5A5]">Try the workflow</p>
                <h2 className="mt-3 text-3xl font-extrabold">See these rules applied to your own payroll</h2>
                <p className="mt-4 max-w-2xl leading-relaxed text-[#D7DDE5]">
                  Start a Nexvar Pay trial, or test the numbers first in the free payroll calculator. The guide stays
                  available as a public reference either way.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 rounded-[11px] bg-[#B3261E] px-6 py-3 text-sm font-semibold text-white no-underline hover:bg-[#8F1D17]"
                  >
                    Start 14-day free trial <ArrowRight size={15} />
                  </Link>
                  <Link
                    href="/payroll-calculator"
                    className="inline-flex items-center rounded-[11px] border border-white/30 px-6 py-3 text-sm font-semibold text-white no-underline"
                  >
                    Try the payroll calculator
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </article>

        <section className="mx-auto max-w-4xl px-5 pb-16 sm:px-8">
          <h2 className="text-center text-3xl font-extrabold">Common questions</h2>
          <div className="mt-8 divide-y divide-[#E7E5E4] border-y border-[#E7E5E4]">
            {guide.faq.map((item) => (
              <details key={item.question} className="py-5">
                <summary className="cursor-pointer font-semibold">{item.question}</summary>
                <p className="mt-3 text-sm leading-relaxed text-[#57534E]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {relatedGuides.length > 0 && (
          <section className="border-t border-[#E7E5E4] bg-[#FAFAF9] py-16">
            <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#B3261E]">Keep going</p>
                  <h2 className="mt-2 text-3xl font-extrabold">Related guides</h2>
                </div>
                <Link href="/guides" className="inline-flex items-center gap-2 text-sm font-semibold text-[#B3261E] no-underline">
                  Browse all guides <ArrowRight size={15} />
                </Link>
              </div>
              <div className="mt-8 grid gap-5 md:grid-cols-3">
                {relatedGuides.map((relatedGuide) => (
                  <GuideCard key={relatedGuide.slug} guide={relatedGuide} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
