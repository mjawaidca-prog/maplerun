import type { MetadataRoute } from "next";
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
  ];
}
