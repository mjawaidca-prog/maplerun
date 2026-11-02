/**
 * Wave 1 PR E+F — employee action field coverage.
 *
 * createEmployee persists the Wave 1 employment fields (hire date,
 * title, department, vacation mode/rate, pay group). updateEmployee
 * now accepts the previously create-only fields (payType, payRate,
 * dateOfBirth, bank details) and — critically — no longer touches
 * `active` when the submitting form doesn't carry the field: the edit
 * form has no active input, and the old code read the missing field
 * as false, silently deactivating the employee on every save.
 * terminateEmployee stamps terminationDate; reactivation clears it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  created: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
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
vi.mock("@/lib/encryption", () => ({ encrypt: (s: string) => `enc(${s})`, decrypt: (s: string) => s }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payGroup: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === "pg_1" ? { id: "pg_1", companyId: "co_1" } : null,
    },
    employee: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        h.created = data;
        return { id: "emp_new", ...data };
      },
      findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, companyId: "co_1" }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        h.updates.push(data);
        return {};
      },
    },
    tD1Profile: { create: async () => ({}) },
    ytdLedger: { create: async () => ({}) },
  },
}));

import { createEmployee, updateEmployee, terminateEmployee } from "@/lib/actions/employee";

beforeEach(() => {
  h.created = null;
  h.updates = [];
});

describe("createEmployee (PR E fields)", () => {
  it("persists hire date, title, department, vacation policy and pay group", async () => {
    const fd = new FormData();
    fd.set("firstName", "Ana");
    fd.set("lastName", "Accrue");
    fd.set("sin", "123456789");
    fd.set("payGroupId", "pg_1");
    fd.set("startDate", "2026-01-15");
    fd.set("jobTitle", "Bookkeeper");
    fd.set("department", "Finance");
    fd.set("vacationMode", "ACCRUE");
    fd.set("vacationRatePct", "4");
    await expect(createEmployee(fd)).rejects.toThrow("REDIRECT:/employees");
    expect(h.created?.payGroupId).toBe("pg_1");
    expect((h.created?.startDate as Date).toISOString().slice(0, 10)).toBe("2026-01-15");
    expect(h.created?.jobTitle).toBe("Bookkeeper");
    expect(h.created?.department).toBe("Finance");
    expect(h.created?.vacationMode).toBe("ACCRUE");
    expect(h.created?.vacationRatePct).toBe(4);
  });
});

describe("updateEmployee (PR F)", () => {
  function editForm(extra: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("id", "emp_1");
    fd.set("firstName", "Ana");
    fd.set("lastName", "Accrue");
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    return fd;
  }

  it("does NOT touch `active` when the form carries no active field (edit-form deactivation bug)", async () => {
    await expect(updateEmployee(editForm())).rejects.toThrow("REDIRECT:/employees");
    expect(h.updates[0]).not.toHaveProperty("active");
    expect(h.updates[0]).not.toHaveProperty("terminationDate");
  });

  it("accepts payType, payRate, dateOfBirth, pay group and bank details", async () => {
    await expect(
      updateEmployee(
        editForm({
          payType: "hourly",
          payRate: "32.50",
          dateOfBirth: "1990-05-04",
          payGroupId: "pg_1",
          bankTransit: "12345",
          bankInstitution: "001",
          bankAccount: "9876543",
          vacationMode: "ACCRUE",
          vacationRatePct: "6",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/employees");
    const u = h.updates[0];
    expect(u.payType).toBe("hourly");
    expect(u.payRate).toBe(32.5);
    expect((u.dateOfBirth as Date).toISOString().slice(0, 10)).toBe("1990-05-04");
    expect(u.payGroupId).toBe("pg_1");
    expect(u.vacationMode).toBe("ACCRUE");
    expect(u.vacationRatePct).toBe(6);
    expect(String(u.bankEncrypted)).toContain("12345");
  });

  it("clears terminationDate on reactivation", async () => {
    await expect(updateEmployee(editForm({ active: "true" }))).rejects.toThrow("REDIRECT:/employees");
    expect(h.updates[0].active).toBe(true);
    expect(h.updates[0].terminationDate).toBeNull();
  });
});

describe("terminateEmployee (PR E)", () => {
  it("stamps terminationDate alongside active=false", async () => {
    const fd = new FormData();
    fd.set("id", "emp_1");
    await terminateEmployee(fd);
    expect(h.updates[0].active).toBe(false);
    expect(h.updates[0].terminationDate).toBeInstanceOf(Date);
  });
});
