/**
 * Wave 2 Wiring — EFT: generateEftFile / previewEftFile /
 * updateEftOriginatorProfile over the pure CPA-005 builder.
 *
 * In-memory Prisma fake (same style as payroll-reversal.test.ts). Proves:
 *  - the Company → Cpa005Originator mapping lands in the file, including
 *    the ENCRYPTED return account round-tripping into the segments;
 *  - an incomplete originator profile is a clear error naming the
 *    Settings → Payroll fields (nothing is fabricated to make it pass);
 *  - an employee with no banking is EXCLUDED with the builder's reasons
 *    while payable employees are still included;
 *  - zero/negative-net items are excluded before the builder;
 *  - the interim file-creation-number derivation rotates across runs,
 *    is stable per run, and wraps at 9999;
 *  - the Settings save action validates bank formats and stores the
 *    account encrypted (blank = keep the stored account).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");

type AnyRec = Record<string, unknown>;

const h = vi.hoisted(() => ({
  company: null as AnyRec | null,
  runs: new Map<string, AnyRec>(),
  items: [] as AnyRec[],
  employees: new Map<string, AnyRec>(),
  companyUpdate: null as AnyRec | null,
}));

vi.mock("@/lib/session", () => ({
  requireCompany: async () => ({ id: "user_1", email: "a@b.c", companyId: "co_1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      findUnique: async () => h.company,
      update: async ({ data }: { data: AnyRec }) => {
        h.companyUpdate = data;
        Object.assign(h.company as AnyRec, data);
        return h.company;
      },
    },
    payRun: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const run = h.runs.get(where.id);
        if (!run) return null;
        const items = h.items
          .filter((i) => i.payRunId === run.id)
          .map((i) => ({ ...i, employee: h.employees.get(i.employeeId as string) }))
          .sort((a, b) =>
            String((a.employee as AnyRec).lastName).localeCompare(String((b.employee as AnyRec).lastName)),
          );
        return { ...run, items };
      },
      // Interprets the action's (payDate, createdAt) ≤ this-run window.
      count: async ({ where }: { where: AnyRec }) => {
        const [ltClause, eqClause] = where.OR as AnyRec[];
        const ltDate = (ltClause.payDate as AnyRec).lt as string;
        const eqDate = eqClause.payDate as string;
        const eqCreated = (eqClause.createdAt as AnyRec).lte as Date;
        return [...h.runs.values()].filter(
          (r) =>
            r.companyId === where.companyId &&
            r.status === where.status &&
            ((r.payDate as string) < ltDate ||
              (r.payDate === eqDate && (r.createdAt as Date).getTime() <= eqCreated.getTime())),
        ).length;
      },
    },
  },
}));

import { encrypt, decrypt } from "@/lib/encryption";
import { generateEftFile, previewEftFile, updateEftOriginatorProfile } from "@/lib/actions/eft";

/* ---------------- seeding helpers ---------------- */

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

function banked(institution: string, transit: string, account: string): string {
  return encrypt(JSON.stringify({ institution, transit, account }));
}

function seedCompany(overrides: AnyRec = {}) {
  h.company = {
    id: "co_1",
    // 39 chars — exercises the 30-char originatorLongName truncation.
    name: "Acme Payroll Services Incorporated Ltd.",
    eftOriginatorName: "ACME PAYROLL",
    eftOriginatorId: "ACME123456",
    eftDataCentre: "00123",
    eftInstitution: "003",
    eftTransit: "12345",
    eftAccount: encrypt("987654321"),
    ...overrides,
  };
}

function addRun(id: string, payDate: string, createdDaysAgo: number, status = "FINALIZED", companyId = "co_1") {
  h.runs.set(id, {
    id,
    companyId,
    payGroupId: "pg_1",
    payDate,
    status,
    createdAt: new Date(Date.now() - createdDaysAgo * 86_400_000),
    totalNetPay: 0,
  });
}

