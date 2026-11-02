/**
 * Wave 3 B5 — reversal coverage for the new YtdLedger fields.
 *
 * Finding (read of Wave 1 PR #11's reversePayRun): the five engine YTD
 * fields roll back by snapshot deltas, but grossPay/incomeTax are
 * INCREMENTED at finalize by each item's own gross and federal +
 * provincial tax — there is no item snapshot to diff. reversePayRun
 * was therefore EXTENDED to decrement them by exactly those per-item
 * amounts, gated on the run-level B5 marker (PayRun.periodStart is
 * always stamped by B5 finalize and null on pre-B5 runs).
 *
 * This suite seeds a B5-era run and a pre-B5 run and proves:
 *  - reversing the B5 run removes exactly its gross/tax increments;
 *  - reversing the pre-B5 run leaves grossPay/incomeTax untouched
 *    (its finalize never wrote them).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Run = {
  id: string; companyId: string; payGroupId: string; payDate: string; status: string;
  periodStart: string | null;
  createdAt: Date; finalizedAt: Date | null; reversedAt: Date | null;
};
type Item = {
  id: string; payRunId: string; employeeId: string;
  gross: number; federalTax: number; provincialTax: number;
  ytdPensionable: number; ytdCpp: number; ytdCpp2: number; ytdInsurable: number; ytdEi: number;
  vacationAccruedCents: number;
};
type Ledger = {
  pensionableEarnings: number; cpp: number; cpp2: number; insurableEarnings: number; ei: number;
  grossPay: number; incomeTax: number;
};

const h = vi.hoisted(() => ({
  runs: new Map<string, Run>(),
  items: [] as Item[],
  ledgers: new Map<string, Ledger>(),
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payRun: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const run = h.runs.get(where.id);
        if (!run) return null;
        return { ...run, items: h.items.filter((i) => i.payRunId === run.id) };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Run> }) => {
        const run = h.runs.get(where.id)!;
        Object.assign(run, data);
        return run;
      },
    },
    payRunItem: {
      // Same predecessor emulation as the Wave 1 PR D suite: previous
      // FINALIZED item for the employee inside the OR time window.
      findFirst: async ({ where }: {
        where: {
          employeeId: string;
          payRunId: { not: string };
          payRun: { OR: [{ finalizedAt: { lt: Date } }, { finalizedAt: Date; createdAt: { lt: Date } }] };
        };
      }) => {
        const [ltClause, eqClause] = where.payRun.OR;
        const lt = ltClause.finalizedAt.lt.getTime();
        const eq = eqClause.finalizedAt.getTime();
        const createdLt = eqClause.createdAt.lt.getTime();
        const candidates = h.items
          .filter((i) => i.employeeId === where.employeeId && i.payRunId !== where.payRunId.not)
          .map((i) => ({ item: i, run: h.runs.get(i.payRunId)! }))
          .filter(({ run }) => run && run.status === "FINALIZED")
          .filter(({ run }) =>
            run.finalizedAt!.getTime() < lt ||
            (run.finalizedAt!.getTime() === eq && run.createdAt.getTime() < createdLt),
          )
          .sort((a, b) =>
            (b.run.finalizedAt!.getTime() - a.run.finalizedAt!.getTime()) ||
            (b.run.createdAt.getTime() - a.run.createdAt.getTime()),
          );
        return candidates[0]?.item ?? null;
      },
    },
    ytdLedger: {
      findUnique: async ({ where }: { where: { employeeId_year: { employeeId: string; year: number } } }) =>
        h.ledgers.get(where.employeeId_year.employeeId) ?? null,
      update: async ({ where, data }: { where: { employeeId_year: { employeeId: string; year: number } }; data: Partial<Ledger> }) => {
        // Prisma update merges — fields absent from `data` keep their values.
        const existing = h.ledgers.get(where.employeeId_year.employeeId)!;
        h.ledgers.set(where.employeeId_year.employeeId, { ...existing, ...data });
        return data;
      },
    },
    employee: { update: async () => ({}) },
    ledgerProSyncRecord: { findUnique: async () => null },
  },
}));

import { reversePayRun } from "@/lib/actions/payroll";

const T1 = new Date("2026-10-30T12:00:00Z");
const T2 = new Date("2026-11-13T12:00:00Z");

function seed() {
  h.runs.clear();
  h.items = [];
  h.ledgers.clear();

  // run_old: pre-B5 (periodStart null), gross 2000, tax 300 + 120.
  h.runs.set("run_old", { id: "run_old", companyId: "co_1", payGroupId: "pg_1", payDate: "2026-10-30", status: "FINALIZED", periodStart: null, createdAt: T1, finalizedAt: T1, reversedAt: null });
  // run_b5: B5-era (periodStart stamped), gross 3000, tax 450 + 180.
  h.runs.set("run_b5", { id: "run_b5", companyId: "co_1", payGroupId: "pg_1", payDate: "2026-11-13", status: "FINALIZED", periodStart: "2026-10-31", createdAt: T2, finalizedAt: T2, reversedAt: null });
  h.items = [
    { id: "it_old", payRunId: "run_old", employeeId: "emp_1", gross: 2000, federalTax: 300, provincialTax: 120, ytdPensionable: 2000, ytdCpp: 100, ytdCpp2: 0, ytdInsurable: 2000, ytdEi: 30, vacationAccruedCents: 0 },
    { id: "it_b5", payRunId: "run_b5", employeeId: "emp_1", gross: 3000, federalTax: 450, provincialTax: 180, ytdPensionable: 5000, ytdCpp: 250, ytdCpp2: 0, ytdInsurable: 5000, ytdEi: 75, vacationAccruedCents: 0 },
  ];
  // Ledger state after both runs: the snapshot fields reflect both
  // runs, but grossPay/incomeTax were only ever incremented by the
  // B5 run's finalize (3000 / 630).
  h.ledgers.set("emp_1", { pensionableEarnings: 5000, cpp: 250, cpp2: 0, insurableEarnings: 5000, ei: 75, grossPay: 3000, incomeTax: 630 });
}

function fd(id: string): FormData {
  const f = new FormData();
  f.set("id", id);
  return f;
}

beforeEach(seed);

describe("reversePayRun — B5 grossPay/incomeTax rollback", () => {
  it("reversing the B5 run removes exactly its gross/tax increments", async () => {
    await reversePayRun(fd("run_b5"));
    const ledger = h.ledgers.get("emp_1")!;
    expect(ledger.grossPay).toBe(0);
    expect(ledger.incomeTax).toBe(0);
    expect(ledger.pensionableEarnings).toBe(2000);
  });

  it("reversing the pre-B5 run leaves grossPay/incomeTax untouched", async () => {
    await reversePayRun(fd("run_old"));
    const ledger = h.ledgers.get("emp_1")!;
    expect(ledger.grossPay).toBe(3000);
    expect(ledger.incomeTax).toBe(630);
  });
});
