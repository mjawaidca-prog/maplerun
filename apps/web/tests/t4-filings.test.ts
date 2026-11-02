/**
 * Tests for the T4 filing modules:
 *   src/lib/filings/t4-boxes.ts — box calculations (spec §5/§6)
 *   src/lib/filings/t4-xml.ts   — CRA XML serializer (spec §3/§4/§5/§6)
 *
 * Several tests are regressions for the defects in the old
 * lib/actions/t4.ts aggregation (box 24/26 = gross, QPIP always 0,
 * CPP/QPP mixing, Québec tax in box 22).
 */
import { describe, it, expect } from "vitest";
import {
  computeT4Slip,
  computeT4Summary,
  type T4EmployeeYearData,
} from "../src/lib/filings/t4-boxes";
import {
  buildT4Xml,
  generateSubmissionRefId,
  type T4SubmissionInput,
} from "../src/lib/filings/t4-xml";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function baseEmployee(overrides: Partial<T4EmployeeYearData> = {}): T4EmployeeYearData {
  return {
    surname: "Smith",
    givenName: "John",
    initial: "A",
    sin: "123456789",
    addressLine1: "123 Main St",
    city: "Calgary",
    provinceOfResidence: "AB",
    postalCode: "T2X1V4",
    provinceOfEmployment: "AB",
    employmentIncome: 90000,
    cpp: 3867.5,
    cpp2: 188.2,
    ei: 1049.12,
    federalTax: 12000,
    provincialTax: 6000,
    eiInsurableEarnings: 65700, // 2025-style cap, well below the 90000 gross
    cppPensionableEarnings: 71300,
    employerCpp: 3867.5,
    employerCpp2: 188.2,
    employerEi: 1468.77,
    ...overrides,
  };
}

function quebecEmployee(overrides: Partial<T4EmployeeYearData> = {}): T4EmployeeYearData {
  return baseEmployee({
    provinceOfResidence: "QC",
    provinceOfEmployment: "QC",
    city: "Montréal",
    postalCode: "H2X1Y6",
    cpp: 0,
    cpp2: 0,
    qpp: 4100.25,
    qpp2: 200.1,
    qpipPremiums: 315.4,
    qpipInsurableEarnings: 98000,
    eiInsurableEarnings: 65700,
    cppPensionableEarnings: 71300,
    federalTax: 11000,
    provincialTax: 9500, // Québec tax — must NOT land in box 22
    employerCpp: 0,
    employerCpp2: 0,
    ...overrides,
  });
}

function submissionFor(
  slips: ReturnType<typeof computeT4Slip>[],
  overrides: Partial<T4SubmissionInput> = {},
): T4SubmissionInput {
  return {
    transmitter: {
      accountNumber15: "123456789RP0001",
      submissionRefId: "AbCdEfGh",
      language: "E",
      name1: "Nexvar Lab Inc",
      countryCode: "CAN",
      contact: { name: "Jane Doe", areaCode: "403", phone: "555-1234", email: "jane@example.com" },
    },
    employer: {
      bn15: "123456789RP0001",
      name1: "Acme & Sons Inc",
      address: { line1: "1 Corp Way", city: "Calgary", province: "AB", countryCode: "CAN", postalCode: "T2P0A0" },
      contact: { name: "Jane Doe", areaCode: "403", phone: "5551234" },
    },
    taxYear: 2026,
    slips,
    summary: computeT4Summary(slips),
    ...overrides,
  };
}

/** Minimal well-formedness check: balanced tags, single root, no stray text. */
function expectWellFormed(xml: string) {
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  const body = xml.slice(xml.indexOf("?>") + 2);
  const tagRe = /<(\/?)([A-Za-z_][\w.-]*)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>/g;
  const stack: string[] = [];
  let m: RegExpExecArray | null;
  let roots = 0;
  while ((m = tagRe.exec(body)) !== null) {
    const [, closing, name, , selfClosing] = m;
    if (selfClosing) continue;
    if (closing) {
      expect(stack.pop()).toBe(name);
    } else {
      if (stack.length === 0) roots++;
      stack.push(name);
    }
  }
  expect(stack).toEqual([]);
  expect(roots).toBe(1);
  // No unescaped ampersands anywhere in the body.
  expect(body).not.toMatch(/&(?!amp;|lt;|gt;|apos;|quot;)/);
}

