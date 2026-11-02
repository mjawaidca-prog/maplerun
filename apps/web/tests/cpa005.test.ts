import { describe, it, expect } from "vitest";
import {
  buildCpa005File,
  toCpa005Julian,
  POPULATE_RETURNS_ACCOUNT,
  CPA005_RECORD_LENGTH,
  type Cpa005Originator,
  type Cpa005Payment,
} from "../src/lib/eft/cpa005";

/**
 * Position-level tests for the CPA-005 generator (spec:
 * nexvar-pay-versatility/specs/cpa-005-eft.md). Assertions slice the
 * generated content at the spec's fixed positions — the layout IS the
 * contract, so we never snapshot whole lines.
 *
 * Positions below are 1-based, exactly as in the spec tables.
 * Segment-relative positions (segment 1 of a C record) are absolute minus 24:
 *   tx code 1–3, amount 4–13, due date 14–19, routing 20–28, account 29–40,
 *   reserved 41–65, short name 66–80, payee 81–110, long name 111–140,
 *   client no. 141–150, cross-ref 151–169, returns routing 170–178,
 *   returns account 179–190, sundry 191–205, reserved 206–227,
 *   settlement 228–229, tail 230–240.
 */

const CREATION = new Date(Date.UTC(2027, 0, 15)); // Jan 15, 2027 → Julian 027015 (spec §1 example)

const ORIGINATOR: Cpa005Originator = {
  clientNumber: "0012340000",
  fileCreationNumber: "0001",
  dataCentre: "00390", // Calgary (spec §2)
  currency: "CAD",
  originatorShortName: "NEXVAR PAY",
  originatorLongName: "Nexvar Lab Inc.",
  returnInstitution: "003",
  returnTransit: "12345",
  returnAccount: "7654321",
};
// Return routing written into every segment: "0" + "003" + "12345".
const RETURN_ROUTING = "000312345";

function payment(overrides: Partial<Cpa005Payment> = {}): Cpa005Payment {
  return {
    employeeRef: "EMP-001",
    payeeName: "Ada Lovelace",
    institution: "010",
    transit: "67890",
    account: "1234567",
    amountCents: 123456, // $1,234.56
    dueDate: new Date(Date.UTC(2027, 0, 20)),
    ...overrides,
  };
}

/** Split a generated file into its records, asserting the trailing CRLF. */
function recordsOf(content: string): string[] {
  const lines = content.split("\r\n");
  expect(lines[lines.length - 1]).toBe("");
  return lines.slice(0, -1);
}

/** Slice a record by 1-based spec position. */
function field(record: string, pos: number, len: number): string {
  return record.substring(pos - 1, pos - 1 + len);
}

/** Slice segment `index` (0-based) of a C record — segments start at pos 25, 240 chars each. */
function segmentOf(record: string, index: number): string {
  return record.substring(24 + index * 240, 24 + (index + 1) * 240);
}

/** Slice a segment by 1-based segment-relative position. */
function segField(record: string, index: number, segPos: number, len: number): string {
  return field(segmentOf(record, index), segPos, len);
}

