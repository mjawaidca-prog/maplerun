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
 * Extended with regression coverage for two more defects in the same
 * action: the unconditional `active` read that silently deactivated every
 * edited employee, and the pay fields (payGroupId / payType / payRate)
 * that updateEmployee never read at all.
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
      payGroup: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          if (where.id === "pg_1") return { id: "pg_1", companyId: "co_1" };
          if (where.id === "pg_other") return { id: "pg_other", companyId: "co_other" };
          return null;
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

// ─── Regression: silent deactivation + ignored pay fields ────────────────────
//
// Two further defects in the same action, found in live testing:
//  A. updateEmployee read `active` unconditionally
//     (`formData.get("active") === "true"`), but the Edit Employee form
//     submits no "active" field — so every save set the employee inactive,
//     and the app has no reactivate control.
//  B. updateEmployee never read payGroupId / payType / payRate at all, so
//     edits to those fields from the edit form silently never saved,
//     even though createEmployee reads, validates and persists them.

function updateData(): Record<string, unknown> {
  expect(h.calls.employeeUpdate).toHaveLength(1);
  return (h.calls.employeeUpdate[0] as { data: Record<string, unknown> }).data;
}

describe("updateEmployee — active flag", () => {
  it("does not write `active` when the form submits no active field", async () => {
    const fd = form({ ...BASE, email: "syed@example.com" });

    await expect(updateEmployee(fd)).rejects.toThrow("REDIRECT:/employees");

    expect(updateData()).not.toHaveProperty("active");
  });

  it("writes active:false when the form submits active=\"false\"", async () => {
    const fd = form({ ...BASE, active: "false" });

    await expect(updateEmployee(fd)).rejects.toThrow("REDIRECT:/employees");

    expect(updateData()).toHaveProperty("active", false);
  });

  it("writes active:true when the form submits active=\"true\"", async () => {
    const fd = form({ ...BASE, active: "true" });

    await expect(updateEmployee(fd)).rejects.toThrow("REDIRECT:/employees");

    expect(updateData()).toHaveProperty("active", true);
  });
});

describe("updateEmployee — employment & pay fields", () => {
  it("persists payType, payRate and payGroupId submitted by the form", async () => {
    const fd = form({
      ...BASE,
      payType: "salary",
      payRate: "7371.35",
      payGroupId: "pg_1",
    });

    await expect(updateEmployee(fd)).rejects.toThrow("REDIRECT:/employees");

    const data = updateData();
    expect(data).toHaveProperty("payType", "salary");
    expect(data).toHaveProperty("payRate", 7371.35);
    expect(data).toHaveProperty("payGroupId", "pg_1");
  });

  it("writes no pay keys when the form submits no pay fields", async () => {
    const fd = form({ ...BASE, email: "syed@example.com" });

    await expect(updateEmployee(fd)).rejects.toThrow("REDIRECT:/employees");

    const data = updateData();
    expect(data).not.toHaveProperty("payType");
    expect(data).not.toHaveProperty("payRate");
    expect(data).not.toHaveProperty("payGroupId");
  });

  it("treats a present-but-empty pay group as unassigned (null), like createEmployee", async () => {
    const fd = form({ ...BASE, payType: "", payRate: "", payGroupId: "" });

    await expect(updateEmployee(fd)).rejects.toThrow("REDIRECT:/employees");

    const data = updateData();
    expect(data).toHaveProperty("payType", null);
    expect(data).toHaveProperty("payRate", null);
    expect(data).toHaveProperty("payGroupId", null);
  });

  it("rejects a pay group belonging to a different company, like createEmployee", async () => {
    const fd = form({ ...BASE, payGroupId: "pg_other" });

    await expect(updateEmployee(fd)).rejects.toThrow("Invalid pay group.");

    // Validation happens before the write: nothing was updated.
    expect(h.calls.employeeUpdate).toHaveLength(0);
  });

  it("rejects a pay group that does not exist, like createEmployee", async () => {
    const fd = form({ ...BASE, payGroupId: "pg_missing" });

    await expect(updateEmployee(fd)).rejects.toThrow("Invalid pay group.");

    expect(h.calls.employeeUpdate).toHaveLength(0);
  });
});
