/**
 * Wave 1 PR E — vacation accrual wiring through the real finalize path.
 *
 * Mocked Prisma + REAL tax engine (same harness shape as the PR C
 * recompute suite). An ACCRUE employee at 4% on $5,000 gross:
 *  - with no wizard payout, finalize adds exactly 20,000¢ to the
 *    balance and records the net delta on the item;
 *  - with a $100 wizard payout drawn from the balance, the net delta
 *    is +10,000¢ (accrual 20,000 − payout 10,000);
 *  - a PAYOUT employee's balance is never touched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  balances: new Map<string, number>(),
  createdItems: [] as Record<string, unknown>[],
  employeeUpdates: [] as { id: string; data: Record<string, unknown> }[],
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

const EMPLOYEES = [
  { id: "emp_acc", firstName: "Ana", lastName: "Accrue", province: "ON", payGroupId: null, vacationMode: "ACCRUE", vacationRatePct: 4, td1Profiles: [], ytdLedgers: [] },
  { id: "emp_pay", firstName: "Paul", lastName: "Payout", province: "ON", payGroupId: null, vacationMode: "PAYOUT", vacationRatePct: 4, td1Profiles: [], ytdLedgers: [] },
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
      findUnique: async ({ where }: { where: { id: string } }) => ({
        vacationBalanceCents: h.balances.get(where.id) ?? 0,
      }),
      update: async ({ where, data }: { where: { id: string }; data: { vacationBalanceCents: { increment: number } } }) => {
        h.employeeUpdates.push({ id: where.id, data });
        h.balances.set(where.id, (h.balances.get(where.id) ?? 0) + data.vacationBalanceCents.increment);
        return {};
      },
    },
    company: {
      findUnique: async () => ({ plan: "growth", freePayRunsUsed: 0, maxFreePayRuns: 2, trialEndsAt: null }),
      update: async () => ({}),
    },
    payRun: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "run_vac", ...data }),
    },
    payRunItem: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        h.createdItems.push(data);
        return data;
      },
    },
    ytdLedger: { upsert: async () => ({}) },
    ledgerProSyncRecord: { findUnique: async () => null },
  },
}));

import { finalizePayRun } from "@/lib/actions/payroll";

function finalizeForm(vacation?: Record<string, { enabled: boolean; rate: number; amount: number }>): FormData {
  const fd = new FormData();
  fd.set("payGroupId", "pg_1");
  fd.set("payDate", "2026-11-27");
  fd.set("grossAmounts", JSON.stringify({ emp_acc: 5000, emp_pay: 5000 }));
  if (vacation) fd.set("vacation", JSON.stringify(vacation));
  return fd;
}

beforeEach(() => {
  h.balances.clear();
  h.createdItems = [];
  h.employeeUpdates = [];
});

describe("vacation accrual on finalize (Wave 1 PR E)", () => {
  it("accrues rate% of gross to the ACCRUE balance and records the net delta on the item", async () => {
    await expect(finalizePayRun(finalizeForm())).rejects.toThrow("REDIRECT:/payroll");
    expect(h.balances.get("emp_acc")).toBe(20000);
    const accItem = h.createdItems.find((i) => i.employeeId === "emp_acc");
    expect(accItem?.vacationAccruedCents).toBe(20000);
  });

  it("draws a wizard payout from the balance: net delta = accrual − payout", async () => {
    await expect(
      finalizePayRun(finalizeForm({ emp_acc: { enabled: true, rate: 4, amount: 100 } })),
    ).rejects.toThrow("REDIRECT:/payroll");
    expect(h.balances.get("emp_acc")).toBe(10000);
    const accItem = h.createdItems.find((i) => i.employeeId === "emp_acc");
    expect(accItem?.vacationAccruedCents).toBe(10000);
    expect(accItem?.vacationPay).toBe(100);
  });

  it("never touches a PAYOUT employee's balance", async () => {
    await expect(
      finalizePayRun(finalizeForm({ emp_pay: { enabled: true, rate: 4, amount: 200 } })),
    ).rejects.toThrow("REDIRECT:/payroll");
    expect(h.balances.has("emp_pay")).toBe(false);
    expect(h.employeeUpdates.filter((u) => u.id === "emp_pay")).toHaveLength(0);
    const payItem = h.createdItems.find((i) => i.employeeId === "emp_pay");
    expect(payItem?.vacationAccruedCents).toBe(0);
    expect(payItem?.vacationPay).toBe(200);
  });
});