describe("record structure (spec §1, §2, §7.1)", () => {
  it("every record is exactly 1,464 chars and the byte total is records × (1464 + CRLF)", () => {
    const { content, problems } = buildCpa005File(
      ORIGINATOR,
      [payment(), payment({ employeeRef: "EMP-002" }), payment({ employeeRef: "EMP-003" })],
      CREATION,
    );
    expect(problems).toEqual([]);
    const records = recordsOf(content);
    expect(records.map((r) => r[0])).toEqual(["A", "C", "Z"]);
    for (const record of records) {
      expect(record.length).toBe(CPA005_RECORD_LENGTH);
      expect(record.length).toBe(1464);
    }
    expect(content.endsWith("\r\n")).toBe(true);
    expect(content.length).toBe(records.length * (1464 + 2));
  });

  it("A record carries count, client number, FCN, Julian creation date, data centre and currency at spec positions", () => {
    const { content } = buildCpa005File(ORIGINATOR, [payment()], CREATION);
    const a = recordsOf(content)[0];
    expect(field(a, 1, 1)).toBe("A");
    expect(field(a, 2, 9)).toBe("000000001");
    expect(field(a, 11, 10)).toBe("0012340000");
    expect(field(a, 21, 4)).toBe("0001");
    expect(field(a, 25, 6)).toBe("027015"); // Jan 15, 2027
    expect(field(a, 31, 5)).toBe("00390");
    expect(field(a, 36, 20)).toBe(" ".repeat(20)); // reserved
    expect(field(a, 56, 3)).toBe("CAD"); // explicit code, not the blank default
    // Filler is all spaces — including the UNVERIFIED settlement block at
    // 1249–1270, which the spec (§2) says to ship as spaces.
    expect(field(a, 59, 1464 - 58)).toBe(" ".repeat(1464 - 58));
    expect(field(a, 1249, 22)).toBe(" ".repeat(22));
  });

  it('supports the "TEST" file creation number and a USD logical file', () => {
    const { content } = buildCpa005File(
      { ...ORIGINATOR, fileCreationNumber: "TEST", currency: "USD" },
      [payment()],
      CREATION,
    );
    const records = recordsOf(content);
    expect(field(records[0], 21, 4)).toBe("TEST");
    expect(field(records[0], 56, 3)).toBe("USD");
    expect(field(records[1], 21, 4)).toBe("TEST"); // C record repeats header FCN
    expect(field(records[2], 21, 4)).toBe("TEST"); // Z record repeats header FCN
    expect(field(records[1], 11, 10)).toBe("0012340000");
    expect(field(records[2], 11, 10)).toBe("0012340000");
  });
});

