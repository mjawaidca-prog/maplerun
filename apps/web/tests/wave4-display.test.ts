/**
 * Wave 4 display fixes — W4-D3 (Quebec split presentation), W4-D5
 * (banking completeness). The Prairie Peak proof figures are the
 * fixtures: Sophie Tremblay's Quebec run and Erin Callahan's blank
 * bank account. Pure helpers only (payroll-display, pay-stub-data
 * builders, remittance Quebec aggregation, banking rule).
 */
import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");

import {
  employerQpipAmount,
  employerEiPure,
  splitQuebecYtd,
} from "../src/lib/payroll-display";
import { buildDeductionLines, buildEmployerLines, type StubItemShape } from "../src/lib/pay-stub-data";
import { aggregateQuebecRemittances } from "../src/lib/remittance/aggregate";
import {
  parseBankDetails,
  bankDetailsComplete,
  bankDetailsCompleteFromEncrypted,
  bankAccountLast4,
} from "../src/lib/banking";
import { encrypt } from "../src/lib/encryption";

// Sophie Tremblay, Prairie Peak Quebec run (proof values).
const SOPHIE_ITEM = {
  ei: 62.4,
  qpip: 20.64,
  employerEi: 116.26, // EI er 87.36 + QPIP er 28.90, folded by the engine
};

describe("employer QPIP split (W4-D3)", () => {
  it("recovers Sophie's employer QPIP 28.90 and pure employer EI 87.36", () => {
    expect(employerQpipAmount(SOPHIE_ITEM)).toBe(28.9);
    expect(employerEiPure(SOPHIE_ITEM)).toBe(87.36);
  });

  it("is zero for non-Quebec items (no QPIP premium present)", () => {
    expect(employerQpipAmount({ ei: 100, qpip: 0, employerEi: 140 })).toBe(0);
    expect(employerEiPure({ ei: 100, qpip: 0, employerEi: 140 })).toBe(140);
  });
});

describe("splitQuebecYtd (W4-D3)", () => {
  it("splits Sophie's blended snapshots: EI 62.40 / QPIP 20.64, insurable 4,800 / 4,800", () => {
    const split = splitQuebecYtd(
      [{ id: "i1", qpip: 20.64, ytdInsurable: 9600 }],
      "i1",
      83.04, // blended ytdEi snapshot (62.40 + 20.64)
      9600, // blended ytdInsurable snapshot (4,800 + 4,800)
    );
    expect(split.ytdEiPure).toBe(62.4);
    expect(split.ytdQpip).toBe(20.64);
    expect(split.ytdEiInsurable).toBe(4800);
    expect(split.ytdQpipInsurable).toBe(4800);
  });

  it("accumulates across items up to the target and stops there", () => {
    const items = [
      { id: "i1", qpip: 20.64, ytdInsurable: 9600 },
      { id: "i2", qpip: 20.64, ytdInsurable: 19200 },
      { id: "i3", qpip: 20.64, ytdInsurable: 28800 },
    ];
    const split = splitQuebecYtd(items, "i2", 166.08, 19200);
    expect(split.ytdQpip).toBe(41.28);
    expect(split.ytdEiPure).toBe(124.8);
    expect(split.ytdEiInsurable).toBe(9600);
    expect(split.ytdQpipInsurable).toBe(9600);
  });
});

function stubItem(overrides: Partial<StubItemShape> = {}): StubItemShape {
  return {
    gross: 4800, regularPay: 4800, overtimePay: 0, statPay: 0, vacationPay: 0,
    bonus: 0, hours: 173, overtimeHours: 0, statHours: 0,
    vacationBalanceAfterCents: null,
    cpp: 284.02, cpp2: 0, ei: 62.4, qpip: 20.64,
    federalTax: 343.32, provincialTax: 432.95,
    employerCpp: 284.02, employerCpp2: 0, employerEi: 116.26,
    isQuebec: true,
    ...overrides,
  };
}

