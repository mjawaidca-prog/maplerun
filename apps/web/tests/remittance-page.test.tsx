// @vitest-environment jsdom
/**
 * W4-D11 — Remittance Report page: period selection is real.
 *
 * Renders the actual page component with prisma/session mocked and the
 * clock pinned to 2026-11-02 (current period 2026-11). Fixtures are the
 * Prairie Peak proof figures: a September 2026 Quebec run (Sophie
 * Tremblay — QPP 284.03, QPIP 20.64/28.90, Québec tax 432.95) plus an
 * Alberta run (Dana Whitfield), and NO November runs. Before the fix
 * the page could only ever show the current period, so September's
 * Revenu Québec section was unreachable once September ended.
 *
 * September expectations (shared aggregation over both runs):
 *   CRA total  $3386.61   RQ total  $1050.55
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const h = vi.hoisted(() => ({
  payRuns: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/session", () => ({
  requireCompany: async () => ({ id: "user_1", email: "a@b.c", companyId: "co_1" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children?: React.ReactNode }) => (
    <a href={props.href} className={props.className}>{props.children}</a>
  ),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payRun: { findMany: async () => h.payRuns },
    company: { findUnique: async () => ({ remitterType: null }) },
    remittanceSubmission: { findMany: async () => [] },
  },
}));

import RemittancePage from "@/app/(app)/reports/remittance/page";

function sophieRun() {
  return {
    id: "run_qc_sep",
    payDate: "2026-09-30",
    totalGross: 4800, totalCpp: 284.03, totalCpp2: 0, totalEi: 62.4,
    totalFederalTax: 343.32, totalProvincialTax: 432.95,
    totalEmployerCpp: 284.03, totalEmployerCpp2: 0, totalEmployerEi: 116.26,
    payGroup: { name: "Monthly — Quebec (test fixture)", defaultProvince: "QC" },
    items: [{
      employeeId: "emp_sophie", gross: 4800, cpp: 284.03, cpp2: 0, ei: 62.4,
      federalTax: 343.32, provincialTax: 432.95,
      employerCpp: 284.03, employerCpp2: 0, employerEi: 116.26,
      qpp: 284.03, qpp2: 0, qpip: 20.64,
      employee: { firstName: "Sophie", lastName: "Tremblay", provinceOfEmployment: "QC" },
    }],
  };
}

function danaRun() {
  return {
    id: "run_ab_sep",
    payDate: "2026-09-30",
    totalGross: 6000, totalCpp: 339.65, totalCpp2: 0, totalEi: 97.8,
    totalFederalTax: 639.19, totalProvincialTax: 310.41,
    totalEmployerCpp: 339.65, totalEmployerCpp2: 0, totalEmployerEi: 136.92,
    payGroup: { name: "Monthly — Core Crew", defaultProvince: "AB" },
    items: [{
      employeeId: "emp_dana", gross: 6000, cpp: 339.65, cpp2: 0, ei: 97.8,
      federalTax: 639.19, provincialTax: 310.41,
      employerCpp: 339.65, employerCpp2: 0, employerEi: 136.92,
      qpp: 0, qpp2: 0, qpip: 0,
      employee: { firstName: "Dana", lastName: "Whitfield", provinceOfEmployment: "AB" },
    }],
  };
}

async function renderPage(params: { tab?: string; period?: string }) {
  const ui = await RemittancePage({ searchParams: Promise.resolve(params) });
  return render(ui);
}

describe("RemittancePage period selection (W4-D11)", () => {
  beforeEach(() => {
    h.payRuns = [sophieRun(), danaRun()];
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 2, 12, 0, 0)); // current period 2026-11
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("(c) no period param: current period, unchanged — November figures, no RQ section", async () => {
    await renderPage({});
    expect(document.body.textContent).toContain("Current period — November 2026");
    expect(document.body.textContent).toContain("$0.00");
    // The breakdown footer is scoped to November (the "Year to date:
    // $3386.61" reference line on the lead card is pre-existing FLAG A
    // behaviour, so absence is asserted on the scope-bound strings).
    expect(document.body.textContent).toContain("Total remittance to CRA — 2026-11");
    expect(document.body.textContent).not.toContain("Revenu Québec");
  });

  it("(a) period=2026-09 renders September's figures, including the Revenu Québec section", async () => {
    await renderPage({ period: "2026-09" });
    expect(document.body.textContent).toContain("September 2026 (2026-09)");
    expect(document.body.textContent).toContain("$3386.61"); // September CRA total
    expect(document.body.textContent).toContain("Revenu Québec — September 2026");
    expect(document.body.textContent).toContain("$1050.55"); // RQ total: QPP + QPIP + Québec tax
    expect(document.body.textContent).toContain("Total remittance to Revenu Québec — 2026-09");
    // Period scope keeps the submission actions.
    expect(screen.getByText("Mark as submitted")).toBeTruthy();
  });

  it("(a) the by-employee panel follows the selected period", async () => {
    await renderPage({ tab: "employees", period: "2026-09" });
    expect(document.body.textContent).toContain("Sophie Tremblay");
    expect(document.body.textContent).toContain("Dana Whitfield");
    cleanup();
    await renderPage({ tab: "employees" });
    expect(document.body.textContent).toContain("No pay runs finalized for this period.");
    expect(document.body.textContent).not.toContain("Sophie Tremblay");
  });

  it("(b) the selector offers exactly the run periods plus current and YTD, as URL links", async () => {
    await renderPage({ period: "2026-09" });
    expect(screen.getByRole("link", { name: "September 2026" }).getAttribute("href"))
      .toBe("/reports/remittance?period=2026-09");
    expect(screen.getByRole("link", { name: "November 2026 (current)" }).getAttribute("href"))
      .toBe("/reports/remittance");
    expect(screen.getByRole("link", { name: "Year to date" }).getAttribute("href"))
      .toBe("/reports/remittance?period=ytd");
    // October has no finalized runs and is not current — not offered.
    expect(screen.queryByRole("link", { name: /October 2026/ })).toBeNull();
    // No decorative controls remain on the filter bar.
    expect(screen.queryByText("All types")).toBeNull();
    expect(screen.queryByText("All staff")).toBeNull();
    expect(screen.queryByText("Apply")).toBeNull();
    expect(screen.queryByText("Custom")).toBeNull();
  });

  it("period=ytd renders the year-to-date scope: RQ section shown, clearly labelled, no period actions", async () => {
    await renderPage({ period: "ytd" });
    expect(document.body.textContent).toContain("Year to date");
    expect(document.body.textContent).toContain("Revenu Québec — Year to date");
    expect(document.body.textContent).toContain("$1050.55");
    expect(document.body.textContent).toContain("$3386.61"); // YTD total (all runs are September's)
    // A YTD scope has no single due date / submission — actions are absent.
    expect(screen.queryByText("Mark as submitted")).toBeNull();
  });

  it("the history tab highlights the selected period's row", async () => {
    await renderPage({ tab: "history", period: "2026-09" });
    const marker = screen.getByText("Viewing");
    const row = marker.closest("tr");
    expect(row?.textContent).toContain("2026-09");
    expect(row?.textContent).toContain("$3386.61");
  });

  it("an invalid period param falls back to the current period", async () => {
    await renderPage({ period: "2026-13" });
    expect(document.body.textContent).toContain("Current period — November 2026");
    expect(document.body.textContent).toContain("Total remittance to CRA — 2026-11");
    expect(document.body.textContent).not.toContain("Revenu Québec");
  });
});
