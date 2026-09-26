/**
 * JSON-LD structured data for SEO — helps Google understand the product.
 * Renders as a <script type="application/ld+json"> tag.
 */
export function StructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": "https://pay.nexvarlab.com/#software",
        name: "Nexvar Pay",
        applicationCategory: "FinanceApplication",
        applicationSubCategory: "PayrollSoftware",
        operatingSystem: "Web",
        description:
          "Canadian payroll software for small businesses and accountants with CPP, EI, and tax calculations, pay stubs, payroll reports, and year-end workflows.",
        url: "https://pay.nexvarlab.com",
        featureList: [
          "CPP, CPP2, EI, and income-tax calculations",
          "Payroll for all Canadian provinces and territories",
          "Employee pay stubs and T4 preparation",
          "PD7A remittance reports",
          "EFT and direct-deposit file preparation",
          "Multi-company accountant workspace",
        ],
        offers: {
          "@type": "AggregateOffer",
          lowPrice: "7.00",
          highPrice: "49.00",
          priceCurrency: "CAD",
          offerCount: "3",
          url: "https://pay.nexvarlab.com/#pricing",
        },
        provider: { "@id": "https://www.nexvarlab.online/#organization" },
      },
      {
        "@type": "WebSite",
        "@id": "https://pay.nexvarlab.com/#website",
        name: "Nexvar Pay",
        url: "https://pay.nexvarlab.com",
        publisher: { "@id": "https://www.nexvarlab.online/#organization" },
      },
      {
        "@type": "Organization",
        "@id": "https://www.nexvarlab.online/#organization",
        name: "Nexvar Lab Inc.",
        url: "https://www.nexvarlab.online",
        email: "hello@nexvarlab.online",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
