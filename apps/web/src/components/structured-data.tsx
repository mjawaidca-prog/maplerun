/**
 * JSON-LD structured data for SEO — helps Google understand the product.
 * Renders as a <script type="application/ld+json"> tag.
 */
export function StructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Nexvar Pay",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    description:
      "Canadian payroll software for small businesses and accountants. CRA-compliant CPP, EI, and tax calculations for all 13 provinces and territories. Pay stubs, T4 slips, ROEs, and PD7A remittance.",
    url: "https://pay.nexvarlab.com",
    offers: {
      "@type": "Offer",
      price: "7.00",
      priceCurrency: "CAD",
      description: "Starting at $7/month + $2/employee. 14-day free trial.",
    },
    provider: {
      "@type": "Organization",
      name: "NexvarLab",
      url: "https://pay.nexvarlab.com",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "24",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