function addEmployee(id: string, firstName: string, lastName: string, bankEncrypted: string | null) {
  h.employees.set(id, { id, firstName, lastName, bankEncrypted });
}

function addItem(payRunId: string, employeeId: string, netPay: number) {
  h.items.push({ id: `it_${payRunId}_${employeeId}`, payRunId, employeeId, netPay });
}

function seedGoodEmployee(payRunId: string, netPay = 1500.25) {
  addEmployee("emp_good", "Ada", "Lovelace", banked("002", "54321", "1234567"));
  addItem(payRunId, "emp_good", netPay);
}

function fcnOf(content: string): string {
  // Header positions 21–24 (1-based) = the file creation number.
  return content.split("\r\n")[0]!.substring(20, 24);
}

beforeEach(() => {
  h.company = null;
  h.runs.clear();
  h.items = [];
  h.employees.clear();
  h.companyUpdate = null;
  seedCompany();
});

/* ---------------- originator mapping ---------------- */

describe("generateEftFile — originator mapping", () => {
  it("maps the Settings profile into the CPA-005 header and segments, decrypting the return account", async () => {
    addRun("run_1", isoDaysAgo(0), 0);
    seedGoodEmployee("run_1");

    const result = await generateEftFile("run_1");
    expect(result.filename).toBe(`eft-payrun-${isoDaysAgo(0)}.txt`);
    expect(result.includedCount).toBe(1);
    expect(result.totalCents).toBe(150025);
    expect(result.excluded).toEqual([]);

    const header = result.content.split("\r\n")[0]!;
    expect(header).toHaveLength(1464);
    expect(header[0]).toBe("A");
    expect(header.substring(10, 20)).toBe("ACME123456"); // clientNumber ← eftOriginatorId
    expect(header.substring(20, 24)).toBe("0001"); // first finalized run → FCN 0001
    expect(header.substring(30, 35)).toBe("00123"); // dataCentre ← eftDataCentre
    expect(header.substring(55, 58)).toBe("CAD"); // currency

    // Segment content: short name, truncated long name, payee, routing.
    expect(result.content).toContain("ACME PAYROLL"); // originatorShortName
    expect(result.content).toContain("Acme Payroll Services Incorpor"); // long name truncated to 30
    expect(result.content).not.toContain("Acme Payroll Services Incorporated Ltd.");
    expect(result.content).toContain("Ada Lovelace"); // payee = "First Last"
    expect(result.content).toContain("000254321"); // payee routing "0"+002+54321
    expect(result.content).toContain("0000150025"); // amount, integer cents

    // Returns account: "0"+returnInstitution+returnTransit and the
    // DECRYPTED return account, space-padded to its 12-AN field.
    expect(result.content).toContain("000312345");
    expect(result.content).toContain("987654321   ");
  });

  it("refuses a run that is not finalized", async () => {
    addRun("run_d", isoDaysAgo(0), 0, "DRAFT");
    await expect(generateEftFile("run_d")).rejects.toThrow("not finalized");
  });
});

/* ---------------- incomplete profile ---------------- */

describe("generateEftFile — incomplete originator profile", () => {
  it("throws a clear error naming the missing Settings fields, and preview reports them", async () => {
    seedCompany({ eftOriginatorId: null, eftDataCentre: null, eftAccount: null });
    addRun("run_1", isoDaysAgo(0), 0);
    seedGoodEmployee("run_1");

    await expect(generateEftFile("run_1")).rejects.toThrow(/Settings → Payroll/);
    await expect(generateEftFile("run_1")).rejects.toThrow(/Originator ID \/ client number/);
    await expect(generateEftFile("run_1")).rejects.toThrow(/Data centre/);
    await expect(generateEftFile("run_1")).rejects.toThrow(/Account number/);

    const preview = await previewEftFile("run_1");
    expect(preview.profileProblems).toEqual(
      expect.arrayContaining(["Originator ID / client number", "Data centre", "Account number"]),
    );
    expect(preview.includedCount).toBe(0);
    expect(preview.included).toEqual([]);
  });

  it("treats an undecryptable stored account as a missing Account number", async () => {
    seedCompany({ eftAccount: "not:valid:ciphertext" });
    addRun("run_1", isoDaysAgo(0), 0);
    const preview = await previewEftFile("run_1");
    expect(preview.profileProblems).toContain("Account number");
  });
});