// ─── Box calculations ────────────────────────────────────────────────────────

describe("computeT4Slip — boxes 24/26 use capped earnings, never gross", () => {
  it("box24 = capped insurable (65700), not gross (90000) — old-bug regression", () => {
    const slip = computeT4Slip(baseEmployee());
    expect(slip.box14).toBe(90000);
    expect(slip.box24).toBe(65700);
    expect(slip.box26).toBe(71300);
  });

  it("missing capped inputs → 0 + warning, still never gross", () => {
    const slip = computeT4Slip(
      baseEmployee({ eiInsurableEarnings: undefined, cppPensionableEarnings: undefined }),
    );
    expect(slip.box24).toBe(0);
    expect(slip.box26).toBe(0);
    expect(slip.warnings.some((w) => w.includes("box 24"))).toBe(true);
    expect(slip.warnings.some((w) => w.includes("box 26"))).toBe(true);
  });

  it("exempt employees report boxes 24/26 as 0.00 (spec §5.2)", () => {
    const slip = computeT4Slip(baseEmployee({ eiExempt: true, cppExempt: true }));
    expect(slip.box24).toBe(0);
    expect(slip.box26).toBe(0);
    expect(slip.eiExemptCode).toBe(1);
    expect(slip.cppQppExemptCode).toBe(1);
  });
});

describe("computeT4Slip — CPP/QPP separation and Québec tax", () => {
  it("QC slip: QPP lands in boxes 17/17A, CPP boxes stay 0", () => {
    const slip = computeT4Slip(quebecEmployee());
    expect(slip.box16).toBe(0);
    expect(slip.box16A).toBe(0);
    expect(slip.box17).toBe(4100.25);
    expect(slip.box17A).toBe(200.1);
  });

  it("QC slip: box 22 is federal tax only — Québec tax excluded (RL-1)", () => {
    const slip = computeT4Slip(quebecEmployee());
    expect(slip.box22).toBe(11000);
  });

  it("non-QC slip: box 22 combines federal + provincial", () => {
    const slip = computeT4Slip(baseEmployee());
    expect(slip.box22).toBe(18000);
  });

  it("QC slip built from a combined tax figure warns loudly", () => {
    const slip = computeT4Slip(
      quebecEmployee({ federalTax: undefined, provincialTax: undefined, incomeTaxDeducted: 20500 }),
    );
    expect(slip.box22).toBe(20500); // carried, but flagged
    expect(slip.warnings.some((w) => w.includes("COMBINED"))).toBe(true);
  });

  it("CPP supplied for a QC employee is not mixed onto the slip — warning instead", () => {
    const slip = computeT4Slip(quebecEmployee({ cpp: 500, cpp2: 25 }));
    expect(slip.box16).toBe(0);
    expect(slip.box17).toBe(4100.25);
    expect(slip.warnings.some((w) => w.includes("never mixed"))).toBe(true);
  });

  it("QPP supplied for a non-QC employee is not mixed onto the slip — warning instead", () => {
    const slip = computeT4Slip(baseEmployee({ qpp: 700 }));
    expect(slip.box17).toBe(0);
    expect(slip.box16).toBe(3867.5);
    expect(slip.warnings.some((w) => w.includes("never mixed"))).toBe(true);
  });
});

describe("computeT4Slip — QPIP boxes 55/56", () => {
  it("uses the supplied QPIP premiums and insurable earnings", () => {
    const slip = computeT4Slip(quebecEmployee());
    expect(slip.box55).toBe(315.4);
    expect(slip.box56).toBe(98000);
  });

  it("unknown QPIP (columns not yet captured) → 0 + warning, never silent", () => {
    const slip = computeT4Slip(
      quebecEmployee({ qpipPremiums: undefined, qpipInsurableEarnings: undefined }),
    );
    expect(slip.box55).toBe(0);
    expect(slip.box56).toBe(0);
    expect(slip.warnings.some((w) => w.includes("box 55") && w.includes("unknown"))).toBe(true);
    expect(slip.warnings.some((w) => w.includes("box 56") && w.includes("unknown"))).toBe(true);
  });

  it("non-QC slips always have boxes 55/56 = 0", () => {
    const slip = computeT4Slip(baseEmployee());
    expect(slip.box55).toBe(0);
    expect(slip.box56).toBe(0);
  });
});