describe("C records and segments (spec §3)", () => {
  it("places every segment field at its spec position", () => {
    const { content } = buildCpa005File(ORIGINATOR, [payment()], CREATION);
    const c = recordsOf(content)[1];
    expect(field(c, 1, 1)).toBe("C");
    expect(field(c, 2, 9)).toBe("000000002");

    expect(segField(c, 0, 1, 3)).toBe("200"); // payroll transaction code
    expect(segField(c, 0, 4, 10)).toBe("0000123456"); // amount, implied cents
    expect(segField(c, 0, 14, 6)).toBe("027020"); // due Jan 20, 2027
    expect(segField(c, 0, 20, 9)).toBe("001067890"); // "0" + 010 + 67890
    // Account is 12 AN, SPACE-padded — explicitly NOT zero-filled.
    expect(segField(c, 0, 29, 12)).toBe("1234567".padEnd(12, " "));
    expect(segField(c, 0, 41, 25)).toBe("0".repeat(25)); // reserved 65–89, zeros
    expect(segField(c, 0, 66, 15)).toBe("NEXVAR PAY".padEnd(15, " "));
    expect(segField(c, 0, 81, 30)).toBe("Ada Lovelace".padEnd(30, " "));
    expect(segField(c, 0, 111, 30)).toBe("Nexvar Lab Inc.".padEnd(30, " "));
    expect(segField(c, 0, 141, 10)).toBe("0012340000");
    expect(segField(c, 0, 151, 19)).toBe("EMP-001".padEnd(19, " "));
  });

  it("populates the returns account and settlement code (flagged §3 conflict, CPA side)", () => {
    expect(POPULATE_RETURNS_ACCOUNT).toBe(true);
    const { content } = buildCpa005File(ORIGINATOR, [payment()], CREATION);
    const c = recordsOf(content)[1];
    expect(segField(c, 0, 170, 9)).toBe(RETURN_ROUTING); // 194–202: "0" + return inst + transit
    expect(segField(c, 0, 179, 12)).toBe("7654321".padEnd(12, " ")); // 203–214: return account, AN
    expect(segField(c, 0, 191, 15)).toBe(" ".repeat(15)); // sundry, blank
    expect(segField(c, 0, 206, 22)).toBe(" ".repeat(22)); // reserved, blank
    expect(segField(c, 0, 228, 2)).toBe("01"); // 252–253 settlement code
    expect(segField(c, 0, 230, 11)).toBe("0".repeat(11)); // segment tail, zero-filled
  });

  it("a 7-payment file spans 2 C records (6 + 1) with unbroken record counts", () => {
    const payments = Array.from({ length: 7 }, (_, i) =>
      payment({ employeeRef: `EMP-00${i + 1}`, amountCents: (i + 1) * 1000 }),
    );
    const { content, includedCount } = buildCpa005File(ORIGINATOR, payments, CREATION);
    expect(includedCount).toBe(7);

    const records = recordsOf(content);
    expect(records.map((r) => r[0])).toEqual(["A", "C", "C", "Z"]);
    expect(records.map((r) => field(r, 2, 9))).toEqual([
      "000000001",
      "000000002",
      "000000003",
      "000000004",
    ]);
    for (const record of records) expect(record.length).toBe(1464);

    // Segment 6 of the first C record holds the 6th payment…
    expect(segField(records[1], 5, 151, 19)).toBe("EMP-006".padEnd(19, " "));
    expect(segField(records[1], 5, 4, 10)).toBe("0000006000");
    // …and segment 1 of the second C record holds the 7th.
    expect(segField(records[2], 0, 151, 19)).toBe("EMP-007".padEnd(19, " "));
    expect(segField(records[2], 0, 4, 10)).toBe("0000007000");

    // Segments 2–6 of the second C record are unused: N fields zero-filled,
    // AN fields blank (spec §3).
    for (let s = 1; s < 6; s++) {
      expect(segField(records[2], s, 4, 10)).toBe("0".repeat(10)); // amount
      expect(segField(records[2], s, 20, 9)).toBe("0".repeat(9)); // routing
      expect(segField(records[2], s, 29, 12)).toBe(" ".repeat(12)); // account
      expect(segField(records[2], s, 81, 30)).toBe(" ".repeat(30)); // payee
      expect(segField(records[2], s, 151, 19)).toBe(" ".repeat(19)); // cross-ref
      expect(segField(records[2], s, 228, 2)).toBe(" ".repeat(2)); // settlement
      expect(segField(records[2], s, 230, 11)).toBe("0".repeat(11)); // tail
    }
  });

  it("accepts an ISO-string due date", () => {
    const { content, problems } = buildCpa005File(
      ORIGINATOR,
      [payment({ dueDate: "2027-01-20" })],
      CREATION,
    );
    expect(problems).toEqual([]);
    expect(segField(recordsOf(content)[1], 0, 14, 6)).toBe("027020");
  });

  it("strips spaces and dashes from account numbers before writing them", () => {
    const { content, includedCount } = buildCpa005File(
      ORIGINATOR,
      [payment({ account: "123 456-7" })],
      CREATION,
    );
    expect(includedCount).toBe(1);
    expect(segField(recordsOf(content)[1], 0, 29, 12)).toBe("1234567".padEnd(12, " "));
  });
});

describe("Z trailer balancing (spec §6, §7.4)", () => {
  it("trailer total (pos 47–60) and count (pos 61–68) equal the segment sums", () => {
    const payments = [
      payment({ employeeRef: "EMP-001", amountCents: 100 }),
      payment({ employeeRef: "EMP-002", amountCents: 25050 }),
      payment({ employeeRef: "EMP-003", amountCents: 999 }),
    ];
    const result = buildCpa005File(ORIGINATOR, payments, CREATION);
    expect(result.includedCount).toBe(3);
    expect(result.totalCents).toBe(26149);

    const z = recordsOf(result.content)[2];
    expect(field(z, 1, 1)).toBe("Z");
    expect(field(z, 2, 9)).toBe("000000003"); // equals the total record count
    expect(field(z, 25, 14)).toBe("0".repeat(14)); // reserved
    expect(field(z, 39, 8)).toBe("0".repeat(8)); // reserved
    expect(field(z, 47, 14)).toBe("00000000026149");
    expect(field(z, 61, 8)).toBe("00000003");
    expect(field(z, 69, 1464 - 68)).toBe("0".repeat(1464 - 68)); // filler, zero-filled

    // Cross-check the trailer against the segments actually written.
    const c = recordsOf(result.content)[1];
    const segmentSum = [0, 1, 2].reduce(
      (sum, s) => sum + Number(segField(c, s, 4, 10)),
      0,
    );
    expect(segmentSum).toBe(Number(field(z, 47, 14)));
  });
});

