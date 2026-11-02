/**
 * Employee portal core — Wave 3 (A4).
 * Pins the security-critical pure logic: payload sanitization (unknown keys
 * stripped, SIN rejected), CPA-005 banking shapes, and display masking.
 */
import { describe, it, expect } from "vitest";
import {
  sanitizePendingPayload,
  validateBankDetails,
  maskSin,
  maskBank,
  describePayload,
} from "../src/lib/employee-portal-core";

describe("sanitizePendingPayload", () => {
  it("keeps only known profile fields and normalizes province/postal code", () => {
    const out = sanitizePendingPayload({
      profile: {
        city: " Calgary ",
        province: "ab",
        postalCode: "t2z 1a1",
        hackerField: "drop me",
      },
    });
    expect(out.profile).toEqual({ city: "Calgary", province: "AB", postalCode: "T2Z 1A1" });
  });

  it("rejects any attempt to submit a SIN", () => {
    expect(() => sanitizePendingPayload({ profile: { sin: "123456789" } })).toThrow(/SIN/);
    expect(() => sanitizePendingPayload({ sinEncrypted: "abc" })).toThrow(/SIN/);
  });

  it("validates TD1 amounts and rejects negatives", () => {
    const out = sanitizePendingPayload({ td1: { year: 2027, federalClaim: 16452, extraTaxPerPeriod: 25.5 } });
    expect(out.td1).toEqual({ year: 2027, federalClaim: 16452, extraTaxPerPeriod: 25.5 });
    expect(() => sanitizePendingPayload({ td1: { year: 2027, federalClaim: -1 } })).toThrow();
    expect(() => sanitizePendingPayload({ td1: { year: "2027" } })).toThrow();
  });

  it("accepts only iv:tag:ciphertext-shaped bank payloads", () => {
    const ct = "aabbcc:ddeeff:00112233445566778899aabbccddeeff";
    expect(sanitizePendingPayload({ bankEncrypted: ct }).bankEncrypted).toBe(ct);
    expect(() => sanitizePendingPayload({ bankEncrypted: "123-45-6789" })).toThrow();
  });

  it("rejects an all-empty submission", () => {
    expect(() => sanitizePendingPayload({ profile: { city: "  " } })).toThrow(/Nothing to submit/);
    expect(() => sanitizePendingPayload({})).toThrow(/Nothing to submit/);
  });

  it("rejects bad email and postal code", () => {
    expect(() => sanitizePendingPayload({ profile: { email: "not-an-email" } })).toThrow(/email/);
    expect(() => sanitizePendingPayload({ profile: { postalCode: "12345" } })).toThrow(/postal/);
  });
});

describe("validateBankDetails", () => {
  it("accepts CPA-005 shapes and strips spaces/dashes", () => {
    expect(validateBankDetails({ transit: "12345", institution: "003", account: "1234567" }))
      .toEqual({ transit: "12345", institution: "003", account: "1234567" });
    expect(validateBankDetails({ transit: "12 345", institution: "003", account: "123-4567" }).account)
      .toBe("1234567");
  });

  it("rejects wrong lengths", () => {
    expect(() => validateBankDetails({ transit: "1234", institution: "003", account: "1234567" })).toThrow(/Transit/);
    expect(() => validateBankDetails({ transit: "12345", institution: "03", account: "1234567" })).toThrow(/Institution/);
    expect(() => validateBankDetails({ transit: "12345", institution: "003", account: "123" })).toThrow(/Account/);
    expect(() => validateBankDetails({ transit: "12345", institution: "003", account: "1234567890123" })).toThrow(/Account/);
  });
});

describe("masking", () => {
  it("maskSin shows only the last 3 digits", () => {
    expect(maskSin("123456789")).toBe("••• ••• 789");
    expect(maskSin("123 456 789")).toBe("••• ••• 789");
    expect(maskSin("")).toBe("••• ••• •••");
  });

  it("maskBank shows institution and account last-4 only", () => {
    const m = maskBank({ transit: "12345", institution: "003", account: "1234567" });
    expect(m).toContain("003");
    expect(m).toContain("4567");
    expect(m).not.toContain("1234567");
    expect(m).not.toContain("12345");
  });
});

describe("describePayload", () => {
  it("summarizes all three sections for the review UI", () => {
    const lines = describePayload({
      profile: { city: "Calgary" },
      td1: { year: 2027, federalClaim: 16452 },
      bankEncrypted: "aa:bb:cc",
    });
    expect(lines.some((l) => l.includes("Calgary"))).toBe(true);
    expect(lines.some((l) => l.includes("16452.00"))).toBe(true);
    expect(lines.some((l) => l.includes("banking"))).toBe(true);
  });
});
