/**
 * Wave 1 PR B — pay-group scoping rule for previewPayRun.
 *
 * The rule (documented in lib/actions/payroll.ts): employees assigned to
 * the selected pay group are in scope; employees assigned to a different
 * group are excluded (enforced by the Prisma `where`); unassigned
 * employees (payGroupId NULL — all pre-Wave-1 employees) stay in scope
 * for every group until assigned.
 *
 * Prisma/session/engine are mocked; the engine stub is deterministic so
 * the preview composition can be asserted exactly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  findManyWhere: null as null | Record<string, unknown>,
}));

vi.mock("@/lib/session", () => ({
  requireCompany: async () => ({ id: "user_1", email: "a@b.c", companyId: "co_1" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/ledgerpro-sync", () => ({ syncPayRun: async () => {}, voidPayRunSync: async () => ({ outcome: "voided" }) }));
vi.mock("@/lib/ledgerpro-store", () => ({ ledgerProSyncDeps: {} }));

vi.mock("@maplerun/tax-engine", () => ({
  ZERO_YTD: { pensionableEarnings: 0, cpp: 0, cpp2: 0, insurableEarnings: 0, ei: 0 },
  calculatePay: (input: { grossPeriodIncome: number }) => {
    const gross = input.grossPeriodIncome;
    return {
      gross,
      cpp: 10,
      cpp2: 0,
      ei: 5,
      qpip: 0,
      federalTax: 20,
      provincialTax: 10,
      totalDeductions: 45,
      netPay: gross - 45,
      annualTaxableIncome: gross * 26,
      employer: { cpp: 10, cpp2: 0, ei: 7, total: 17 },
      newYtd: { pensionableEarnings: gross, cpp: 10, cpp2: 0, insurableEarnings: gross, ei: 5 },
      warnings: [],
    };
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payGroup: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === "pg_1"
          ? { id: "pg_1", companyId: "co_1", name: "Biweekly Staff", frequency: "BIWEEKLY", defaultProvince: "ON" }
          : null,
    },
    employee: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        h.findManyWhere = args.where;
        return [
          { id: "e_assigned", firstName: "Ann", lastName: "Assigned", payGroupId: "pg_1", td1Profiles: [], ytdLedgers: [] },
          { id: "e_unassigned", firstName: "Uma", lastName: "Unassigned", payGroupId: null, td1Profiles: [], ytdLedgers: [] },
        ];
      },
    },
  },
}));

import { previewPayRun } from "@/lib/actions/payroll";

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  h.findManyWhere = null;
});

describe("previewPayRun pay-group scoping (Wave 1 PR B)", () => {
  it("scopes the employee query to the selected group plus unassigned employees", async () => {
    const preview = await previewPayRun(
      formData({
        payGroupId: "pg_1",
        payDate: "2026-11-15",
        grossAmounts: JSON.stringify({ e_assigned: 1000, e_unassigned: 2000 }),
      }),
    );

    // The where clause IS the rule: assigned-to-group OR unassigned.
    expect(h.findManyWhere).toMatchObject({
      companyId: "co_1",
      active: true,
      OR: [{ payGroupId: "pg_1" }, { payGroupId: null }],
    });

    // Both in-scope employees are calculated; totals add up.
    expect(preview.items.map((i) => i.employeeId).sort()).toEqual(["e_assigned", "e_unassigned"]);
    expect(preview.totals.gross).toBe(3000);
    expect(preview.totals.netPay).toBe(3000 - 90);
  });

  it("rejects a pay group from another company", async () => {
    await expect(
      previewPayRun(
        formData({ payGroupId: "pg_other", payDate: "2026-11-15", grossAmounts: "{}" }),
      ),
    ).rejects.toThrow("Invalid pay group.");
  });
});
