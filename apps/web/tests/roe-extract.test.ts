/**
 * Tests for the ROE Web Payroll Extract serializer (Appendix D) and the
 * period-history builder.
 *
 * Fixtures are hand-built per spec `roe-web.md` (Appendix A §5 period
 * counts / Block 12 windows; Appendix D §8.2.4 element order; Tables
 * 16.1 / 17A.1 / 17C.1 / 19.1 XML code values, verified 2026-11-02).
 * XSD validation against the official PayrollExtractXmlV2.xsd was done
 * out-of-band (lxml) during development; the structural assertions below
 * encode the Appendix D rules so the suite stays self-contained.
 */
import { describe, it, expect } from "vitest";
import {
  buildRoeExtractXml,
  formatRoeMoney,
  type RoeExtractInput,
  type RoePeriodInput,
} from "../src/lib/filings/roe-extract";
import { buildRoePeriods } from "../src/lib/filings/roe-periods";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const HEADER = { productVersion: "1.4.0" };

function addDays(ccyyMmDd: string, days: number): string {
  const d = new Date(`${ccyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Chronological (oldest-first) bi-weekly history: 27 periods ending
 *  2026-10-30, earnings rising $10 per period from $1,500, 75.5 h each. */
function biWeekly27(): RoePeriodInput[] {
  const periods: RoePeriodInput[] = [];
  for (let i = 0; i < 27; i++) {
    periods.push({
      periodEnd: addDays("2026-10-30", -14 * (26 - i)),
      insurableHours: 75.5,
      insurableEarnings: 1500 + i * 10,
    });
  }
  return periods;
}

function makeInput(overrides: Partial<RoeExtractInput> = {}): RoeExtractInput {
  return {
    employer: {
      payrollAccountNumber: "123456789RP0001",
      shortName: "Acme Widgets Inc.",
      contact: {
        firstName: "Pat",
        lastName: "Payroll",
        areaCode: "403",
        phone: "555-1234",
      },
    },
    employee: {
      sin: "987 654 321",
      firstName: "Jane",
      middleInitial: "Q",
      lastName: "Worker",
      addressLine1: "123 Main St",
      addressLine2: "Calgary AB",
      postalCode: "T2P 1J9",
      occupation: "Welder",
      firstDayWorked: "2025-01-06",
      lastDayForWhichPaid: "2026-10-30",
      finalPayPeriodEndingDate: "2026-10-30",
    },
    payPeriodType: "B",
    periods: [
      { periodEnd: "2026-10-16", insurableHours: 80, insurableEarnings: 1600 },
      { periodEnd: "2026-10-30", insurableHours: 80, insurableEarnings: 1600 },
    ],
    reasonCode: "A",
    expectedRecall: { cd: "U" },
    ...overrides,
  };
}

function ppAmounts(xml: string): { nbr: string; amt: string }[] {
  return [...xml.matchAll(/<PP nbr="(\d+)"><AMT>([\d.]+)<\/AMT><\/PP>/g)].map(
    (m) => ({ nbr: m[1]!, amt: m[2]! }),
  );
}

function block15A(xml: string): string {
  return /<B15A>(\d+)<\/B15A>/.exec(xml)![1]!;
}

// ─── Document shape (Appendix D §2, §8.2.2–8.2.4) ────────────────────────────

describe("buildRoeExtractXml — document shape", () => {
  it("puts the XML declaration on the first line and builds the ROEHEADER", () => {
    const { xml, filename } = buildRoeExtractXml(makeInput(), HEADER);
    expect(xml.split("\n")[0]).toBe('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<ROEHEADER FileVersion="W-2.0" SoftwareVendor="Nexvar Lab Inc." ProductName="Nexvar Pay" ProductVersion="1.4.0">',
    );
    expect(xml.endsWith("</ROEHEADER>")).toBe(true);
    // Sanitized short name (spaces/period removed) + "_ROE" + ".BLK".
    expect(filename).toBe("AcmeWidgetsInc_ROE.BLK");
  });

  it("falls back to a PAYROLL prefix when no employer short name is given", () => {
    const input = makeInput();
    delete input.employer.shortName;
    expect(buildRoeExtractXml(input, HEADER).filename).toBe("PAYROLL_ROE.BLK");
  });

  it("emits blocks in the Appendix D §8.2.4 / XSD sequence order", () => {
    const { xml } = buildRoeExtractXml(
      makeInput({ comments: "Seasonal layoff pattern." }),
      HEADER,
    );
    const order = [
      "<B5>", "<B6>", "<B8>", "<B9>", "<B10>", "<B11>", "<B12>", "<B13>",
      "<B14>", "<B15A>", "<B15C>", "<B16>", "<B18>", "<B20>",
    ];
    const indexes = order.map((tag) => xml.indexOf(tag));
    expect(indexes.every((i) => i >= 0)).toBe(true);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it("never emits a B15B element (ROE Web auto-calculates Block 15B)", () => {
    const { xml } = buildRoeExtractXml(makeInput(), HEADER);
    expect(xml).not.toContain("B15B");
  });

  it('defaults Issue to "D" (draft) and PrintingLanguage to "E"', () => {
    const { xml } = buildRoeExtractXml(makeInput(), HEADER);
    expect(xml).toContain('<ROE PrintingLanguage="E" Issue="D">');
    expect(xml).toContain("<B20>E</B20>");
  });

  it('honours explicit Issue "S" and language "F"', () => {
    const { xml } = buildRoeExtractXml(
      makeInput({ issue: "S", language: "F" }),
      HEADER,
    );
    expect(xml).toContain('<ROE PrintingLanguage="F" Issue="S">');
    expect(xml).toContain("<B20>F</B20>");
  });

  it("serializes a batch of ROEs under one header", () => {
    const { xml } = buildRoeExtractXml(
      [makeInput(), makeInput({ serialNumber: "W12345678" })],
      HEADER,
    );
    expect(xml.match(/<ROE /g)).toHaveLength(2);
    expect(xml).toContain("<B2>W12345678</B2>");
  });

  it("omits B2 when no serial number is supplied (original ROE)", () => {
    const { xml } = buildRoeExtractXml(makeInput(), HEADER);
    expect(xml).not.toContain("<B2>");
  });

  it("escapes XML text in names and comments", () => {
    const input = makeInput({ comments: 'Crew <A> & "lead" hand' });
    input.employee.lastName = "O'Brien & Sons";
    const { xml } = buildRoeExtractXml(input, HEADER);
    expect(xml).toContain("O&apos;Brien &amp; Sons");
    expect(xml).toContain("Crew &lt;A&gt; &amp; &quot;lead&quot; hand");
    expect(xml).not.toContain("O'Brien & Sons");
  });
});

// ─── Blocks 5, 8, 9 (identifiers) ────────────────────────────────────────────

describe("buildRoeExtractXml — identifiers", () => {
  it("strips spaces from the SIN and the postal code", () => {
    const { xml } = buildRoeExtractXml(makeInput(), HEADER);
    expect(xml).toContain("<B8>987654321</B8>");
    expect(xml).toContain("<PC>T2P1J9</PC>");
  });

  it("warns when the Block 5 BN first digit is not 1, 7, or 8", () => {
    const input = makeInput();
    input.employer.payrollAccountNumber = "223456789RP0001";
    const { warnings } = buildRoeExtractXml(input, HEADER);
    expect(warnings.some((w) => w.includes("Block 5"))).toBe(true);
  });

  it("throws on a malformed payroll account number", () => {
    const input = makeInput();
    input.employer.payrollAccountNumber = "12345678RP001";
    expect(() => buildRoeExtractXml(input, HEADER)).toThrow(/Block 5/);
  });
});

// ─── Blocks 15A / 15C (Appendix A §5; Appendix D Tables 15A.1/15C.1) ─────────

describe("buildRoeExtractXml — Blocks 15A/15C", () => {
  it("numbers 27 bi-weekly periods 1..27 most-recent-first and ceils 15A", () => {
    // Feed the history newest-first and rotated: the module must sort.
    const chronological = biWeekly27();
    const shuffled = [...chronological.slice(20), ...chronological.slice(0, 20)];
    const { xml, warnings } = buildRoeExtractXml(
      makeInput({ periods: shuffled }),
      HEADER,
    );
    const pps = ppAmounts(xml);
    expect(pps).toHaveLength(27);
    expect(pps.map((p) => Number(p.nbr))).toEqual(
      Array.from({ length: 27 }, (_, i) => i + 1),
    );
    // PP1 = most recent period (highest earnings in this fixture).
    expect(pps[0]!.amt).toBe("1760.00");
    expect(pps[26]!.amt).toBe("1500.00");
    // 27 × 75.5 = 2038.5 → whole hours rounded UP = 2039.
    expect(block15A(xml)).toBe("2039");
    expect(warnings).toEqual([]);
  });

  it("truncates a 60-period weekly history to 53 with a warning", () => {
    const periods: RoePeriodInput[] = [];
    for (let i = 0; i < 60; i++) {
      periods.push({
        periodEnd: addDays("2026-10-30", -7 * (59 - i)),
        insurableHours: 40,
        insurableEarnings: i === 59 ? 2000 : 1000,
      });
    }
    const input = makeInput({
      payPeriodType: "W",
      periods,
      employee: {
        ...makeInput().employee,
        firstDayWorked: "2025-09-05",
      },
    });
    const { xml, warnings } = buildRoeExtractXml(input, HEADER);
    const pps = ppAmounts(xml);
    expect(pps).toHaveLength(53);
    expect(pps[0]!.amt).toBe("2000.00");
    // 15A sums only the 53 REPORTED periods: 53 × 40 = 2120.
    expect(block15A(xml)).toBe("2120");
    expect(warnings.some((w) => w.includes("truncated to the 53"))).toBe(true);
  });

  it("formats money with fixed 2 decimals and no symbol", () => {
    const { xml } = buildRoeExtractXml(
      makeInput({
        periods: [
          { periodEnd: "2026-10-30", insurableHours: 10, insurableEarnings: 1234.5 },
        ],
      }),
      HEADER,
    );
    expect(xml).toContain("<AMT>1234.50</AMT>");
    expect(formatRoeMoney(1234.5)).toBe("1234.50");
    expect(formatRoeMoney(0)).toBe("0.00");
  });

  it("throws when no periods are supplied (PP1 is mandatory)", () => {
    expect(() =>
      buildRoeExtractXml(makeInput({ periods: [] }), HEADER),
    ).toThrow(/PP1 is mandatory/);
  });

  it("warns when 15A exceeds the (B11 − B10 + 1) × 24 sanity cap", () => {
    const input = makeInput({
      payPeriodType: "W",
      periods: [
        { periodEnd: "2026-10-23", insurableHours: 60, insurableEarnings: 900 },
        { periodEnd: "2026-10-30", insurableHours: 40, insurableEarnings: 900 },
      ],
      employee: {
        ...makeInput().employee,
        firstDayWorked: "2026-10-30",
        lastDayForWhichPaid: "2026-10-30",
        finalPayPeriodEndingDate: "2026-10-30",
      },
    });
    const { xml, warnings } = buildRoeExtractXml(input, HEADER);
    expect(block15A(xml)).toBe("100"); // warned, NOT clamped to 24
    expect(
      warnings.some((w) => w.includes("Block 15A") && w.includes("exceeds")),
    ).toBe(true);
  });
});

// ─── Block 12 window (Appendix D Table 7; Appendix A §5) ─────────────────────

describe("buildRoeExtractXml — Block 12 window", () => {
  it("warns when a weekly final period ends 10 days after LDFWP (max 6)", () => {
    const input = makeInput({
      payPeriodType: "W",
      employee: {
        ...makeInput().employee,
        firstDayWorked: "2026-09-01",
        lastDayForWhichPaid: "2026-10-20",
        finalPayPeriodEndingDate: "2026-10-30",
      },
    });
    const { warnings } = buildRoeExtractXml(input, HEADER);
    expect(
      warnings.some((w) => w.includes("Block 12") && w.includes("6 days")),
    ).toBe(true);
  });

  it("warns when a monthly final period does not end on month-end", () => {
    const input = makeInput({
      payPeriodType: "M",
      employee: {
        ...makeInput().employee,
        lastDayForWhichPaid: "2026-10-20",
        finalPayPeriodEndingDate: "2026-10-30",
      },
    });
    const { warnings } = buildRoeExtractXml(input, HEADER);
    expect(
      warnings.some((w) => w.includes("Block 12") && w.includes("last day of the month")),
    ).toBe(true);
  });
});

// ─── Blocks 14 / 16 / 18 ─────────────────────────────────────────────────────

describe("buildRoeExtractXml — Blocks 14/16/18", () => {
  it("composes the Block 16 XML code from reason + sub-reason (Table 16.1)", () => {
    const { xml } = buildRoeExtractXml(
      makeInput({ reasonCode: "E", reasonSubCode: "02" }),
      HEADER,
    );
    expect(xml).toContain("<B16><CD>E02</CD>");
    const bare = buildRoeExtractXml(makeInput({ reasonCode: "A" }), HEADER);
    expect(bare.xml).toContain("<B16><CD>A00</CD>");
  });

  it("warns when expected recall is Y without a date", () => {
    const { xml, warnings } = buildRoeExtractXml(
      makeInput({ expectedRecall: { cd: "Y" } }),
      HEADER,
    );
    expect(xml).toContain("<B14><CD>Y</CD></B14>");
    expect(warnings.some((w) => w.includes("Block 14"))).toBe(true);
  });

  it("warns when expected recall is Y with a forbidden reason (E/G/M)", () => {
    const { warnings } = buildRoeExtractXml(
      makeInput({
        reasonCode: "E",
        expectedRecall: { cd: "Y", date: "2027-01-15" },
      }),
      HEADER,
    );
    expect(
      warnings.some((w) => w.includes("Block 14") && w.includes("not allowed")),
    ).toBe(true);
  });

  it("emits the recall date when code Y carries one", () => {
    const { xml, warnings } = buildRoeExtractXml(
      makeInput({ expectedRecall: { cd: "Y", date: "2027-02-01" } }),
      HEADER,
    );
    expect(xml).toContain("<B14><CD>Y</CD><DT>2027-02-01</DT></B14>");
    expect(warnings.filter((w) => w.includes("Block 14"))).toEqual([]);
  });

  it('throws for reason code "K" without Block 18 comments', () => {
    expect(() =>
      buildRoeExtractXml(makeInput({ reasonCode: "K" }), HEADER),
    ).toThrow(/Block 18 comments are mandatory/);
  });

  it('emits B18 when reason code "K" carries comments', () => {
    const { xml } = buildRoeExtractXml(
      makeInput({ reasonCode: "K", comments: "Change of payroll frequency." }),
      HEADER,
    );
    expect(xml).toContain("<CD>K00</CD>");
    expect(xml).toContain("<B18>Change of payroll frequency.</B18>");
  });
});

// ─── Block 17 / 19 ───────────────────────────────────────────────────────────

describe("buildRoeExtractXml — Blocks 17/19", () => {
  it('omits the amount for vacation code "1" (included with each pay)', () => {
    const { xml } = buildRoeExtractXml(
      makeInput({ vacationPay: { cd: "1", amount: 500 } }),
      HEADER,
    );
    expect(xml).toContain('<B17A><VP nbr="1"><CD>1</CD></VP></B17A>');
  });

  it('throws for vacation code "3" without both leave dates', () => {
    expect(() =>
      buildRoeExtractXml(
        makeInput({ vacationPay: { cd: "3", amount: 1200 } }),
        HEADER,
      ),
    ).toThrow(/code "3"/);
    expect(() =>
      buildRoeExtractXml(
        makeInput({
          vacationPay: { cd: "3", amount: 1200, startDate: "2026-11-02" },
        }),
        HEADER,
      ),
    ).toThrow(/code "3"/);
  });

  it('emits vacation code "3" with dates and amount', () => {
    const { xml } = buildRoeExtractXml(
      makeInput({
        vacationPay: {
          cd: "3",
          startDate: "2026-11-02",
          endDate: "2026-11-13",
          amount: 1200,
        },
      }),
      HEADER,
    );
    expect(xml).toContain(
      '<VP nbr="1"><CD>3</CD><SDT>2026-11-02</SDT><EDT>2026-11-13</EDT><AMT>1200.00</AMT></VP>',
    );
  });

  it('throws for vacation code "2" without an amount', () => {
    expect(() =>
      buildRoeExtractXml(makeInput({ vacationPay: { cd: "2" } }), HEADER),
    ).toThrow(/requires an amount/);
  });

  it("emits statutory holidays numbered from 1 and throws past 10", () => {
    const { xml } = buildRoeExtractXml(
      makeInput({
        statutoryHolidays: [
          { date: "2026-12-25", amount: 200 },
          { date: "2027-01-01", amount: 200 },
        ],
      }),
      HEADER,
    );
    expect(xml).toContain(
      '<B17B><SH nbr="1"><DT>2026-12-25</DT><AMT>200.00</AMT></SH>' +
        '<SH nbr="2"><DT>2027-01-01</DT><AMT>200.00</AMT></SH></B17B>',
    );
    const eleven = Array.from({ length: 11 }, (_, i) => ({
      date: addDays("2026-12-25", i),
      amount: 100,
    }));
    expect(() =>
      buildRoeExtractXml(makeInput({ statutoryHolidays: eleven }), HEADER),
    ).toThrow(/at most 10/);
  });

  it("throws for more than 3 other monies entries", () => {
    const four = [
      { cd: "E", amount: 1000 },
      { cd: "Y", amount: 500 },
      { cd: "G", amount: 100 },
      { cd: "H", amount: 100 },
    ];
    expect(() =>
      buildRoeExtractXml(makeInput({ otherMonies: four }), HEADER),
    ).toThrow(/at most 3/);
  });

  it("expands online-entry other-monies codes to Table 17C.1 XML codes", () => {
    const { xml } = buildRoeExtractXml(
      makeInput({
        otherMonies: [
          { cd: "E", amount: 5000 },
          { cd: "B05", amount: 250 },
          { cd: "U12" },
        ],
      }),
      HEADER,
    );
    expect(xml).toContain('<OM nbr="1"><CD>E00</CD><AMT>5000.00</AMT></OM>');
    expect(xml).toContain('<OM nbr="2"><CD>B05</CD><AMT>250.00</AMT></OM>');
    expect(xml).toContain('<OM nbr="3"><CD>U12</CD></OM>');
  });

  it('throws for bare "B"/"U" other-monies codes (no default XML subtype)', () => {
    expect(() =>
      buildRoeExtractXml(
        makeInput({ otherMonies: [{ cd: "B", amount: 100 }] }),
        HEADER,
      ),
    ).toThrow(/B05–B11/);
  });

  it("emits special payments with cd attribute and period", () => {
    const { xml } = buildRoeExtractXml(
      makeInput({
        specialPayments: [
          {
            cd: "PSL01",
            startDate: "2026-10-19",
            endDate: "2026-10-30",
            amount: 800,
            period: "W",
          },
        ],
      }),
      HEADER,
    );
    expect(xml).toContain(
      '<B19><SP cd="PSL01"><SDT>2026-10-19</SDT><EDT>2026-10-30</EDT><AMT>800.00</AMT><PRD>W</PRD></SP></B19>',
    );
  });
});

// ─── buildRoePeriods ─────────────────────────────────────────────────────────

describe("buildRoePeriods", () => {
  it("sorts most-recent-first and applies the ei > 0 insurable fallback", () => {
    const { periods, zeroHourPeriods } = buildRoePeriods([
      { payDate: "2026-10-02", hours: 80, gross: 1600, ei: 25.5 },
      { payDate: "2026-10-30", hours: 80, gross: 1600, ei: 25.5 },
      { payDate: "2026-10-16", hours: 0, gross: 400, ei: 0 },
    ]);
    expect(periods.map((p) => p.periodEnd)).toEqual([
      "2026-10-30",
      "2026-10-16",
      "2026-10-02",
    ]);
    // ei > 0 → gross counts as insurable; ei = 0 → 0.
    expect(periods[0]!.insurableEarnings).toBe(1600);
    expect(periods[1]!.insurableEarnings).toBe(0);
    expect(periods[1]!.insurableHours).toBe(0);
    expect(zeroHourPeriods).toBe(1);
  });

  it("prefers stored insurableEarnings over the ei > 0 fallback", () => {
    const { periods } = buildRoePeriods([
      { payDate: "2026-10-30", hours: 80, gross: 3000, ei: 0, insurableEarnings: 2970 },
      { payDate: "2026-10-16", hours: 80, gross: 3000, ei: 40, insurableEarnings: 2900 },
    ]);
    expect(periods[0]!.insurableEarnings).toBe(2970);
    expect(periods[1]!.insurableEarnings).toBe(2900);
  });

  it("surfaces every zero-hour period instead of hiding the old default-0 bug", () => {
    const { periods, zeroHourPeriods } = buildRoePeriods([
      { payDate: "2026-10-30", hours: 0, gross: 0, ei: 0 },
      { payDate: "2026-10-16", hours: 0, gross: 0, ei: 0 },
      { payDate: "2026-10-02", hours: 37.5, gross: 750, ei: 12 },
    ]);
    expect(zeroHourPeriods).toBe(2);
    expect(periods[2]!.insurableHours).toBe(37.5);
  });

  it("feeds the serializer end-to-end (helper output → 15C order)", () => {
    const { periods } = buildRoePeriods([
      { payDate: "2026-10-16", hours: 80, gross: 1600, ei: 25 },
      { payDate: "2026-10-30", hours: 80, gross: 1700, ei: 27 },
    ]);
    const { xml } = buildRoeExtractXml(makeInput({ periods }), HEADER);
    const pps = ppAmounts(xml);
    expect(pps[0]!.amt).toBe("1700.00");
    expect(pps[1]!.amt).toBe("1600.00");
    expect(block15A(xml)).toBe("160");
  });
});