describe("stub line builders (W4-D3)", () => {
  it("Quebec deductions: QPP / QPP2 / EI / QPIP as separate lines, Quebec Tax label", () => {
    const lines = buildDeductionLines(stubItem(), "Quebec Tax");
    expect(lines.map((l) => [l.label, l.amount])).toEqual([
      ["QPP", 284.02],
      ["QPP2", 0],
      ["EI", 62.4],
      ["QPIP", 20.64],
      ["Federal Tax", 343.32],
      ["Quebec Tax", 432.95],
    ]);
  });

  it("Quebec employer lines split the folded employer EI into EI + QPIP", () => {
    const lines = buildEmployerLines(stubItem());
    expect(lines.map((l) => [l.label, l.amount])).toEqual([
      ["QPP Match", 284.02],
      ["QPP2 Match", 0],
      ["EI (1.4×)", 87.36],
      ["QPIP (employer)", 28.9],
    ]);
  });

  it("non-Quebec lines keep the CPP labels and no QPIP row", () => {
    const item = stubItem({ isQuebec: false, qpip: 0, employerEi: 87.36 });
    expect(buildDeductionLines(item, "Provincial Tax").map((l) => l.label)).toEqual([
      "CPP", "CPP2", "EI", "Federal Tax", "Provincial Tax",
    ]);
    expect(buildEmployerLines(item).map((l) => [l.label, l.amount])).toEqual([
      ["CPP Match", 284.02],
      ["CPP2 Match", 0],
      ["EI (1.4×)", 87.36],
    ]);
  });
});

describe("aggregateQuebecRemittances (W4-D3)", () => {
  it("Sophie's item: RQ total separates QPP, QPIP (both shares) and Québec tax", () => {
    const rq = aggregateQuebecRemittances([
      {
        qpp: 284.02, qpp2: 0, qpip: 20.64, ei: 62.4,
        employerCpp: 284.02, employerCpp2: 0, employerEi: 116.26,
        quebecTax: 432.95,
      },
    ]);
    expect(rq.qppEmployee).toBe(284.02);
    expect(rq.qppEmployer).toBe(284.02);
    expect(rq.qpipEmployee).toBe(20.64);
    expect(rq.qpipEmployer).toBe(28.9); // derived from the folded employerEi
    expect(rq.quebecTax).toBe(432.95);
    expect(rq.totalRq).toBe(1050.53);
  });

  it("empty input is all zeros", () => {
    const rq = aggregateQuebecRemittances([]);
    expect(rq.items).toBe(0);
    expect(rq.totalRq).toBe(0);
  });
});

describe("banking completeness (W4-D5)", () => {
  const enc = (bank: unknown) => encrypt(JSON.stringify(bank));

  it("Erin's shape — institution + transit but a BLANK account — is incomplete", () => {
    const blob = enc({ institution: "004", transit: "12345", account: "" });
    expect(bankDetailsCompleteFromEncrypted(blob)).toBe(false);
    expect(bankAccountLast4(parseBankDetails(blob))).toBeNull();
  });

  it("a complete record passes and exposes the last 4 digits", () => {
    const bank = parseBankDetails(enc({ institution: "004", transit: "12345", account: "9876543" }));
    expect(bankDetailsComplete(bank)).toBe(true);
    expect(bankAccountLast4(bank)).toBe("6543");
  });

  it("missing blob, malformed fields and undecryptable blobs are incomplete", () => {
    expect(bankDetailsCompleteFromEncrypted(null)).toBe(false);
    expect(bankDetailsCompleteFromEncrypted("")).toBe(false);
    expect(bankDetailsCompleteFromEncrypted("not-a-ciphertext")).toBe(false);
    expect(bankDetailsComplete({ institution: "04", transit: "12345", account: "1234567" })).toBe(false);
    expect(bankDetailsComplete({ institution: "004", transit: "1234", account: "1234567" })).toBe(false);
    expect(bankDetailsComplete({ institution: "004", transit: "12345", account: "1234567890123" })).toBe(false);
    // Spaces/dashes in the account are formatting, matching the CPA-005 builder.
    expect(bankDetailsComplete({ institution: "004", transit: "12345", account: "123 456-7" })).toBe(true);
  });
});
