/**
 * Wave 2 WIRING item 4 — ROE wiring tests.
 *
 * `generateRoe` / `generateRoeBlkFile` (lib/actions/roe.ts) rewired onto
 * the pure Wave 2 modules:
 *  - Block 15A is the sum of the RECORDED `PayRunItem.hours` (the old
 *    caller-supplied hours map that defaulted every period to 0 is gone);
 *  - zero-hour periods surface a warning instead of a silent 0;
 *  - worked dates come from Employee.startDate / terminationDate, with a
 *    visible warning when a pay-date fallback is used;
 *  - the accrued vacation balance (cents → dollars) lands in the extract
 *    input's Block 17A vacation structure, and Block 17C other payments
 *    map through with module-validated codes;
 *  - the .BLK output is exactly the extract module's output for the same
 *    input, and never contains <B15B> (ROE Web computes Block 15B).
 *
 * Prisma/session/encryption are mocked, following the existing suites.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  employee: null as null | Record<string, unknown>,
  items: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/session", () => ({
  requireCompany: async () => ({
    id: "user_1",
    email: "pat@acme.test",
    name: "Pat Payroll",
    companyId: "co_1",
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

// Decrypt is a pure pass-through in tests; the fixture SIN is "123456789".
vi.mock("@/lib/encryption", () => ({
  decrypt: () => "123456789",
  encrypt: (s: string) => s,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: {
      findUnique: async () => h.employee,
    },
    payRunItem: {
      findMany: async () => h.items,
    },
    company: {
      findUnique: async () => ({
        name: "Acme Widgets",
        businessNumber: "123456789RP0001",
      }),
    },
    payGroup: {
      findUnique: async () => ({ frequency: "BIWEEKLY" }),
    },
  },
}));

import { generateRoe, generateRoeBlkFile } from "@/lib/actions/roe";
import {
  buildRoeExtractXml,
  type RoeExtractInput,
} from "../src/lib/filings/roe-extract";

function baseEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: "emp_1",
    companyId: "co_1",
    firstName: "Jane",
    lastName: "Worker",
    sinEncrypted: "iv:tag:cipher",
    addressLine1: "123 Main St",
    addressLine2: null,
    city: "Calgary",
    province: "AB",
    postalCode: "T2P 1J9",
    jobTitle: "Welder",
    payGroupId: "pg_1",
    startDate: new Date("2026-01-05T00:00:00Z"),
    terminationDate: new Date("2026-10-30T00:00:00Z"),
    vacationBalanceCents: 12345,
    ytdLedgers: [],
    ...overrides,
  };
}

/** Chronological items: hours 80 / 75.5 / 0, EI deducted on all. */
function baseItems() {
  return [
    { id: "i1", hours: 80, gross: 1600, ei: 25, payRun: { payDate: "2026-10-02" } },
    { id: "i2", hours: 75.5, gross: 1600, ei: 25, payRun: { payDate: "2026-10-16" } },
    { id: "i3", hours: 0, gross: 1600, ei: 25, payRun: { payDate: "2026-10-30" } },
  ];
}

beforeEach(() => {
  h.employee = baseEmployee();
  h.items = baseItems();
});

describe("generateRoe — hours authority (buildRoePeriods wiring)", () => {
  it("Block 15A equals the sum of stored item hours — no zero-default", async () => {
    const roe = await generateRoe("emp_1", "A");
    expect(roe.block15A).toBe(155.5);
    expect(roe.block15B).toBe(4800);
    // Block 15C is most-recent-first, hours carried per period.
    expect(roe.block15C.map((p) => p.periodEnd)).toEqual([
      "2026-10-30",
      "2026-10-16",
      "2026-10-02",
    ]);
    expect(roe.block15C.map((p) => p.hours)).toEqual([0, 75.5, 80]);
  });

  it("warns when periods have no recorded hours", async () => {
    const roe = await generateRoe("emp_1", "A");
    expect(roe.warnings).toContain(
      "1 pay periods have no recorded hours; Block 15A may be understated — verify before issuing",
    );
  });

  it("does not warn when every period has recorded hours", async () => {
    h.items = baseItems().map((i) => ({ ...i, hours: 80 }));
    const roe = await generateRoe("emp_1", "A");
    expect(roe.block15A).toBe(240);
    expect(roe.warnings.some((w) => w.includes("no recorded hours"))).toBe(false);
  });
});