/* ---------------- payment exclusions ---------------- */

describe("generateEftFile — payment exclusions", () => {
  it("excludes an employee with no banking, with the builder's reasons, and still includes the others", async () => {
    addRun("run_1", isoDaysAgo(0), 0);
    seedGoodEmployee("run_1");
    addEmployee("emp_nobank", "Noah", "Bankless", null);
    addItem("run_1", "emp_nobank", 900);

    const result = await generateEftFile("run_1");
    expect(result.includedCount).toBe(1);
    expect(result.totalCents).toBe(150025);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0]!.employeeName).toBe("Noah Bankless");
    const reasons = result.excluded[0]!.reasons.join(" ");
    expect(reasons).toMatch(/institution/);
    expect(reasons).toMatch(/transit/);
    expect(reasons).toMatch(/account/);

    const preview = await previewEftFile("run_1");
    expect(preview.profileProblems).toEqual([]);
    expect(preview.included.map((e) => e.employeeName)).toEqual(["Ada Lovelace"]);
    expect(preview.excluded.map((e) => e.employeeName)).toEqual(["Noah Bankless"]);
  });

  it("excludes an employee whose banking blob is undecryptable", async () => {
    addRun("run_1", isoDaysAgo(0), 0);
    seedGoodEmployee("run_1");
    addEmployee("emp_bad", "Bad", "Blob", "zz:yy:xx");
    addItem("run_1", "emp_bad", 500);

    const result = await generateEftFile("run_1");
    expect(result.includedCount).toBe(1);
    expect(result.excluded.map((e) => e.employeeName)).toEqual(["Bad Blob"]);
  });

  it("excludes zero and negative net pay before the builder, with the stated reason", async () => {
    addRun("run_1", isoDaysAgo(0), 0);
    seedGoodEmployee("run_1");
    addEmployee("emp_zero", "Zed", "Zero", banked("001", "11111", "222"));
    addItem("run_1", "emp_zero", 0);
    addEmployee("emp_neg", "Ned", "Negative", banked("001", "11111", "333"));
    addItem("run_1", "emp_neg", -25);

    const result = await generateEftFile("run_1");
    expect(result.includedCount).toBe(1);
    expect(result.excluded).toEqual([
      { employeeName: "Ned Negative", reasons: ["net pay is zero or negative"] },
      { employeeName: "Zed Zero", reasons: ["net pay is zero or negative"] },
    ]);
  });

  it("builds an A+Z-only file when every item is excluded", async () => {
    addRun("run_1", isoDaysAgo(0), 0);
    addEmployee("emp_zero", "Zed", "Zero", banked("001", "11111", "222"));
    addItem("run_1", "emp_zero", 0);

    const result = await generateEftFile("run_1");
    expect(result.includedCount).toBe(0);
    expect(result.totalCents).toBe(0);
    const records = result.content.split("\r\n");
    expect(records).toHaveLength(3); // A, Z, trailing empty after final CRLF
    expect(records[0]![0]).toBe("A");
    expect(records[1]![0]).toBe("Z");
  });
});

/* ---------------- file creation number ---------------- */

