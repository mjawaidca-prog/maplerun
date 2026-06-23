import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app/", "/payroll/", "/employees/", "/company/", "/reports/", "/onboarding"],
    },
    sitemap: "https://pay.nexvarlab.com/sitemap.xml",
  };
}
