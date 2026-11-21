/**
 * Tests for the T4A filing modules (improvement plan Phase 1, item 7a):
 *   src/lib/filings/t4a-boxes.ts — box catalogue, payment-tag aggregation,
 *     slip computation, summary totals, tie-out validation
 *   src/lib/filings/t4a-xml.ts   — CRA XML serializer
 *
 * Sources: CRA schema package xmlschm1-27-1 (t4a.xsd) and CRA's official
 * T4A XML specification page (2026V2). Element/code expectations below
 * are taken from those documents, not from the implementation.
 */
import { describe, it, expect } from "vitest";
import {
  T4A_BOXES,
  aggregateT4aPayments,
  computeT4aSlip,
  computeT4aSummary,
  validateT4aSummary,
  type T4aPayeeYearData,
  type T4aSlip,
} from "../src/lib/filings/t4a-boxes";
import { buildT4aXml, type T4aSubmissionInput } from "../src/lib/filings/t4a-xml";
import { computeT4aSummary as recompute } from "../src/lib/filings/t4a-boxes";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function contractor(overrides: Partial<T4aPayeeYearData> = {}): T4aPayeeYearData {
  return {
    payeeType: "INDIVIDUAL",
    surname: "Nguyen",
    givenName: "Linh",
    sin: "123456789",
    addressLine1: "88 Pine Cres",
    city: "Edmonton",
    province: "AB",
    postalCode: "T6H2K4",
    payments: [
      { boxCode: "048", amount: 10000, incomeTaxDeducted: 0 },
      { boxCode: "048", amount: 5000, incomeTaxDeducted: 500 },
      { boxCode: "028", amount: 250 },
    ],
    ...overrides,
  };
}

function businessPayee(overrides: Partial<T4aPayeeYearData> = {}): T4aPayeeYearData {
  return {
    payeeType: "BUSINESS",
    businessName: "Prairie Peak Renovations Ltd.",
    recipientBn: "123456789RT0001",
    city: "Calgary",
    province: "AB",
    payments: [{ boxCode: "048", amount: 42000 }],
    ...overrides,
  };
}

function pensioner(overrides: Partial<T4aPayeeYearData> = {}): T4aPayeeYearData {
  return {
    payeeType: "INDIVIDUAL",
    surname: "Okafor",
    givenName: "Adaeze",
    sin: "987654321",
    dentalBenefitsCode: 3,
    payments: [
      { boxCode: "016", amount: 1200 },
      { boxCode: "016", amount: 1200 },
      { boxCode: "034", amount: 900 },
    ],
    ...overrides,
  };
}

function submissionFor(
  slips: T4aSlip[],
  overrides: Partial<T4aSubmissionInput> = {},
): T4aSubmissionInput {
  return {
    transmitter: {
      accountNumber15: "123456789RP0001",
      submissionRefId: "AbCdEfGh",
      language: "E",
      name1: "Nexvar Lab Inc",
      countryCode: "CAN",
      contact: { name: "Jane Doe", areaCode: "403", phone: "555-1234", email: "jane@example.com" },
    },
    payer: {
      bn15: "123456789RP0001",
      name1: "Acme & Sons Inc",
      address: { line1: "1 Corp Way", city: "Calgary", province: "AB", countryCode: "CAN", postalCode: "T2P0A0" },
      contact: { name: "Jane Doe", areaCode: "403", phone: "5551234" },
    },
    taxYear: 2026,
    slips,
    summary: recompute(slips),
    ...overrides,
  };
}

