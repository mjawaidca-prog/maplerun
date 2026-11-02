/**
 * Wave 3 B6 — earnings/deduction breadth wiring.
 *
 * Real tax engine + mocked Prisma (same harness shape as B5/PR C):
 *  1. Bonus goes through calculateBonus (T4127 lump-sum), not lumped
 *     into gross: the persisted item equals regular calculatePay +
 *     calculateBonus merged, and `bonus` is recorded on the item.
 *  2. Custom deductions are persisted as JSON, withheld from net pay,
 *     and included in the item's totalDeductions.
 *  3. Reimbursements are added to net pay only — gross and statutory
 *     deductions identical to the same run without one.
 *  4. Taxable benefits widen the CPP base (persisted on the item)
 *     without touching gross.
 *  5. TD1 extraTaxPerPeriod is applied (+$25 federal tax exactly).
 *  6. Province of employment resolves per employee (AB employee in an
 *     ON pay group is taxed as AB).
 *  7. The LedgerPro journal balances with a reimbursement + custom
 *     deductions present, on distinct lines (never in the wages line).
 *  8. Bad breadth inputs are rejected server-side.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculatePay, calculateBonus, ZERO_YTD } from "@maplerun/tax-engine";
import { buildJournalPayload, DEFAULT_MAPPING, type PayRunTotals } from "@/lib/ledgerpro-journal";

const h = vi.hoisted(() => ({
  createdRun: null as null | Record<string, unknown>,
  createdItems: [] as Record<string, unknown>[],
  ytdUpserts: [] as Record<string, unknown>[],
  company: {
    plan: "growth",
    freePayRunsUsed: 0,
    maxFreePayRuns: 2,
    trialEndsAt: null as Date | null,
    name: "Prairie Peak",
    stubEmailOnFinalize: false,
  },
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
vi.mock("@/lib/email", () => ({ sendPayStubEmail: async () => ({ success: true }) }));

const EMPLOYEES = [
  {
    id: "emp_1", firstName: "Ada", lastName: "Alpha", email: null, payGroupId: "pg_1",
    provinceOfEmployment: null, vacationMode: "PAYOUT", vacationRatePct: null,
    td1Profiles: [{ federalClaim: null, provincialClaim: null, extraTaxPerPeriod: 25, cppExempt: false, eiExempt: false }],
    ytdLedgers: [],
  },
  {
    id: "emp_2", firstName: "Ben", lastName: "Beta", email: null, payGroupId: null,
    provinceOfEmployment: "AB", vacationMode: "PAYOUT", vacationRatePct: null,
    td1Profiles: [], ytdLedgers: [],
  },
];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payGroup: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === "pg_1"
          ? { id: "pg_1", companyId: "co_1", name: "Biweekly Staff", frequency: "BIWEEKLY", defaultProvince: "ON" }
          : null,
    },
    employee: {
      findMany: async () => EMPLOYEES,
      findUnique: async () => ({ vacationBalanceCents: 0, email: null }),
      update: async () => ({}),
    },
    company: {
      findUnique: async () => h.company,
      update: async () => ({}),
    },
    payRun: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        h.createdRun = data;
        return { id: "run_1", ...data };
      },
    },
    payRunItem: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        h.createdItems.push(data);
        return { id: `item_${data.employeeId as string}`, ...data };
      },
      update: async () => ({}),
    },
    ytdLedger: {
      upsert: async (args: Record<string, unknown>) => {
        h.ytdUpserts.push(args);
        return {};
      },
    },
  },
}));

import { previewPayRun, finalizePayRun } from "@/lib/actions/payroll";

function formData(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("payGroupId", "pg_1");
  fd.set("payDate", "2026-11-13");
  fd.set("grossAmounts", JSON.stringify({ emp_1: 3000, emp_2: 2000 }));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  h.createdRun = null;
  h.createdItems = [];
  h.ytdUpserts = [];
});

describe("B6 breadth wiring", () => {
  it("bonus is taxed via calculateBonus and merged — not lumped into gross", async () => {
    const fd = formData({ bonus: JSON.stringify({ emp_1: 5000 }) });
    const preview = await previewPayRun(fd);
    const item = preview.items.find((i) => i.employeeId === "emp_1")!;

    // Expected: regular calculatePay on $3,000 (+ TD1 extra tax $25)
    // merged with calculateBonus on $5,000.
    const regular = calculatePay({
      payDate: "2026-11-13", province: "ON", frequency: "biweekly", grossPeriodIncome: 3000,
      extraTaxPerPeriod: 25, ytd: { ...ZERO_YTD },
    });
    const bonus = calculateBonus({
      payDate: "2026-11-13", province: "ON", frequency: "biweekly", grossPeriodIncome: 3000,
      extraTaxPerPeriod: 25, bonusAmount: 5000, ytd: { ...ZERO_YTD },
    });
    expect(item.result.gross).toBeCloseTo(8000, 2);
    expect(item.result.cpp).toBeCloseTo(regular.cpp + bonus.bonusCpp, 2);
    expect(item.result.ei).toBeCloseTo(regular.ei + bonus.bonusEi, 2);
    expect(item.result.federalTax).toBeCloseTo(regular.federalTax + bonus.bonusFederalTax, 2);
    expect(item.result.netPay).toBeCloseTo(regular.netPay + bonus.netBonus, 2);
    expect(item.bonus).toBe(5000);

    await expect(finalizePayRun(fd)).rejects.toThrow("REDIRECT:/payroll");
    const persisted = h.createdItems.find((i) => i.employeeId === "emp_1")!;
    expect(persisted.bonus).toBe(5000);
    expect(persisted.gross).toBeCloseTo(8000, 2);
    expect(persisted.cpp).toBeCloseTo(regular.cpp + bonus.bonusCpp, 2);
  });

  it("TD1 extra tax is applied: exactly +$25 federal tax vs the same employee without it", async () => {
    const preview = await previewPayRun(formData());
    const item = preview.items.find((i) => i.employeeId === "emp_1")!;
    const without = calculatePay({
      payDate: "2026-11-13", province: "ON", frequency: "biweekly", grossPeriodIncome: 3000, ytd: { ...ZERO_YTD },
    });
    expect(item.result.federalTax - without.federalTax).toBeCloseTo(25, 2);
  });

  it("per-employee province of employment: AB employee in an ON group is taxed as AB", async () => {
    const preview = await previewPayRun(formData());
    expect(preview.province).toBe("ON");
    const item = preview.items.find((i) => i.employeeId === "emp_2")!;
    expect(item.province).toBe("AB");
    const expectedAB = calculatePay({
      payDate: "2026-11-13", province: "AB", frequency: "biweekly", grossPeriodIncome: 2000, ytd: { ...ZERO_YTD },
    });
    expect(item.result.federalTax).toBeCloseTo(expectedAB.federalTax, 2);
    expect(item.result.provincialTax).toBeCloseTo(expectedAB.provincialTax, 2);
  });

  it("custom deductions persist as JSON, are withheld from net, and count in totalDeductions", async () => {
    const deductions = [{ name: "RRSP", amount: 200, reducesTaxable: true, reducesPensionable: false, reducesInsurable: false }];
    const fd = formData({ customDeductions: JSON.stringify({ emp_1: deductions }) });
    const preview = await previewPayRun(fd);
    const item = preview.items.find((i) => i.employeeId === "emp_1")!;
    expect(item.customDeductionsTotal).toBe(200);
    expect(item.totalDeductions).toBeCloseTo(item.result.totalDeductions + 200, 2);
    expect(item.netPay).toBeCloseTo(item.result.netPay - 200, 2);
    // reducesTaxable actually lowered the tax vs no deduction.
    const plain = await previewPayRun(formData());
    const plainItem = plain.items.find((i) => i.employeeId === "emp_1")!;
    expect(item.result.federalTax).toBeLessThan(plainItem.result.federalTax);

    await expect(finalizePayRun(fd)).rejects.toThrow("REDIRECT:/payroll");
    const persisted = h.createdItems.find((i) => i.employeeId === "emp_1")!;
    expect(persisted.customDeductions).toEqual(deductions);
    expect(persisted.totalDeductions).toBeCloseTo(item.totalDeductions, 2);
    expect(persisted.netPay).toBeCloseTo(item.netPay, 2);
  });

  it("reimbursement adds to net pay only — gross and deductions unchanged", async () => {
    const plain = await previewPayRun(formData());
    const withReimb = await previewPayRun(formData({ reimbursements: JSON.stringify({ emp_1: 150 }) }));
    const a = plain.items.find((i) => i.employeeId === "emp_1")!;
    const b = withReimb.items.find((i) => i.employeeId === "emp_1")!;
    expect(b.result.gross).toBeCloseTo(a.result.gross, 2);
    expect(b.result.totalDeductions).toBeCloseTo(a.result.totalDeductions, 2);
    expect(b.result.cpp).toBeCloseTo(a.result.cpp, 2);
    expect(b.netPay - a.netPay).toBeCloseTo(150, 2);
    expect(b.reimbursement).toBe(150);
  });

  it("taxable benefits widen the CPP base and persist, without touching gross", async () => {
    const plain = await previewPayRun(formData());
    const withBenefits = await previewPayRun(formData({ taxableBenefits: JSON.stringify({ emp_1: 200 }) }));
    const a = plain.items.find((i) => i.employeeId === "emp_1")!;
    const b = withBenefits.items.find((i) => i.employeeId === "emp_1")!;
    expect(b.result.gross).toBeCloseTo(a.result.gross, 2);
    expect(b.result.cpp - a.result.cpp).toBeCloseTo(0.0595 * 200, 2);
    expect(b.taxableBenefits).toBe(200);

    await expect(finalizePayRun(formData({ taxableBenefits: JSON.stringify({ emp_1: 200 }) }))).rejects.toThrow("REDIRECT:/payroll");
    const persisted = h.createdItems.find((i) => i.employeeId === "emp_1")!;
    expect(persisted.taxableBenefits).toBe(200);
    expect(persisted.reimbursement).toBe(0);
  });

  it("rejects invalid breadth inputs server-side", async () => {
    await expect(previewPayRun(formData({ reimbursements: JSON.stringify({ emp_1: -5 }) }))).rejects.toThrow(/non-negative/);
    await expect(
      previewPayRun(formData({ customDeductions: JSON.stringify({ emp_1: [{ name: "", amount: 10, reducesTaxable: true, reducesPensionable: false, reducesInsurable: false }] }) })),
    ).rejects.toThrow(/needs a name/);
  });
});

describe("LedgerPro journal invariant (B6)", () => {
  const run: PayRunTotals = {
    id: "run_b6_test",
    payDate: "2026-11-13",
    actualPayDate: "2026-11-15",
    itemCount: 1,
    totalGross: 3000,
    totalCpp: 160,
    totalCpp2: 0,
    totalEi: 45,
    totalFederalTax: 300,
    totalProvincialTax: 150,
    // net = gross − statutory(655) − custom(200) + reimbursement(150)
    totalNetPay: 2295,
    totalEmployerCpp: 160,
    totalEmployerCpp2: 0,
    totalEmployerEi: 63,
    totalEmployerCost: 223,
    totalReimbursement: 150,
    totalCustomDeductions: 200,
  };

  it("balances in both modes with distinct reimbursement / custom-deduction lines", () => {
    for (const mode of ["MODE1", "MODE2"] as const) {
      const payload = buildJournalPayload(run, "Biweekly Staff", mode, DEFAULT_MAPPING);
      const debits = payload.lines.reduce((s, l) => s + l.debit, 0);
      const credits = payload.lines.reduce((s, l) => s + l.credit, 0);
      expect(debits).toBeCloseTo(credits, 2);
      const reimbLine = payload.lines.find((l) => l.description!.includes("reimbursements"));
      expect(reimbLine?.debit).toBe(150);
      const customLine = payload.lines.find((l) => l.description!.includes("Custom deductions payable"));
      expect(customLine?.credit).toBe(200);
      // The wages line must NOT contain the reimbursement.
      const wagesLine = payload.lines.find((l) => l.description === "Wages & salaries");
      if (mode === "MODE2") expect(wagesLine?.debit).toBe(3000);
    }
  });

  it("omits both lines entirely when the amounts are zero (pre-B6 shape)", () => {
    const payload = buildJournalPayload(
      { ...run, totalReimbursement: 0, totalCustomDeductions: 0, totalNetPay: 2345 },
      "Biweekly Staff",
      "MODE2",
      DEFAULT_MAPPING,
    );
    expect(payload.lines.some((l) => l.description!.includes("reimbursements"))).toBe(false);
    expect(payload.lines.some((l) => l.description!.includes("Custom deductions"))).toBe(false);
  });
});
