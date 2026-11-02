/**
 * Wave 2 wiring — lib/actions/t4.ts assembly over the PR #13 filing modules.
 *
 * Prisma/session are mocked (same pattern as the payroll tests); the filing
 * modules and the AES-256-GCM encryption are REAL, so the SIN boundary is
 * exercised end to end: the encrypted SIN decrypts only inside exportT4Xml.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.ENCRYPTION_KEY = "ab".repeat(32); // 64 hex chars = 32 bytes (test-only key)

const h = vi.hoisted(() => ({
  company: null as null | Record<string, unknown>,
  payRuns: [] as unknown[],
  ledgers: [] as Array<Record<string, unknown>>,
  payRunWhere: null as null | Record<string, unknown>,
}));

vi.mock("@/lib/session", () => ({
  requireCompany: async () => ({ id: "user_1", email: "a@b.c", companyId: "co_1" }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: { findUnique: async () => h.company },
    payRun: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        h.payRunWhere = args.where;
        return h.payRuns;
      },
    },
    ytdLedger: {
      findMany: async (args: { where: { employeeId: { in: string[] }; year: number } }) =>
        h.ledgers.filter(
          (l) => args.where.employeeId.in.includes(l.employeeId as string) && l.year === args.where.year,
        ),
    },
  },
}));

import { getT4Report, exportT4Xml } from "@/lib/actions/t4";
import { encrypt } from "@/lib/encryption";

const AB_SIN = "123456789";
const QC_SIN = "987654321";

function item(overrides: Record<string, unknown> = {}) {
  return {
    employeeId: "e_ab",
    gross: 90000,
    cpp: 3867.5,
    cpp2: 188.2,
    qpp: 0,
    qpp2: 0,
    qpip: 0,
    ei: 1049.12,
    federalTax: 12000,
    provincialTax: 6000,
    employerCpp: 3867.5,
    employerCpp2: 188.2,
    employerEi: 1468.77,
    // Deliberately gross-based snapshots: the YtdLedger (65700 / 71300)
    // must win for boxes 24/26, proving the capped source is used.
    ytdInsurable: 90000,
    ytdPensionable: 90000,
    ...overrides,
  };
}

function fixtures() {
  h.company = { name: "Acme & Sons Inc", businessNumber: "123456789" };
  h.payRuns = [
    {
      id: "run_1",
      payDate: "2026-12-15",
      items: [
        {
          ...item(),
          employee: {
            id: "e_ab",
            firstName: "Ann",
            lastName: "Alberta",
            province: "AB",
            sinEncrypted: encrypt(AB_SIN),
            addressLine1: "123 Main St",
            addressLine2: null,
            city: "Calgary",
            postalCode: "T2X1V4",
          },
        },
        {
          ...item({
            employeeId: "e_qc",
            gross: 60000,
            // QC dual-write: cpp/cpp2 hold the same QPP amounts as qpp/qpp2.
            cpp: 4100.25,
            cpp2: 200.1,
            qpp: 4100.25,
            qpp2: 200.1,
            qpip: 315.4,
            ei: 800,
            federalTax: 11000,
            provincialTax: 9500, // Québec tax — must NOT land in box 22
            employerCpp: 4100.25, // employer's QPP share for QC runs
            employerCpp2: 200.1,
            employerEi: 1120,
            // No YtdLedger row for QC → these last-item snapshots are the fallback.
            ytdInsurable: 55000,
            ytdPensionable: 58000,
          }),
          employee: {
            id: "e_qc",
            firstName: "Quinn",
            lastName: "Quebec",
            province: "QC",
            sinEncrypted: encrypt(QC_SIN),
            addressLine1: "1 Rue Sainte-Catherine",
            addressLine2: null,
            city: "Montréal",
            postalCode: "H2X1Y6",
          },
        },
      ],
    },
  ];
  h.ledgers = [
    { employeeId: "e_ab", year: 2026, insurableEarnings: 65700, pensionableEarnings: 71300, cpp: 3867.5, cpp2: 188.2, ei: 1049.12 },
  ];
  h.payRunWhere = null;
}

beforeEach(fixtures);

const transmitter = {
  contactName: "Jane Doe",
  areaCode: "403",
  phone: "555-1234",
  email: "jane@example.com",
};

describe("getT4Report — assembly over computeT4Slip", () => {
  it("scopes to FINALIZED runs in the requested year", async () => {
    await getT4Report(2026);
    expect(h.payRunWhere).toMatchObject({
      companyId: "co_1",
      status: "FINALIZED",
      payDate: { startsWith: "2026" },
    });
  });

  it("non-QC: boxes tie to item sums, with 24/26 from the CAPPED YtdLedger — not gross", async () => {
    const report = await getT4Report(2026);
    const slip = report.slips.find((s) => s.employeeId === "e_ab")!;
    expect(slip.box14).toBe(90000);
    expect(slip.box16).toBe(3867.5);
    expect(slip.box16A).toBe(188.2);
    expect(slip.box18).toBe(1049.12);
    expect(slip.box22).toBe(18000); // federal + provincial
    // Regression for the old bug: gross is 90000 but insurable capped at 65700.
    expect(slip.box24).toBe(65700);
    expect(slip.box26).toBe(71300);
    expect(slip.box55).toBe(0);
    expect(slip.box56).toBe(0);
    expect(slip.payPeriods).toBe(1);
  });

  it("QC: box 22 excludes Québec tax, 55/56 come from qpip + the QPIP cap, 24/26 fall back to the last item snapshot", async () => {
    const report = await getT4Report(2026);
    const slip = report.slips.find((s) => s.employeeId === "e_qc")!;
    expect(slip.box14).toBe(60000);
    expect(slip.box22).toBe(11000); // federal only — the 9500 Québec tax is excluded
    expect(slip.box55).toBe(315.4);
    expect(slip.box56).toBe(60000); // min(gross 60000, QPIP 2026 cap 103000)
    expect(slip.box24).toBe(55000); // fallback: last item's ytdInsurable
    expect(slip.box26).toBe(58000); // fallback: last item's ytdPensionable
    // QPP lives in module boxes 17/17A, which the legacy shape does not carry;
    // the dual-written cpp duplicates must NOT leak into box 16.
    expect(slip.box16).toBe(0);
    expect(slip.box16A).toBe(0);
  });

  it("QC box 56 is capped at the QPIP 2026 maximum insurable earnings (103000)", async () => {
    const run = h.payRuns[0] as { items: Array<Record<string, unknown>> };
    run.items[1]!.gross = 150000;
    const report = await getT4Report(2026);
    const slip = report.slips.find((s) => s.employeeId === "e_qc")!;
    expect(slip.box56).toBe(103000);
  });

  it("totals keep the legacy shape and sum the slips", async () => {
    const report = await getT4Report(2026);
    expect(report.totals.employees).toBe(2);
    expect(report.totals.box14).toBe(150000);
    expect(report.totals.box16).toBe(3867.5); // AB CPP only — QPP is not folded in
    expect(report.totals.box22).toBe(29000); // 18000 + 11000 (QC federal only)
    expect(report.totals.box24).toBe(65700 + 55000);
    expect(report.totals.box26).toBe(71300 + 58000);
  });

  it("contains NO real SIN anywhere — neither plaintext nor ciphertext", async () => {
    const report = await getT4Report(2026);
    const json = JSON.stringify(report);
    expect(json).not.toContain(AB_SIN);
    expect(json).not.toContain(QC_SIN);
    for (const slip of report.slips) expect(slip.sinMasked).toBe("•••-•••-•••");
    // The stored ciphertext must not leak into the report either.
    const abItem = (h.payRuns[0] as { items: Array<{ employee: { sinEncrypted: string } }> }).items[0]!;
    expect(json).not.toContain(abItem.employee.sinEncrypted);
  });
});

describe("exportT4Xml", () => {
  it("rejects a missing transmitter email before building (T619 schema-required)", async () => {
    await expect(exportT4Xml(2026, { ...transmitter, email: "  " })).rejects.toThrow(/email is required/i);
    await expect(exportT4Xml(2026, { ...transmitter, email: "" })).rejects.toThrow(/T619/);
  });

  it("rejects when the company business number is not set", async () => {
    h.company = { name: "Acme & Sons Inc", businessNumber: null };
    await expect(exportT4Xml(2026, transmitter)).rejects.toThrow(/business number/i);
  });

  it("produces a <Submission> whose slip count equals the summary count, with bn15 derived from the 9-digit BN", async () => {
    const { filename, content } = await exportT4Xml(2026, transmitter);
    expect(filename).toBe("T4-2026.xml");
    expect(content).toContain("<Submission");
    expect(content).toContain("<bn15>123456789RP0001</bn15>");
    expect(content).toContain("<cntc_email_area>jane@example.com</cntc_email_area>");

    const slipCount = (content.match(/<T4Slip>/g) ?? []).length;
    const summaryCount = Number(content.match(/<slp_cnt>(\d+)<\/slp_cnt>/)![1]);
    expect(slipCount).toBe(2);
    expect(summaryCount).toBe(slipCount);
  });

  it("carries the decrypted SINs and the module's QC rules into the XML", async () => {
    const { content } = await exportT4Xml(2026, transmitter);
    expect(content).toContain(`<sin>${AB_SIN}</sin>`);
    expect(content).toContain(`<sin>${QC_SIN}</sin>`);
    // QC slip: QPP elements, QPIP boxes, federal-only box 22.
    expect(content).toContain("<qpp_cntrb_amt>4100.25</qpp_cntrb_amt>");
    expect(content).toContain("<prov_pip_amt>315.40</prov_pip_amt>");
    expect(content).toContain("<prov_insu_ern_amt>60000.00</prov_insu_ern_amt>");
    expect(content).toContain("<itx_ddct_amt>11000.00</itx_ddct_amt>");
    // Summary CPP totals exclude QPP — employee AND employer side.
    expect(content).toContain("<tot_empe_cpp_amt>3867.50</tot_empe_cpp_amt>");
    expect(content).toContain("<tot_empr_cpp_amt>3867.50</tot_empr_cpp_amt>");
    // Capped box 24 for the AB slip, never gross.
    expect(content).toContain("<ei_insu_ern_amt>65700.00</ei_insu_ern_amt>");
  });

  it("uses an already-15-char business number as-is", async () => {
    h.company = { name: "Acme & Sons Inc", businessNumber: "123456789RP0002" };
    const { content } = await exportT4Xml(2026, transmitter);
    expect(content).toContain("<bn15>123456789RP0002</bn15>");
    expect(content).toContain("<bn>123456789RP0002</bn>");
  });
});
