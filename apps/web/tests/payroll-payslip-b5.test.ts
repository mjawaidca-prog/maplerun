/**
 * Wave 3 B5 — payslip completion.
 *
 * Covers:
 *  1. derivePeriodStart for every frequency.
 *  2. Stub data shaping (buildEarningsLines / vacationBalanceLine):
 *     itemized lines only when non-zero, hrs × rate details, and the
 *     pre-B5 fallback (no split stored → regular = gross − vacation − bonus).
 *  3. Finalize persistence through the REAL engine + mocked Prisma:
 *     the earnings split lands on the item and sums to gross, the run
 *     is stamped with periodStart, YtdLedger grossPay/incomeTax are
 *     written, an ACCRUE employee's item carries the post-run vacation
 *     balance snapshot, and an over-claimed split aborts the run.
 *  4. Stub email on finalize: opt-in only, sent per employee with an
 *     email on file, outcome logged into the item's warnings, and an
 *     email failure never fails the finalize.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { derivePeriodStart } from "@/lib/pay-period";
import { buildEarningsLines, vacationBalanceLine, parseCustomDeductions } from "@/lib/pay-stub-data";

const h = vi.hoisted(() => ({
  createdRun: null as null | Record<string, unknown>,
  createdItems: [] as Record<string, unknown>[],
  ytdUpserts: [] as Record<string, unknown>[],
  itemUpdates: [] as Record<string, unknown>[],
  emailsSent: [] as Record<string, unknown>[],
  emailShouldFail: false,
  balances: new Map<string, number>(),
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
vi.mock("@/lib/email", () => ({
  sendPayStubEmail: async (params: Record<string, unknown>) => {
    h.emailsSent.push(params);
    return h.emailShouldFail ? { success: false, error: "resend down" } : { success: true };
  },
}));

const EMPLOYEES = [
  { id: "emp_1", firstName: "Ada", lastName: "Alpha", email: "ada@example.com", payGroupId: "pg_1", vacationMode: "ACCRUE", vacationRatePct: 4, td1Profiles: [], ytdLedgers: [] },
  { id: "emp_2", firstName: "Ben", lastName: "Beta", email: null, payGroupId: null, vacationMode: "PAYOUT", vacationRatePct: null, td1Profiles: [], ytdLedgers: [] },
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
      findUnique: async ({ where }: { where: { id: string } }) => {
        const emp = EMPLOYEES.find((e) => e.id === where.id);
        return { vacationBalanceCents: h.balances.get(where.id) ?? 0, email: emp?.email ?? null };
      },
      update: async ({ where, data }: { where: { id: string }; data: { vacationBalanceCents: { increment: number } } }) => {
        if (data.vacationBalanceCents?.increment) {
          h.balances.set(where.id, (h.balances.get(where.id) ?? 0) + data.vacationBalanceCents.increment);
        }
        return {};
      },
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
      update: async ({ data }: { data: Record<string, unknown> }) => {
        h.itemUpdates.push(data);
        return {};
      },
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
  fd.set("hours", JSON.stringify({ emp_1: 80, emp_2: 75 }));
  fd.set("overtime", JSON.stringify({ emp_1: { hours: 5, amount: 300 } }));
  fd.set("stat", JSON.stringify({ emp_1: { hours: 7.5, amount: 200 } }));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  h.createdRun = null;
  h.createdItems = [];
  h.ytdUpserts = [];
  h.itemUpdates = [];
  h.emailsSent = [];
  h.emailShouldFail = false;
  h.balances.clear();
  h.company = { plan: "growth", freePayRunsUsed: 0, maxFreePayRuns: 2, trialEndsAt: null, name: "Prairie Peak", stubEmailOnFinalize: false };
});

describe("derivePeriodStart (B5)", () => {
  it("derives the period start from frequency + period end", () => {
    expect(derivePeriodStart("WEEKLY", "2026-11-13")).toBe("2026-11-07");
    expect(derivePeriodStart("BIWEEKLY", "2026-11-13")).toBe("2026-10-31");
    expect(derivePeriodStart("SEMIMONTHLY", "2026-11-15")).toBe("2026-11-01");
    expect(derivePeriodStart("SEMIMONTHLY", "2026-11-30")).toBe("2026-11-16");
    expect(derivePeriodStart("MONTHLY", "2026-11-30")).toBe("2026-11-01");
  });
});

describe("stub data shaping (B5)", () => {
  const base = {
    gross: 3000, regularPay: 2500, overtimePay: 300, statPay: 200, vacationPay: 0, bonus: 0,
    hours: 80, overtimeHours: 5, statHours: 7.5, vacationBalanceAfterCents: null as number | null,
  };

  it("renders non-zero earnings lines with hrs × rate details, summing to gross", () => {
    const lines = buildEarningsLines(base);
    expect(lines.map((l) => l.label)).toEqual(["Regular pay", "Overtime pay", "Stat holiday pay"]);
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(3000, 2);
    expect(lines[0].detail).toBe("67.5 hrs × $37.04");
    expect(lines[1].detail).toBe("5 hrs × $60.00");
  });

  it("falls back to a residual regular line for pre-B5 items (no split stored)", () => {
    const lines = buildEarningsLines({
      ...base, regularPay: 0, overtimePay: 0, statPay: 0, vacationPay: 120, bonus: 80, overtimeHours: 0, statHours: 0,
    });
    expect(lines.map((l) => l.label)).toEqual(["Regular pay", "Vacation pay", "Bonus"]);
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(3000, 2);
  });

  it("shows the vacation balance only when a snapshot exists", () => {
    expect(vacationBalanceLine(base)).toBeNull();
    expect(vacationBalanceLine({ ...base, vacationBalanceAfterCents: 12345 })).toBe("$123.45");
  });

  it("parses persisted custom deductions defensively", () => {
    expect(parseCustomDeductions([{ name: "RRSP", amount: 100 }, { name: "", amount: 5 }, null, { name: "X" }]))
      .toEqual([{ name: "RRSP", amount: 100 }]);
    expect(parseCustomDeductions(undefined)).toEqual([]);
  });
});

describe("finalize persistence (B5)", () => {
  it("persists the split, periodStart, YTD gross/tax and the vacation snapshot", async () => {
    const preview = await previewPayRun(formData());
    const pItem = preview.items.find((i) => i.employeeId === "emp_1")!;
    expect(pItem.regularPay).toBe(2500);
    expect(pItem.overtimePay).toBe(300);
    expect(pItem.statPay).toBe(200);

    await expect(finalizePayRun(formData())).rejects.toThrow("REDIRECT:/payroll");

    expect(h.createdRun!.periodStart).toBe("2026-10-31");
    const item1 = h.createdItems.find((i) => i.employeeId === "emp_1")!;
    expect(item1.regularPay).toBe(2500);
    expect(item1.overtimePay).toBe(300);
    expect(item1.statPay).toBe(200);
    expect(item1.overtimeHours).toBe(5);
    expect(item1.statHours).toBe(7.5);
    const splitSum = (item1.regularPay as number) + (item1.overtimePay as number) + (item1.statPay as number) + (item1.vacationPay as number) + (item1.bonus as number);
    expect(Math.abs(splitSum - (item1.gross as number))).toBeLessThanOrEqual(0.01);
    // ACCRUE at 4% on $3,000 → +12,000¢ snapshot.
    expect(item1.vacationBalanceAfterCents).toBe(12000);
    const item2 = h.createdItems.find((i) => i.employeeId === "emp_2")!;
    expect(item2.vacationBalanceAfterCents).toBeNull();

    const upsert1 = h.ytdUpserts.find((u) => (u.where as { employeeId_year: { employeeId: string } }).employeeId_year.employeeId === "emp_1")!;
    const create1 = upsert1.create as Record<string, unknown>;
    expect(create1.grossPay).toBeCloseTo(item1.gross as number, 2);
    expect(create1.incomeTax).toBeCloseTo((item1.federalTax as number) + (item1.provincialTax as number), 2);
    const update1 = upsert1.update as Record<string, { increment: number }>;
    expect(update1.grossPay.increment).toBeCloseTo(item1.gross as number, 2);
  });

  it("aborts when the split exceeds gross", async () => {
    const fd = formData({ overtime: JSON.stringify({ emp_1: { hours: 5, amount: 99999 } }) });
    await expect(previewPayRun(fd)).rejects.toThrow(/exceeds their gross pay/);
  });

  it("sends stub emails only when the company opted in, logging outcomes to warnings", async () => {
    // Opt-in OFF: nothing sent.
    await expect(finalizePayRun(formData())).rejects.toThrow("REDIRECT:/payroll");
    expect(h.emailsSent).toHaveLength(0);

    // Opt-in ON: emp_1 has an email, emp_2 does not.
    h.company = { ...h.company, stubEmailOnFinalize: true };
    h.createdItems = [];
    await expect(finalizePayRun(formData())).rejects.toThrow("REDIRECT:/payroll");
    expect(h.emailsSent).toHaveLength(1);
    expect(h.emailsSent[0].to).toBe("ada@example.com");
    expect(h.emailsSent[0].stubUrl).toContain("/portal");
    const warnings = h.itemUpdates.map((u) => u.warnings as string);
    expect(warnings.some((w) => w.includes("Pay stub email sent."))).toBe(true);
    expect(warnings.some((w) => w.includes("skipped — no email address"))).toBe(true);
  });

  it("an email failure never fails the finalize", async () => {
    h.company = { ...h.company, stubEmailOnFinalize: true };
    h.emailShouldFail = true;
    await expect(finalizePayRun(formData())).rejects.toThrow("REDIRECT:/payroll");
    expect(h.createdRun).not.toBeNull();
    const warnings = h.itemUpdates.map((u) => u.warnings as string);
    expect(warnings.some((w) => w.includes("Pay stub email failed"))).toBe(true);
  });
});
