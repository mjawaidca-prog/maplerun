import type { MetadataRoute } from "next";
import { PAY_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/app/",
        "/payroll/",
        "/employees/",
        "/company/",
        "/reports/",
        "/onboarding",
        "/sign-in",
        "/signup",
        "/verify-request",
      ],
    },
    sitemap: `${PAY_URL}/sitemap.xml`,
    host: PAY_URL,
  };
}
