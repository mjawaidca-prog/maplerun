import type { MetadataRoute } from "next";
import { PUBLIC_GUIDES, getGuideUrl } from "@/lib/guides";
import { PAYROLL_FEATURE_SLUGS, PAY_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: PAY_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${PAY_URL}/payroll-calculator`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...PAYROLL_FEATURE_SLUGS.map((slug) => ({
      url: `${PAY_URL}/features/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${PAY_URL}/guides`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },
    ...PUBLIC_GUIDES.map((guide) => ({
      url: getGuideUrl(guide),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: guide.priority,
    })),
  ];
}