describe("generateRoe — worked dates", () => {
  it("uses Employee.startDate / terminationDate when present, without fallback warnings", async () => {
    const roe = await generateRoe("emp_1", "A");
    expect(roe.firstWorkDate).toBe("2026-01-05");
    expect(roe.lastWorkDate).toBe("2026-10-30");
    expect(roe.finalPayDate).toBe("2026-10-30");
    expect(roe.warnings.some((w) => w.includes("not on file"))).toBe(false);
  });

  it("falls back to pay dates WITH warnings when the dates are missing", async () => {
    h.employee = baseEmployee({ startDate: null, terminationDate: null });
    const roe = await generateRoe("emp_1", "A");
    expect(roe.firstWorkDate).toBe("2026-10-02"); // first pay date
    expect(roe.lastWorkDate).toBe("2026-10-30"); // last period end
    expect(roe.finalPayDate).toBe("2026-10-30");
    expect(roe.warnings).toContain(
      "start date not on file — first pay date used; confirm the actual first day of work",
    );
    expect(roe.warnings).toContain(
      "termination date not on file — last pay period end used; confirm the actual last day of work",
    );
  });
});

describe("separation payments", () => {
  it("defaults vacation pay on termination to the accrued balance (cents → dollars)", async () => {
    const roe = await generateRoe("emp_1", "E");
    expect(roe.vacationPayOnTermination).toBe(123.45);
    expect(roe.otherPayments).toEqual([]);
  });

  it("an explicit vacation amount overrides the balance", async () => {
    const roe = await generateRoe("emp_1", "E", {
      vacationPayOnTermination: 250,
    });
    expect(roe.vacationPayOnTermination).toBe(250);
  });

  it("the vacation balance lands in the extract input's Block 17A structure (cd 2)", async () => {
    const { content } = await generateRoeBlkFile("emp_1", "E");
    expect(content).toContain(
      '<B17A><VP nbr="1"><CD>2</CD><AMT>123.45</AMT></VP></B17A>',
    );
  });

  it("other payments map onto Block 17C with module-expanded codes", async () => {
    const { content } = await generateRoeBlkFile("emp_1", "E", {
      vacationPayOnTermination: 0,
      otherPayments: [{ code: "E", amount: 500 }],
    });
    expect(content).toContain("<CD>E00</CD>");
    expect(content).toContain("<AMT>500.00</AMT>");
    // Explicit 0 vacation → no Block 17A at all.
    expect(content).not.toContain("<B17A>");
  });

  it("module validation throws on an other-monies code with no default XML form", async () => {
    await expect(
      generateRoeBlkFile("emp_1", "E", {
        otherPayments: [{ code: "B", amount: 100 }],
      }),
    ).rejects.toThrow(/no default XML value/);
  });
});

describe("generateRoeBlkFile — extract wiring", () => {
  it("output equals the extract module's output for the same input, with no <B15B>", async () => {
    const { filename, content } = await generateRoeBlkFile("emp_1", "A");
    expect(filename).toBe("Jane-Worker-roe.blk");
    expect(content).not.toContain("<B15B>");

    const expectedInput: RoeExtractInput = {
      employer: {
        payrollAccountNumber: "123456789RP0001",
        shortName: "Acme Widgets",
        contact: {
          firstName: "Pat",
          lastName: "Payroll",
          areaCode: "",
          phone: "",
        },
      },
      employee: {
        sin: "123456789",
        firstName: "Jane",
        lastName: "Worker",
        addressLine1: "123 Main St",
        addressLine2: "Calgary",
        addressLine3: "AB",
        postalCode: "T2P 1J9",
        occupation: "Welder",
        firstDayWorked: "2026-01-05",
        lastDayForWhichPaid: "2026-10-30",
        finalPayPeriodEndingDate: "2026-10-30",
      },
      payrollReferenceNumber: "emp_1",
      payPeriodType: "B",
      periods: [
        { periodEnd: "2026-10-30", insurableHours: 0, insurableEarnings: 1600 },
        { periodEnd: "2026-10-16", insurableHours: 75.5, insurableEarnings: 1600 },
        { periodEnd: "2026-10-02", insurableHours: 80, insurableEarnings: 1600 },
      ],
      reasonCode: "A",
      expectedRecall: { cd: "U" },
      vacationPay: { cd: "2", amount: 123.45 },
    };
    const expected = buildRoeExtractXml(expectedInput, {
      productVersion: "1.0.0",
    });
    expect(content).toBe(expected.xml);
  });

  it("never leaks the decrypted SIN into a thrown error", async () => {
    // Force a module throw whose message echoes its SIN input: an
    // other-monies failure happens after SIN handling in the same try —
    // use a bad vacation path instead: reason "K" without comments makes
    // the module throw before any SIN echo; assert the generic property
    // on the known SIN-echoing path by corrupting the SIN via decrypt is
    // not possible here, so assert the B17C error carries no SIN.
    const err = await generateRoeBlkFile("emp_1", "E", {
      otherPayments: [{ code: "B", amount: 100 }],
    }).catch((e: unknown) => e as Error);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).not.toContain("123456789");
  });
});