describe("payment exclusion — never dummy-filled (spec §7, §8)", () => {
  it("excludes missing transit / overlong account / empty name / zero amount and reports each problem", () => {
    const good = payment({ employeeRef: "EMP-GOOD", amountCents: 5000 });
    const badTransit = payment({ employeeRef: "EMP-NOTRANSIT", transit: "" });
    const badAccount = payment({ employeeRef: "EMP-LONGACCT", account: "1234567890123" }); // 13 digits
    const badName = payment({ employeeRef: "EMP-NONAME", payeeName: "" });
    const badAmount = payment({ employeeRef: "EMP-ZERO", amountCents: 0 });

    const result = buildCpa005File(
      ORIGINATOR,
      [good, badTransit, badAccount, badName, badAmount],
      CREATION,
    );

    expect(result.includedCount).toBe(1);
    expect(result.totalCents).toBe(5000);
    expect(result.problems).toHaveLength(4);
    expect(result.problems).toContainEqual({
      employeeRef: "EMP-NOTRANSIT",
      field: "transit",
      reason: expect.stringMatching(/exactly 5 digits/),
    });
    expect(result.problems).toContainEqual({
      employeeRef: "EMP-LONGACCT",
      field: "account",
      reason: expect.stringMatching(/at most 12 digits/),
    });
    expect(result.problems).toContainEqual({
      employeeRef: "EMP-NONAME",
      field: "payeeName",
      reason: expect.stringMatching(/required/),
    });
    expect(result.problems).toContainEqual({
      employeeRef: "EMP-ZERO",
      field: "amountCents",
      reason: expect.stringMatching(/greater than zero/),
    });

    // The file contains only the good payment; the trailer reflects only it.
    const records = recordsOf(result.content);
    expect(records.map((r) => r[0])).toEqual(["A", "C", "Z"]);
    expect(segField(records[1], 0, 151, 19)).toBe("EMP-GOOD".padEnd(19, " "));
    expect(segField(records[1], 1, 81, 30)).toBe(" ".repeat(30)); // segment 2 unused
    expect(field(records[2], 47, 14)).toBe("00000000005000");
    expect(field(records[2], 61, 8)).toBe("00000001");
  });

  it("excludes bad institution, non-integer/negative amounts, lettered accounts and unparseable due dates", () => {
    const result = buildCpa005File(
      ORIGINATOR,
      [
        payment({ employeeRef: "EMP-BADINST", institution: "01" }),
        payment({ employeeRef: "EMP-FLOAT", amountCents: 1050.5 }),
        payment({ employeeRef: "EMP-NEG", amountCents: -100 }),
        payment({ employeeRef: "EMP-ALPHAACCT", account: "123ABC" }),
        payment({ employeeRef: "EMP-BADDATE", dueDate: "not-a-date" }),
      ],
      CREATION,
    );
    expect(result.includedCount).toBe(0);
    expect(result.totalCents).toBe(0);
    expect(result.problems.map((p) => `${p.employeeRef}:${p.field}`)).toEqual([
      "EMP-BADINST:institution",
      "EMP-FLOAT:amountCents",
      "EMP-NEG:amountCents",
      "EMP-ALPHAACCT:account",
      "EMP-BADDATE:dueDate",
    ]);
    // With nothing includable the file degenerates to A + Z, totals zero —
    // the caller surfaces the problems rather than sending dummy banking.
    const records = recordsOf(result.content);
    expect(records.map((r) => r[0])).toEqual(["A", "Z"]);
    expect(field(records[1], 47, 14)).toBe("0".repeat(14));
    expect(field(records[1], 61, 8)).toBe("0".repeat(8));
  });
});