describe("file creation number — interim derivation", () => {
  it("rotates across finalized runs in (payDate, createdAt) order and is stable per run", async () => {
    addRun("run_1", isoDaysAgo(14), 14);
    addRun("run_2", isoDaysAgo(7), 7);
    addRun("run_3", isoDaysAgo(0), 0);
    // Noise that must NOT consume sequence positions:
    addRun("run_draft", isoDaysAgo(21), 21, "DRAFT");
    addRun("run_other_co", isoDaysAgo(28), 28, "FINALIZED", "co_2");
    for (const id of ["run_1", "run_2", "run_3"]) seedGoodEmployee(id, 100);

    expect(fcnOf((await generateEftFile("run_1")).content)).toBe("0001");
    expect(fcnOf((await generateEftFile("run_2")).content)).toBe("0002");
    expect(fcnOf((await generateEftFile("run_3")).content)).toBe("0003");
    // Re-downloading the same run reproduces the same FCN.
    expect(fcnOf((await generateEftFile("run_2")).content)).toBe("0002");
  });

  it("wraps the sequence at 9999 back to 0001", async () => {
    for (let i = 0; i < 9999; i++) {
      addRun(`bulk_${i}`, isoDaysAgo(30), 30);
    }
    addRun("run_wrap1", isoDaysAgo(0), 0);
    addRun("run_wrap2", isoDaysAgo(0), 0);
    // Both wrap runs share today's payDate; run_wrap2 was created later.
    h.runs.get("run_wrap1")!.createdAt = new Date(Date.now() - 60_000);
    h.runs.get("run_wrap2")!.createdAt = new Date(Date.now() - 30_000);

    expect(fcnOf((await generateEftFile("run_wrap1")).content)).toBe("0001"); // position 10000
    expect(fcnOf((await generateEftFile("run_wrap2")).content)).toBe("0002"); // position 10001
  });
});

/* ---------------- settings save action ---------------- */

describe("updateEftOriginatorProfile", () => {
  function form(fields: Record<string, string>): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  }
  const valid = {
    eftOriginatorName: "ACME PAYROLL",
    eftOriginatorId: "ACME123456",
    eftDataCentre: "00123",
    eftInstitution: "003",
    eftTransit: "12345",
  };

  it("stores the profile and encrypts the account (round trip)", async () => {
    await updateEftOriginatorProfile(form({ ...valid, eftAccount: "555 444-333" }));
    expect(h.companyUpdate).not.toBeNull();
    expect(h.companyUpdate!.eftDataCentre).toBe("00123");
    expect(h.companyUpdate!.eftOriginatorName).toBe("ACME PAYROLL");
    // Stored value is ciphertext, and decrypts back to the digits.
    expect(h.companyUpdate!.eftAccount).not.toBe("555444333");
    expect(decrypt(h.companyUpdate!.eftAccount as string)).toBe("555444333");
  });

  it("leaves the stored account untouched when the field is blank", async () => {
    await updateEftOriginatorProfile(form({ ...valid, eftAccount: "" }));
    expect(h.companyUpdate).not.toBeNull();
    expect("eftAccount" in (h.companyUpdate as AnyRec)).toBe(false);
  });

  it("requires an account on a first save with none stored", async () => {
    seedCompany({ eftAccount: null });
    await expect(updateEftOriginatorProfile(form({ ...valid, eftAccount: "" }))).rejects.toThrow(
      /Account number is required/,
    );
  });

  it("rejects malformed bank-assigned values server-side", async () => {
    await expect(
      updateEftOriginatorProfile(form({ ...valid, eftDataCentre: "123", eftAccount: "1" })),
    ).rejects.toThrow(/Data centre must be exactly 5 digits/);
    await expect(
      updateEftOriginatorProfile(form({ ...valid, eftInstitution: "03", eftAccount: "1" })),
    ).rejects.toThrow(/Institution number must be exactly 3 digits/);
    await expect(
      updateEftOriginatorProfile(form({ ...valid, eftOriginatorName: "SIXTEEN CHARS XX", eftAccount: "1" })),
    ).rejects.toThrow(/at most 15 characters/);
    await expect(
      updateEftOriginatorProfile(form({ ...valid, eftAccount: "1234567890123" })),
    ).rejects.toThrow(/at most 12 digits/);
  });
});