describe("computeT4Slip — defaults, rounding, validation", () => {
  it("defaults dental code to 1 and exempt codes to 0", () => {
    const slip = computeT4Slip(baseEmployee());
    expect(slip.dentalBenefitsCode).toBe(1);
    expect(slip.cppQppExemptCode).toBe(0);
    expect(slip.eiExemptCode).toBe(0);
    expect(slip.qpipExemptCode).toBe(0);
  });

  it("rounds all money to 2 decimals", () => {
    const slip = computeT4Slip(baseEmployee({ employmentIncome: 100.004, ei: 1.0051 }));
    expect(slip.box14).toBe(100);
    expect(slip.box18).toBe(1.01);
  });

  it("throws on negative amounts (data corruption is loud, never clamped)", () => {
    expect(() => computeT4Slip(baseEmployee({ cpp: -1 }))).toThrow(/must not be negative/);
    expect(() => computeT4Slip(baseEmployee({ eiInsurableEarnings: -5 }))).toThrow();
    expect(() => computeT4Slip(baseEmployee({ employmentIncome: Number.NaN }))).toThrow();
  });

  it("throws on an out-of-range dental code", () => {
    expect(() => computeT4Slip(baseEmployee({ dentalBenefitsCode: 9 }))).toThrow(/box 45/);
  });

  it("missing SIN → 000000000 + warning (spec §5.1)", () => {
    const slip = computeT4Slip(baseEmployee({ sin: null }));
    expect(slip.sin).toBe("000000000");
    expect(slip.warnings.some((w) => w.includes("SIN"))).toBe(true);
  });

  it("accepts a formatted SIN and strips it to digits", () => {
    const slip = computeT4Slip(baseEmployee({ sin: "123-456-789" }));
    expect(slip.sin).toBe("123456789");
  });
});

describe("computeT4Summary (spec §6)", () => {
  it("totals are the sums of the slips, and CPP totals exclude QPP", () => {
    const ab = computeT4Slip(baseEmployee());
    const qc = computeT4Slip(quebecEmployee());
    const summary = computeT4Summary([ab, qc]);
    expect(summary.slipCount).toBe(2);
    expect(summary.totalEmploymentIncome).toBe(180000);
    expect(summary.totalEmployeeCpp).toBe(3867.5); // AB only — QC's QPP excluded
    expect(summary.totalEmployeeCpp2).toBe(188.2);
    expect(summary.totalEmployeeQpp).toBe(4100.25); // informational, not in T4_TAMT
    expect(summary.totalEmployeeQpp2).toBe(200.1);
    expect(summary.totalQpipPremiums).toBe(315.4);
    expect(summary.totalIncomeTaxDeducted).toBe(18000 + 11000); // QC slip contributes federal only
  });

  it("employer totals come from the per-slip employer amounts", () => {
    const summary = computeT4Summary([computeT4Slip(baseEmployee())]);
    expect(summary.totalEmployerCpp).toBe(3867.5);
    expect(summary.totalEmployerCpp2).toBe(188.2);
    expect(summary.totalEmployerEi).toBe(1468.77);
  });
});

// ─── XML serializer ──────────────────────────────────────────────────────────

