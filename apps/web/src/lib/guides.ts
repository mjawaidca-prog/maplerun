import { PAY_URL } from "./seo";
import { GUIDE_CONTENT } from "./guides-content";

/**
 * Public SEO guides for Nexvar Pay — the data layer.
 *
 * Content lives in guides-content.ts; this module defines the shape,
 * the registry, and URL/lookup helpers used by the /guides pages,
 * the sitemap, and the data-integrity tests.
 */

export type GuideTable = {
  caption?: string;
  headers: string[];
  rows: string[][];
};

export type GuideSection = {
  heading: string;
  paragraphs?: string[];
  steps?: string[];
  notes?: string[];
  table?: GuideTable;
};

export type PayrollGuide = {
  /** Route segment below /guides. */
  slug: string;
  /** Search-facing H1. */
  title: string;
  /** Absolute browser title used in metadata and structured data. */
  metaTitle: string;
  /** Meta description and social-sharing summary. */
  description: string;
  /** Short public introduction shown below the H1. */
  intro: string;
  /** Display category shown on cards and the article header. */
  category: string;
  /** Sitemap priority; the province-of-employment guide is the flagship. */
  priority: number;
  /** Related public guide slugs, in display order. */
  related: string[];
  sections: GuideSection[];
  faq: Array<{ question: string; answer: string }>;
};

export const PUBLIC_GUIDES: PayrollGuide[] = GUIDE_CONTENT;

export const PUBLIC_GUIDE_SLUGS = PUBLIC_GUIDES.map((guide) => guide.slug);

const guideBySlug = new Map(PUBLIC_GUIDES.map((guide) => [guide.slug, guide]));

export function getPublicGuide(slug: string): PayrollGuide | undefined {
  return guideBySlug.get(slug);
}

export function getRelatedPublicGuides(guide: PayrollGuide): PayrollGuide[] {
  return guide.related
    .map((slug) => guideBySlug.get(slug))
    .filter((related): related is PayrollGuide => Boolean(related));
}

export function getGuideUrl(guide: PayrollGuide): string {
  return `${PAY_URL}/guides/${guide.slug}`;
}

export const GUIDES_HUB_URL = `${PAY_URL}/guides`;