function expectWellFormed(xml: string) {
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  expect(xml).not.toMatch(/<([A-Za-z_][\w.-]*)><\/\1>/); // no empty elements
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

describe("T4A_BOXES catalogue", () => {
  it("codes are unique and every element exists in t4a.xsd", () => {
    const codes = T4A_BOXES.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
    // Element names per t4a.xsd T4aAmtType / T4AOtherInfoGroup.
    const xsdElements = new Set([
      "pens_spran_amt", "lsp_amt", "self_empl_cmsn_amt", "annty_amt", "fee_or_oth_srvc_amt",
      "oth_incamt", "ptrng_aloc_amt", "rpp_past_srvc_amt", "padj_amt", "resp_aip_amt",
      "resp_educt_ast_amt", "chrty_dons_amt", "rsch_grnt_amt", "brsy_amt", "dth_ben_amt",
    ]);
    for (const b of T4A_BOXES) expect(xsdElements.has(b.xmlElement)).toBe(true);
  });

  it("box 048 is fees for services in <T4A_AMT> (design §6.1.3)", () => {
    const fees = T4A_BOXES.find((b) => b.code === "048");
    expect(fees?.xmlElement).toBe("fee_or_oth_srvc_amt");
    expect(fees?.kind).toBe("AMT");
    expect(fees?.summaryField).toBe("totalFeesForServices");
  });
});

// ─── Aggregation ─────────────────────────────────────────────────────────────

describe("aggregateT4aPayments — tagging → boxes", () => {
  it("sums payments sharing a code and totals the withholding into box 022", () => {
    const agg = aggregateT4aPayments(contractor().payments);
    expect(agg.amounts.get("048")).toBe(15000);
    expect(agg.amounts.get("028")).toBe(250);
    expect(agg.incomeTaxDeducted).toBe(500);
    expect(agg.paymentCount).toBe(3);
  });

  it("rejects an unknown box code loudly (never drops money)", () => {
    expect(() => aggregateT4aPayments([{ boxCode: "999", amount: 10 }])).toThrow(/not in the T4A catalogue/);
  });

  it("rejects negative and non-finite amounts", () => {
    expect(() => aggregateT4aPayments([{ boxCode: "048", amount: -1 }])).toThrow(/must not be negative/);
    expect(() => aggregateT4aPayments([{ boxCode: "048", amount: NaN }])).toThrow(/finite/);
    expect(() => aggregateT4aPayments([{ boxCode: "048", amount: 10, incomeTaxDeducted: -5 }])).toThrow(/must not be negative/);
  });
});

// ─── Slip computation ────────────────────────────────────────────────────────

describe("computeT4aSlip", () => {
  it("contractor: fees land in box 048, withholding in box 022, 028 in other info", () => {
    const slip = computeT4aSlip(contractor());
    expect(slip.box048).toBe(15000);
    expect(slip.box022).toBe(500);
    expect(slip.box016).toBe(0);
    expect(slip.otherInfo).toEqual([{ code: "028", amount: 250 }]);
    expect(slip.sin).toBe("123456789");
    // No BN provided → CRA's prescribed zero placeholder + warning.
    expect(slip.recipientBn).toBe("000000000RC0000");
    expect(slip.warnings.some((w) => w.includes("000000000RC0000"))).toBe(true);
  });

  it("business payee: SIN is zeroes, BN is reported, no individual name", () => {
    const slip = computeT4aSlip(businessPayee());
    expect(slip.sin).toBe("000000000");
    expect(slip.recipientBn).toBe("123456789RT0001");
    expect(slip.businessName).toBe("Prairie Peak Renovations Ltd.");
    expect(slip.surname).toBeUndefined();
  });

  it("individual without a SIN → 000000000 + warning", () => {
    const slip = computeT4aSlip(contractor({ sin: null }));
    expect(slip.sin).toBe("000000000");
    expect(slip.warnings.some((w) => w.includes("SIN was not provided"))).toBe(true);
  });

  it("throws on a malformed recipient BN and on a missing surname/business name", () => {
    expect(() => computeT4aSlip(contractor({ recipientBn: "12345" }))).toThrow(/BN15/);
    expect(() => computeT4aSlip(contractor({ surname: " " }))).toThrow(/surname is required/);
    expect(() => computeT4aSlip(businessPayee({ businessName: "" }))).toThrow(/businessName is required/);
  });

  it("pensioner: box 016 sums, code 034 rides in other info, dental code carried", () => {
    const slip = computeT4aSlip(pensioner());
    expect(slip.box016).toBe(2400);
    expect(slip.otherInfo).toEqual([{ code: "034", amount: 900 }]);
    expect(slip.dentalBenefitsCode).toBe(3);
  });

  it("pension without a recorded dental code → defaults to 1 WITH a warning (box 015 is mandatory with 016)", () => {
    const slip = computeT4aSlip(pensioner({ dentalBenefitsCode: undefined }));
    expect(slip.dentalBenefitsCode).toBe(1);
    expect(slip.warnings.some((w) => w.includes("box 015"))).toBe(true);
  });

  it("no pension → dental code stays absent (element omitted, not defaulted)", () => {
    const slip = computeT4aSlip(contractor());
    expect(slip.dentalBenefitsCode).toBeUndefined();
  });

  it("throws on an out-of-range dental code and a bad RPP number", () => {
    expect(() => computeT4aSlip(pensioner({ dentalBenefitsCode: 7 }))).toThrow(/1–5/);
    expect(() => computeT4aSlip(pensioner({ rppRegistrationNumber: "123" }))).toThrow(/7 digits/);
  });

  it("warns when withholding exceeds total payments", () => {
    const slip = computeT4aSlip(
      contractor({ payments: [{ boxCode: "048", amount: 100, incomeTaxDeducted: 150 }] }),
    );
    expect(slip.warnings.some((w) => w.includes("exceeds the total payments"))).toBe(true);
  });
});

// ─── Summary + tie-out ───────────────────────────────────────────────────────

describe("computeT4aSummary / validateT4aSummary", () => {
  it("totals are the sums of the slips, routed per the catalogue", () => {
    const slips = [computeT4aSlip(contractor()), computeT4aSlip(businessPayee()), computeT4aSlip(pensioner())];
    const totals = computeT4aSummary(slips);
    expect(totals.slipCount).toBe(3);
    expect(totals.totalFeesForServices).toBe(15000 + 42000);
    expect(totals.totalPension).toBe(2400);
    expect(totals.totalOtherIncome).toBe(250);
    expect(totals.totalIncomeTaxDeducted).toBe(500);
    expect(totals.totalPensionAdjustment).toBe(900);
    expect(validateT4aSummary(slips, totals)).toEqual([]);
  });

  it("other-information total EXCLUDES codes with dedicated totals (CRA definition)", () => {
    const slip = computeT4aSlip(
      contractor({
        payments: [
          { boxCode: "028", amount: 100 }, // dedicated: totalOtherIncome
          { boxCode: "030", amount: 200 }, // dedicated: totalPatronageAllocations
          { boxCode: "046", amount: 30 },  // remainder bucket
          { boxCode: "104", amount: 40 },  // remainder bucket
          { boxCode: "106", amount: 50 },  // remainder bucket
        ],
      }),
    );
    const totals = computeT4aSummary([slip]);
    expect(totals.totalOtherIncome).toBe(100);
    expect(totals.totalPatronageAllocations).toBe(200);
    expect(totals.totalOtherInfoAmounts).toBe(120); // 30 + 40 + 50 only
  });

  it("validateT4aSummary names a tampered total", () => {
    const slips = [computeT4aSlip(contractor())];
    const totals = computeT4aSummary(slips);
    const tampered = { ...totals, totalFeesForServices: totals.totalFeesForServices + 1 };
    const problems = validateT4aSummary(slips, tampered);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("fees for services");
  });
});

// ─── XML serializer ──────────────────────────────────────────────────────────

describe("buildT4aXml", () => {
  it("is well-formed with one T619, slips before exactly one summary, summ_cnt 1", () => {
    const xml = buildT4aXml(submissionFor([computeT4aSlip(contractor()), computeT4aSlip(businessPayee())]));
    expectWellFormed(xml);
    expect(xml.match(/<T619>/g)).toHaveLength(1);
    expect(xml.match(/<T4ASummary>/g)).toHaveLength(1);
    expect(xml.match(/<T4ASlip>/g)).toHaveLength(2);
    expect(xml.indexOf("<T4ASlip>")).toBeLessThan(xml.indexOf("<T4ASummary>"));
    expect(xml).toContain("<summ_cnt>1</summ_cnt>");
    expect(xml).toContain("<tx_yr>2026</tx_yr>");
    expect(xml).toContain("<slp_cnt>2</slp_cnt>");
  });

  it("slip <bn> equals summary <bn> and is the RP account", () => {
    const xml = buildT4aXml(submissionFor([computeT4aSlip(contractor())]));
    const bns = [...xml.matchAll(/<bn>([^<]+)<\/bn>/g)].map((m) => m[1]);
    expect(bns.length).toBeGreaterThanOrEqual(2);
    expect(new Set(bns).size).toBe(1);
    expect(bns[0]).toBe("123456789RP0001");
  });

  it("emits the required identity elements with CRA zero placeholders", () => {
    const xml = buildT4aXml(submissionFor([computeT4aSlip(contractor())]));
    expect(xml).toContain("<sin>123456789</sin>");
    expect(xml).toContain("<rcpnt_bn>000000000RC0000</rcpnt_bn>");
    expect(xml).toContain("<RCPNT_NM><snm>Nguyen</snm><gvn_nm>Linh</gvn_nm></RCPNT_NM>");
  });

  it("business slip uses RCPNT_CORP_NM (never RCPNT_NM) and zeroes the SIN", () => {
    const xml = buildT4aXml(submissionFor([computeT4aSlip(businessPayee())]));
    expect(xml).toContain("<RCPNT_CORP_NM><l1_nm>Prairie Peak Renovations Ltd.</l1_nm></RCPNT_CORP_NM>");
    expect(xml).not.toContain("<RCPNT_NM>");
    expect(xml).toContain("<sin>000000000</sin>");
    expect(xml).toContain("<rcpnt_bn>123456789RT0001</rcpnt_bn>");
  });

  it("maps amounts to the t4a.xsd elements and omits zero boxes", () => {
    const xml = buildT4aXml(submissionFor([computeT4aSlip(contractor()), computeT4aSlip(pensioner())]));
    expect(xml).toContain("<fee_or_oth_srvc_amt>15000.00</fee_or_oth_srvc_amt>");
    expect(xml).toContain("<itx_ddct_amt>500.00</itx_ddct_amt>");
    expect(xml).toContain("<pens_spran_amt>2400.00</pens_spran_amt>");
    expect(xml).toContain("<oth_incamt>250.00</oth_incamt>");
    expect(xml).toContain("<padj_amt>900.00</padj_amt>");
    expect(xml).not.toContain("lsp_amt"); // no lump sums anywhere → element absent entirely
    expect(xml).toContain("<payr_dntl_ben_rpt_cd>3</payr_dntl_ben_rpt_cd>");
  });

  it("summary totals in the XML equal the slip sums", () => {
    const slips = [computeT4aSlip(contractor()), computeT4aSlip(businessPayee())];
    const xml = buildT4aXml(submissionFor(slips));
    expect(xml).toContain("<rpt_tot_fee_srvc_amt>57000.00</rpt_tot_fee_srvc_amt>");
    expect(xml).toContain("<totr_incamt>250.00</totr_incamt>");
    expect(xml).toContain("<tot_itx_dedn_amt>500.00</tot_itx_dedn_amt>");
  });

  it("escapes special characters in names", () => {
    const xml = buildT4aXml(submissionFor([computeT4aSlip(businessPayee())]));
    expect(xml).toContain("Acme &amp; Sons Inc");
    expect(xml).not.toContain("Acme & Sons");
  });

  it("BLOCKS filing output when the summary does not tie to the slips", () => {
    const slips = [computeT4aSlip(contractor())];
    const bad = submissionFor(slips, {
      summary: { ...recompute(slips), totalFeesForServices: 1 },
    });
    expect(() => buildT4aXml(bad)).toThrow(/does not tie/);
  });

  it("rejects a non-RP payer account (t4a.xsd types <bn> as bnRPType)", () => {
    const slips = [computeT4aSlip(contractor())];
    const bad = submissionFor(slips, {
      payer: { ...submissionFor(slips).payer, bn15: "123456789RZ0001" },
    });
    expect(() => buildT4aXml(bad)).toThrow(/bnRPType/);
  });

  it("throws on more than 12 other-information entries on one slip", () => {
    const slip = computeT4aSlip(contractor());
    const bloated: T4aSlip = {
      ...slip,
      otherInfo: Array.from({ length: 13 }, () => ({ code: "046", amount: 1 })),
    };
    // Recompute the summary so the tie-out passes and the 12-entry rule
    // is what fires.
    expect(() => buildT4aXml(submissionFor([bloated]))).toThrow(/at most 12/);
  });

  it("throws when there are no slips", () => {
    expect(() => buildT4aXml(submissionFor([], { summary: recompute([]) }))).toThrow(/at least one slip/);
  });
});
