import { describe, it, expect } from "vitest";
import {
  GUIDES_HUB_URL,
  PUBLIC_GUIDES,
  PUBLIC_GUIDE_SLUGS,
  getGuideUrl,
  getPublicGuide,
  getRelatedPublicGuides,
} from "../src/lib/guides";

describe("public guides registry", () => {
  it("publishes exactly the six v1 guides", () => {
    expect(PUBLIC_GUIDE_SLUGS).toEqual([
      "province-of-employment-rules",
      "quebec-payroll-qpp-qpip-rl-1",
      "td1-forms-claim-codes",
      "cpp-cpp2-ei-deductions-2026",
      "payroll-remittance-due-dates",
      "payroll-sync-nexvar-pay-ledgerpro",
    ]);
  });

  it("has unique slugs", () => {
    expect(new Set(PUBLIC_GUIDE_SLUGS).size).toBe(PUBLIC_GUIDE_SLUGS.length);
  });

  it("marks province of employment as the flagship", () => {
    const flagship = getPublicGuide("province-of-employment-rules");
    expect(flagship?.priority).toBe(0.95);
    for (const guide of PUBLIC_GUIDES) {
      if (guide.slug !== flagship?.slug) expect(guide.priority).toBeLessThan(0.95);
    }
  });

  it("resolves every related slug to a real guide, never itself", () => {
    for (const guide of PUBLIC_GUIDES) {
      const related = getRelatedPublicGuides(guide);
      expect(related).toHaveLength(guide.related.length);
      expect(related.map((r) => r.slug)).not.toContain(guide.slug);
    }
  });

  it("builds canonical URLs on the Nexvar Pay domain", () => {
    expect(GUIDES_HUB_URL).toBe("https://nexvarpay.nexvarlab.com/guides");
    for (const guide of PUBLIC_GUIDES) {
      expect(getGuideUrl(guide)).toBe(`https://nexvarpay.nexvarlab.com/guides/${guide.slug}`);
    }
  });

  it("every guide carries complete search metadata and body content", () => {
    for (const guide of PUBLIC_GUIDES) {
      expect(guide.title.length).toBeGreaterThan(10);
      expect(guide.metaTitle).toContain("Nexvar Pay");
      expect(guide.description.length).toBeGreaterThan(80);
      expect(guide.intro.length).toBeGreaterThan(80);
      expect(guide.category.length).toBeGreaterThan(0);
      expect(guide.sections.length).toBeGreaterThanOrEqual(4);
      expect(guide.faq.length).toBeGreaterThanOrEqual(3);
      for (const section of guide.sections) {
        const blocks =
          (section.paragraphs?.length ?? 0) +
          (section.steps?.length ?? 0) +
          (section.table ? 1 : 0) +
          (section.notes?.length ?? 0);
        expect(blocks, `${guide.slug} / ${section.heading}`).toBeGreaterThan(0);
        if (section.table) {
          for (const row of section.table.rows) {
            expect(row).toHaveLength(section.table.headers.length);
          }
        }
      }
      for (const item of guide.faq) {
        expect(item.question.endsWith("?")).toBe(true);
        expect(item.answer.length).toBeGreaterThan(40);
      }
    }
  });

  it("states no 2027 deduction figures anywhere in the copy", () => {
    const corpus = JSON.stringify(PUBLIC_GUIDES);
    // The guides may *mention* that 2027 figures are unpublished, but must
    // not present 2027 rates/ceilings. Guard the risky pairings.
    expect(corpus).not.toMatch(/2027[^.]{0,60}(5\.95%|1\.63%|\$74,600|\$85,000|\$68,900)/);
  });
});