describe("originator validation — fatal (spec §8)", () => {
  it("throws on a missing client number", () => {
    expect(() =>
      buildCpa005File({ ...ORIGINATOR, clientNumber: "" }, [payment()], CREATION),
    ).toThrow(/clientNumber/);
  });

  it("throws once, listing every originator problem", () => {
    let message = "";
    try {
      buildCpa005File(
        { ...ORIGINATOR, clientNumber: "", dataCentre: "123", returnAccount: "" },
        [payment()],
        CREATION,
      );
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toMatch(/Invalid CPA-005 originator/);
    expect(message).toContain("clientNumber");
    expect(message).toContain("dataCentre");
    expect(message).toContain("returnAccount");
  });

  it("throws on a malformed return routing and an overlong short name", () => {
    expect(() =>
      buildCpa005File({ ...ORIGINATOR, returnTransit: "1234" }, [payment()], CREATION),
    ).toThrow(/returnTransit/);
    expect(() =>
      buildCpa005File(
        { ...ORIGINATOR, originatorShortName: "SIXTEEN-CHARS-XX" },
        [payment()],
        CREATION,
      ),
    ).toThrow(/originatorShortName/);
  });
});

describe("Julian date conversion (spec §1)", () => {
  it("converts the spec example and year boundaries", () => {
    expect(toCpa005Julian(new Date(Date.UTC(2027, 0, 15)))).toBe("027015"); // spec §1 example
    expect(toCpa005Julian(new Date(Date.UTC(2027, 0, 1)))).toBe("027001"); // Jan 1
    expect(toCpa005Julian(new Date(Date.UTC(2027, 11, 31)))).toBe("027365"); // Dec 31, non-leap
  });

  it("handles leap years: Feb 29 is day 060 and Dec 31 is day 366", () => {
    expect(toCpa005Julian(new Date(Date.UTC(2028, 1, 29)))).toBe("028060");
    expect(toCpa005Julian(new Date(Date.UTC(2028, 11, 31)))).toBe("028366");
    expect(toCpa005Julian("2028-02-29")).toBe("028060"); // ISO string input
  });

  it("the header and segment carry the leap-day Julian dates", () => {
    const creation = new Date(Date.UTC(2028, 1, 1)); // Feb 1, 2028
    const { content, problems } = buildCpa005File(
      ORIGINATOR,
      [payment({ dueDate: new Date(Date.UTC(2028, 1, 29)) })],
      creation,
    );
    expect(problems).toEqual([]);
    const records = recordsOf(content);
    expect(field(records[0], 25, 6)).toBe("028032"); // Feb 1 = day 32
    expect(segField(records[1], 0, 14, 6)).toBe("028060"); // leap day
  });
});

describe("due-date window −30/+173 days (spec §3, §7.6)", () => {
  it("includes the boundary days and excludes one day beyond each end", () => {
    const result = buildCpa005File(
      ORIGINATOR,
      [
        payment({ employeeRef: "EMP-MINUS30", dueDate: new Date(Date.UTC(2026, 11, 16)) }),
        payment({ employeeRef: "EMP-MINUS31", dueDate: new Date(Date.UTC(2026, 11, 15)) }),
        payment({ employeeRef: "EMP-PLUS173", dueDate: new Date(Date.UTC(2027, 6, 7)) }),
        payment({ employeeRef: "EMP-PLUS174", dueDate: new Date(Date.UTC(2027, 6, 8)) }),
      ],
      CREATION, // Jan 15, 2027
    );
    expect(result.includedCount).toBe(2);
    expect(result.problems).toHaveLength(2);
    expect(result.problems.map((p) => p.employeeRef).sort()).toEqual([
      "EMP-MINUS31",
      "EMP-PLUS174",
    ]);
    for (const problem of result.problems) {
      expect(problem.field).toBe("dueDate");
    }
    const records = recordsOf(result.content);
    expect(field(records[records.length - 1], 61, 8)).toBe("00000002");
  });

  it("a due date on the creation date itself is inside the window", () => {
    const result = buildCpa005File(ORIGINATOR, [payment({ dueDate: CREATION })], CREATION);
    expect(result.includedCount).toBe(1);
    expect(result.problems).toEqual([]);
  });
});