describe("buildT4Xml — structure (spec §3)", () => {
  const xml = buildT4Xml(submissionFor([computeT4Slip(baseEmployee())]));

  it("is well-formed XML with the CRA declaration and root", () => {
    expectWellFormed(xml);
    expect(xml).toContain("<Submission");
    expect(xml).toContain('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
  });

  it("has exactly one T619, one Return/T4, slips before exactly one summary", () => {
    expect(xml.match(/<T619>/g)).toHaveLength(1);
    expect(xml.match(/<T4Slip>/g)).toHaveLength(1);
    expect(xml.match(/<T4Summary>/g)).toHaveLength(1);
    expect(xml.indexOf("<T619>")).toBeLessThan(xml.indexOf("<Return>"));
    expect(xml.indexOf("<T4Slip>")).toBeLessThan(xml.indexOf("<T4Summary>"));
  });

  it("summ_cnt is 1 and the submission ref id is emitted", () => {
    expect(xml).toContain("<summ_cnt>1</summ_cnt>");
    expect(xml).toContain("<sbmt_ref_id>AbCdEfGh</sbmt_ref_id>");
  });

  it("slip <bn> equals summary <bn>", () => {
    const bns = [...xml.matchAll(/<bn>([^<]+)<\/bn>/g)].map((m) => m[1]);
    expect(bns.length).toBeGreaterThanOrEqual(2);
    expect(new Set(bns).size).toBe(1);
    expect(bns[0]).toBe("123456789RP0001");
    expect(xml).toContain("<bn15>123456789RP0001</bn15>");
  });

  it("report type is O (original) on slip and summary", () => {
    expect(xml.match(/<rpt_tcd>O<\/rpt_tcd>/g)).toHaveLength(2);
  });

  it("emits the mandatory dental-benefits code (box 45) on the slip", () => {
    expect(xml).toContain("<empr_dntl_ben_rpt_cd>1</empr_dntl_ben_rpt_cd>");
  });

  it("formats amounts with a decimal point, 2 decimals, no commas", () => {
    expect(xml).toContain("<empt_incamt>90000.00</empt_incamt>");
    expect(xml).toContain("<ei_insu_ern_amt>65700.00</ei_insu_ern_amt>");
    expect(xml).toContain("<cpp_qpp_ern_amt>71300.00</cpp_qpp_ern_amt>");
    expect(xml).not.toMatch(/\d,\d/);
  });
});

describe("buildT4Xml — omit-empty rule (spec §3)", () => {
  it("emits NO empty elements anywhere", () => {
    const xml = buildT4Xml(submissionFor([computeT4Slip(baseEmployee())]));
    expect(xml).not.toMatch(/<([A-Za-z_][\w.-]*)><\/\1>/);
    expect(xml).not.toMatch(/<([A-Za-z_][\w.-]*)\/>/);
  });

  it("omits optional amounts that are absent (no union dues → no <unn_dues_amt>)", () => {
    const xml = buildT4Xml(submissionFor([computeT4Slip(baseEmployee())]));
    expect(xml).not.toContain("unn_dues_amt");
    expect(xml).not.toContain("chrty_dons_amt");
    expect(xml).not.toContain("padj_amt");
    expect(xml).not.toContain("OTH_INFO");
    expect(xml).not.toContain("empt_cd"); // employment code is opt-in, default OFF
  });

  it("emits optional amounts that are present", () => {
    const slip = computeT4Slip(
      baseEmployee({ unionDues: 250.5, charitableDonations: 100, pensionAdjustment: 5000, rppContributions: 3000, rppRegistrationNumber: "1234567" }),
    );
    const xml = buildT4Xml(submissionFor([slip]));
    expect(xml).toContain("<unn_dues_amt>250.50</unn_dues_amt>");
    expect(xml).toContain("<chrty_dons_amt>100.00</chrty_dons_amt>");
    expect(xml).toContain("<padj_amt>5000.00</padj_amt>");
    expect(xml).toContain("<rpp_cntrb_amt>3000.00</rpp_cntrb_amt>");
    expect(xml).toContain("<rpp_dpsp_rgst_nbr>1234567</rpp_dpsp_rgst_nbr>");
  });

  it("boxes 24/26 are emitted even when 0.00 (schema-required)", () => {
    const slip = computeT4Slip(
      baseEmployee({ eiInsurableEarnings: undefined, cppPensionableEarnings: undefined }),
    );
    const xml = buildT4Xml(submissionFor([slip]));
    expect(xml).toContain("<ei_insu_ern_amt>0.00</ei_insu_ern_amt>");
    expect(xml).toContain("<cpp_qpp_ern_amt>0.00</cpp_qpp_ern_amt>");
  });

  it("summary has no empty fields and omits zero totals", () => {
    const xml = buildT4Xml(submissionFor([computeT4Slip(baseEmployee())]));
    const summaryXml = xml.slice(xml.indexOf("<T4Summary>"));
    expect(summaryXml).not.toMatch(/<([A-Za-z_][\w.-]*)><\/\1>/);
    expect(summaryXml).not.toContain("PPRTR_SIN"); // not supplied → omitted
    expect(summaryXml).not.toContain("fileramendmentnote"); // originals only
  });
});

describe("buildT4Xml — escaping (spec §3)", () => {
  it("escapes & in an employer name", () => {
    const xml = buildT4Xml(submissionFor([computeT4Slip(baseEmployee())]));
    expect(xml).toContain("<l1_nm>Acme &amp; Sons Inc</l1_nm>");
    expect(xml).not.toContain("Acme & Sons");
  });

  it("escapes all five special characters in text", () => {
    const slip = computeT4Slip(baseEmployee({ surname: `O'Brien <&> "x"` }));
    const xml = buildT4Xml(submissionFor([slip]));
    expect(xml).toContain("<snm>O&apos;Brien &lt;&amp;&gt; &quot;x&quot;</snm>");
    expectWellFormed(xml);
  });
});

describe("buildT4Xml — Québec slip", () => {
  const xml = buildT4Xml(submissionFor([computeT4Slip(quebecEmployee())]));

  it("reports QPP elements and NO CPP elements", () => {
    expect(xml).toContain("<qpp_cntrb_amt>4100.25</qpp_cntrb_amt>");
    expect(xml).toContain("<qppe_cntrb_amt>200.10</qppe_cntrb_amt>");
    expect(xml).not.toContain("cpp_cntrb_amt");
    expect(xml).not.toContain("cppe_cntrb_amt");
  });

  it("reports QPIP boxes 55/56 and the PPIP exemption code", () => {
    expect(xml).toContain("<prov_pip_amt>315.40</prov_pip_amt>");
    expect(xml).toContain("<prov_insu_ern_amt>98000.00</prov_insu_ern_amt>");
    expect(xml).toContain("<prov_pip_xmpt_cd>0</prov_pip_xmpt_cd>");
    expect(xml).toContain("<empt_prov_cd>QC</empt_prov_cd>");
  });

  it("box 22 in XML excludes Québec tax, and summary CPP totals exclude QPP", () => {
    expect(xml).toContain("<itx_ddct_amt>11000.00</itx_ddct_amt>");
    expect(xml).not.toContain("tot_empe_cpp_amt"); // the only slip is QC → CPP total is 0 → omitted
  });
});

describe("buildT4Xml — summary totals equal the sum of the slips", () => {
  it("two-slip submission: every emitted total matches a hand sum", () => {
    const slips = [
      computeT4Slip(baseEmployee()),
      computeT4Slip(baseEmployee({ surname: "Roy", employmentIncome: 50000, cpp: 2000, cpp2: 0, ei: 800, federalTax: 7000, provincialTax: 3000 })),
    ];
    const xml = buildT4Xml(submissionFor(slips));
    expect(xml).toContain("<slp_cnt>2</slp_cnt>");
    expect(xml).toContain("<tot_empt_incamt>140000.00</tot_empt_incamt>");
    expect(xml).toContain("<tot_empe_cpp_amt>5867.50</tot_empe_cpp_amt>");
    expect(xml).toContain("<tot_empe_eip_amt>1849.12</tot_empe_eip_amt>");
    expect(xml).toContain("<tot_itx_ddct_amt>28000.00</tot_itx_ddct_amt>");
    expect(xml).toContain("<tot_empr_cpp_amt>7735.00</tot_empr_cpp_amt>");
    expect(xml).toContain("<tot_empr_eip_amt>2937.54</tot_empr_eip_amt>");
  });

  it("throws when the summary was not built from these slips", () => {
    const slips = [computeT4Slip(baseEmployee())];
    const input = submissionFor(slips);
    input.summary = { ...input.summary, slipCount: 99 };
    expect(() => buildT4Xml(input)).toThrow(/slipCount/);
  });
});

describe("buildT4Xml — employment code option", () => {
  it("default OFF: no <empt_cd> even when the slip carries a code", () => {
    const slip = computeT4Slip(baseEmployee({ employmentCode: 15 }));
    const xml = buildT4Xml(submissionFor([slip]));
    expect(xml).not.toContain("empt_cd");
  });

  it("ON: emits <empt_cd>, and box 14 is suppressed for code 11 (spec §5.1)", () => {
    const slip = computeT4Slip(baseEmployee({ employmentCode: 11 }));
    const input = submissionFor([slip]);
    input.options = { includeEmploymentCode: true };
    const xml = buildT4Xml(input);
    expect(xml).toContain("<empt_cd>11</empt_cd>");
    expect(xml).not.toContain("<empt_incamt>"); // slip-level box 14 only; the summary total element is a different tag
  });
});

describe("buildT4Xml — other information (spec §5.3)", () => {
  it("maps codes to elements inside <OTH_INFO>", () => {
    const slip = computeT4Slip(
      baseEmployee({ otherInfo: [{ code: 40, amount: 1200 }, { code: 42, amount: 3000.5 }] }),
    );
    const xml = buildT4Xml(submissionFor([slip]));
    expect(xml).toContain("<OTH_INFO><oth_tx_ben_amt>1200.00</oth_tx_ben_amt><empt_cmsn_amt>3000.50</empt_cmsn_amt></OTH_INFO>");
  });

  it("throws for an unmapped code instead of guessing an element", () => {
    const slip = computeT4Slip(baseEmployee({ otherInfo: [{ code: 38, amount: 100 }] }));
    expect(() => buildT4Xml(submissionFor([slip]))).toThrow(/code 38/);
  });

  it("throws when a slip carries more than 6 other-info entries", () => {
    const slip = computeT4Slip(
      baseEmployee({
        otherInfo: [30, 31, 32, 33, 34, 36, 37].map((code) => ({ code, amount: 10 })),
      }),
    );
    expect(slip.warnings.some((w) => w.includes("at most 6"))).toBe(true);
    expect(() => buildT4Xml(submissionFor([slip]))).toThrow(/at most 6/);
  });
});

describe("buildT4Xml — transmitter variants and validation", () => {
  it("supports a RepID transmitter without an account number", () => {
    const input = submissionFor([computeT4Slip(baseEmployee())]);
    input.transmitter = { ...input.transmitter, accountNumber15: undefined, repId: "A123456" };
    const xml = buildT4Xml(input);
    expect(xml).toContain("<TransmitterRepID><RepID>A123456</RepID></TransmitterRepID>");
    expect(xml).not.toContain("TransmitterAccountNumber");
  });

  it("throws when the employer BN is not an RP payroll account", () => {
    const input = submissionFor([computeT4Slip(baseEmployee())]);
    input.employer = { ...input.employer, bn15: "123456789RT0001" };
    expect(() => buildT4Xml(input)).toThrow(/RP payroll account/);
  });

  it("throws on a malformed submissionRefId and on a missing transmitter email", () => {
    const bad = submissionFor([computeT4Slip(baseEmployee())]);
    bad.transmitter = { ...bad.transmitter, submissionRefId: "abc123" }; // digits + too short
    expect(() => buildT4Xml(bad)).toThrow(/8 alpha/);

    const noEmail = submissionFor([computeT4Slip(baseEmployee())]);
    noEmail.transmitter = {
      ...noEmail.transmitter,
      contact: { name: "Jane Doe", areaCode: "403", phone: "555-1234" },
    };
    expect(() => buildT4Xml(noEmail)).toThrow(/email is required/);
  });

  it("generates a submission ref id when none is supplied", () => {
    const input = submissionFor([computeT4Slip(baseEmployee())]);
    input.transmitter = { ...input.transmitter, submissionRefId: undefined };
    const xml = buildT4Xml(input);
    expect(xml).toMatch(/<sbmt_ref_id>[A-Za-z]{8}<\/sbmt_ref_id>/);
  });
});

describe("generateSubmissionRefId", () => {
  it("returns exactly 8 alpha characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSubmissionRefId()).toMatch(/^[A-Za-z]{8}$/);
    }
  });

  it("is not constant", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateSubmissionRefId()));
    expect(ids.size).toBeGreaterThan(45);
  });
});
