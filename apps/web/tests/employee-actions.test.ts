/**
 * Action-level tests for updateEmployee in lib/actions/employee.ts.
 *
 * Regression coverage for the TD1-card bug: the Edit Employee form renders
 * its TD1 fields (claim amounts, extra tax, CPP/EI exemptions) inside the
 * single form that posts to updateEmployee, but updateEmployee never read
 * them, so nothing in that card ever saved. These tests pin the fix:
 * updateEmployee upserts the 2026 TD1Profile when (and only when) the form
 * carried TD1 fields.
 *
 * Prisma, session and Next navigation/cache are mocked, following the
 * pattern in payroll-hooks.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted call log ────────────────────────────────────────────────────────

const h = vi.hoisted(() => {
  const calls = {
    employeeUpdate: [] as Array<Record<string, unknown>>,
    td1Upsert: [] as Array<Record<string, unknown>>,
  };
  return { calls };
});

vi.mock("@/lib/session", () => ({
  requireCompany: async () => ({ id: "user_1", email: "a@b.c", companyId: "co_1" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/prisma", () => {
  const { calls } = h;
  return {
    prisma: {
      employee: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === "emp_1" ? { id: "emp_1", companyId: "co_1" } : null,
        update: async (args: Record<string, unknown>) => {
          calls.employeeUpdate.push(args);
          return {};
        },
      },
      tD1Profile: {
        upsert: async (args: Record<string, unknown>) => {
          calls.td1Upsert.push(args);
          return {};
        },
      },
    },
  };
});

// ─── Imports under test (after mocks) ────────────────────────────────────────

import { updateEmployee } from "../src/lib/actions/employee";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const BASE = { id: "emp_1", firstName: "Syed", lastName: "Abbas" };

beforeEach(() => {
  h.calls.employeeUpdate.length = 0;
  h.calls.td1Upsert.length = 0;
});

describe("updateEmployee — TD1 card persistence", () => {
  it("upserts the 2026 TD1Profile with parsed values and checked exemptions", async () => {
    const fd = form({
      ...BASE,
      federalClaim: "20000.50",
      provincialClaim: "12000",
      extraTaxPerPeriod: "25.5",
      cppExempt: "true",
      eiExempt: "true",
    });

    await expect(updateEmployee(fd)).rejects.toThrow("REDIRECT:/employees");

    expect(h.calls.employeeUpdate).toHaveLength(1);
    expect(h.calls.td1Upsert).toHaveLength(1);

    const upsert = h.calls.td1Upsert[0] as {
      where: unknown;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(upsert.where).toEqual({ employeeId_year: { employeeId: "emp_1", year: 2026 } });

    const expectedFields = {
      federalClaim: 20000.5,
      provincialClaim: 12000,
      extraTaxPerPeriod: 25.5,
      cppExempt: true,
      eiExempt: true,
    };
    expect(upsert.create).toEqual({ employeeId: "emp_1", year: 2026, ...expectedFields });
    expect(upsert.update).toEqual(expectedFields);
  });

  it("treats unchecked checkboxes (absent from the form) as false when the TD1 card is present", async () => {
    // A real browser submit of the edit form with both boxes unchecked:
    // the text inputs still submit (federalClaim possibly empty), the
    // checkbox fields submit nothing at all.
    const fd = form({
      ...BASE,
      federalClaim: "",
      provincialClaim: "9000",
      extraTaxPerPeriod: "",
    });

    await expect(updateEmployee(fd)).rejects.toThrow("REDIRECT:/employees");

    expect(h.calls.td1Upsert).toHaveLength(1);
    const upsert = h.calls.td1Upsert[0] as {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    const expectedFields = {
      federalClaim: null,
      provincialClaim: 9000,
      extraTaxPerPeriod: null,
      cppExempt: false,
      eiExempt: false,
    };
    expect(upsert.create).toMatchObject(expectedFields);
    expect(upsert.update).toEqual(expectedFields);
  });

  it("does not touch TD1Profile when the form carries no TD1 fields", async () => {
    const fd = form({ ...BASE, email: "syed@example.com" });

    await expect(updateEmployee(fd)).rejects.toThrow("REDIRECT:/employees");

    expect(h.calls.employeeUpdate).toHaveLength(1);
    expect(h.calls.td1Upsert).toHaveLength(0);
  });
});
