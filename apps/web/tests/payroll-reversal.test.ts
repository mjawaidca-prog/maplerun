/**
 * Wave 1 PR D — reversePayRun YTD rollback exactness.
 *
 * Stateful in-memory Prisma fake. Seeds the exact state finalizePayRun
 * would have written for two consecutive runs (item YTD-after snapshots
 * + the employee ledger equal to the last snapshot), then proves:
 *  - reversing the latest run restores the ledger to the first run's
 *    snapshot EXACTLY, and unwinds the run's vacation accrual;
 *  - reversing the remaining run returns the ledger to zero;
 *  - a reversed run cannot be reversed again, but can be deleted.
 *
 * The fake's payRunItem.findFirst implements the action's predecessor
 * selection (previous finalized item in finalization order) over the
 * fake store, interpreting the same OR window the action passes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Run = {
  id: string; companyId: string; payGroupId: string; payDate: string; status: string;
  createdAt: Date; finalizedAt: Date | null; reversedAt: Date | null;
};
type Item = {
  id: string; payRunId: string; employeeId: string;
  ytdPensionable: number; ytdCpp: number; ytdCpp2: number; ytdInsurable: number; ytdEi: number;
  vacationAccruedCents: number;
};
type Ledger = { pensionableEarnings: number; cpp: number; cpp2: number; insurableEarnings: number; ei: number };

const h = vi.hoisted(() => ({
  runs: new Map<string, Run>(),
  items: [] as Item[],
  ledgers: new Map<string, Ledger>(),
  employees: new Map<string, { id: string; vacationBalanceCents: number }>(),
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
      delete: async ({ where }: { where: { id: string } }) => {
        h.runs.delete(where.id);
        return {};
      },
    },
    payRunItem: {
      // Emulates the action's predecessor query: same employee, another
      // FINALIZED run, finalized before the window the OR clauses pass
      // (finalizedAt < X, or finalizedAt = X with createdAt < Y),
      // newest first.
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
      update: async ({ where, data }: { where: { employeeId_year: { employeeId: string; year: number } }; data: Ledger }) => {
        h.ledgers.set(where.employeeId_year.employeeId, { ...data });
        return data;
      },
    },
    employee: {
      update: async ({ where, data }: { where: { id: string }; data: { vacationBalanceCents?: { decrement: number } } }) => {
        const emp = h.employees.get(where.id)!;
        if (data.vacationBalanceCents?.decrement) emp.vacationBalanceCents -= data.vacationBalanceCents.decrement;
        return emp;
      },
    },
    ledgerProSyncRecord: { findUnique: async () => null },
  },
}));

import { reversePayRun, deletePayRun } from "@/lib/actions/payroll";

const T1 = new Date("2026-11-13T12:00:00Z");
const T2 = new Date("2026-11-27T12:00:00Z");

function seed() {
  h.runs.clear();
  h.items = [];
  h.ledgers.clear();
  h.employees.clear();

  h.employees.set("emp_1", { id: "emp_1", vacationBalanceCents: 1200 });
  h.runs.set("run_1", { id: "run_1", companyId: "co_1", payGroupId: "pg_1", payDate: "2026-11-13", status: "FINALIZED", createdAt: T1, finalizedAt: T1, reversedAt: null });
  h.runs.set("run_2", { id: "run_2", companyId: "co_1", payGroupId: "pg_1", payDate: "2026-11-27", status: "FINALIZED", createdAt: T2, finalizedAt: T2, reversedAt: null });
  h.items = [
    { id: "it_1", payRunId: "run_1", employeeId: "emp_1", ytdPensionable: 3000, ytdCpp: 150, ytdCpp2: 10, ytdInsurable: 3000, ytdEi: 45, vacationAccruedCents: 0 },
    { id: "it_2", payRunId: "run_2", employeeId: "emp_1", ytdPensionable: 6100, ytdCpp: 305, ytdCpp2: 22, ytdInsurable: 6100, ytdEi: 92, vacationAccruedCents: 1200 },
  ];
  // Ledger = last finalized snapshot (what finalizePayRun persisted).
  h.ledgers.set("emp_1", { pensionableEarnings: 6100, cpp: 305, cpp2: 22, insurableEarnings: 6100, ei: 92 });
}

function fd(id: string): FormData {
  const f = new FormData();
  f.set("id", id);
  return f;
}

beforeEach(seed);

describe("reversePayRun (Wave 1 PR D)", () => {
  it("restores YTD to the previous run's snapshot exactly and unwinds vacation accrual", async () => {
    await reversePayRun(fd("run_2"));
    expect(h.runs.get("run_2")?.status).toBe("REVERSED");
    expect(h.runs.get("run_2")?.reversedAt).toBeInstanceOf(Date);
    expect(h.ledgers.get("emp_1")).toEqual({ pensionableEarnings: 3000, cpp: 150, cpp2: 10, insurableEarnings: 3000, ei: 45 });
    expect(h.employees.get("emp_1")?.vacationBalanceCents).toBe(0);
  });

  it("returns YTD to zero when the remaining run is reversed (finalize → reverse round-trip)", async () => {
    await reversePayRun(fd("run_2"));
    await reversePayRun(fd("run_1"));
    expect(h.ledgers.get("emp_1")).toEqual({ pensionableEarnings: 0, cpp: 0, cpp2: 0, insurableEarnings: 0, ei: 0 });
  });

  it("refuses to reverse a run that is not finalized", async () => {
    await reversePayRun(fd("run_2"));
    await expect(reversePayRun(fd("run_2"))).rejects.toThrow("Only a finalized pay run can be reversed.");
  });

  it("allows deleting a reversed run", async () => {
    await reversePayRun(fd("run_2"));
    await expect(deletePayRun(fd("run_2"))).rejects.toThrow("REDIRECT:/payroll");
    expect(h.runs.has("run_2")).toBe(false);
  });
});
