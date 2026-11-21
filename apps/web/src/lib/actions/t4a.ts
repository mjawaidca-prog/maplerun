"use server";

/**
 * T4A — payees, tagged payments, year-end slips/summary, CRA XML.
 *
 * Improvement plan Phase 1, item 7a. The model (design §6.1.3): payments
 * to non-employees are recorded DURING the year, each tagged with its
 * T4A box classification (PayeePayment.boxCode) and the tax withheld from
 * it. At year-end the slips are a pure aggregation of those tags via
 * lib/filings/t4a-boxes.ts — December is a report, not a reconstruction.
 *
 * Every action is tenant-scoped via requireCompany(). SINs are stored
 * AES-256-GCM encrypted (lib/encryption), decrypted only inside the
 * report/XML generation path — the same rule as Employee SINs.
 */

import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/session";
import { encrypt, decrypt } from "@/lib/encryption";
import { revalidatePath } from "next/cache";
import {
  T4A_BOX_BY_CODE,
  computeT4aSlip,
  computeT4aSummary,
  validateT4aSummary,
  type T4aPayeeYearData,
  type T4aSlip,
  type T4aSummaryTotals,
} from "@/lib/filings/t4a-boxes";
import { buildT4aXml, type T4aPayer } from "@/lib/filings/t4a-xml";
import type { T4Transmitter } from "@/lib/filings/t4-xml";

// ─── Shared helpers ──────────────────────────────────────────────────────────

function str(formData: FormData, name: string): string {
  return ((formData.get(name) as string) ?? "").trim();
}

function opt(formData: FormData, name: string): string | null {
  const v = str(formData, name);
  return v === "" ? null : v;
}

function parseMoney(raw: string, field: string): number {
  const n = Number(raw);
  if (raw === "" || !Number.isFinite(n)) {
    throw new Error(`${field} must be a number.`);
  }
  if (n < 0) {
    throw new Error(`${field} must not be negative.`);
  }
  return Math.round(n * 100) / 100;
}

const BN15_RE = /^\d{9}[A-Za-z]{2}\d{4}$/;

function displayName(p: {
  payeeType: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}): string {
  if (p.payeeType === "BUSINESS") return p.businessName ?? "(unnamed business)";
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "(unnamed payee)";
}

// ─── Payee CRUD ──────────────────────────────────────────────────────────────

export async function createPayee(formData: FormData) {
  const { companyId } = await requireCompany();

  const payeeType = str(formData, "payeeType") || "INDIVIDUAL";
  if (payeeType !== "INDIVIDUAL" && payeeType !== "BUSINESS") {
    throw new Error("Payee type must be INDIVIDUAL or BUSINESS.");
  }

  const firstName = opt(formData, "firstName");
  const lastName = opt(formData, "lastName");
  const businessName = opt(formData, "businessName");

  if (payeeType === "INDIVIDUAL" && (!firstName || !lastName)) {
    throw new Error("First name and last name are required for an individual payee.");
  }
  if (payeeType === "BUSINESS" && !businessName) {
    throw new Error("Business name is required for a business payee.");
  }

  // SIN: optional at capture time (CRA has a zero placeholder), but a
  // supplied SIN must be a real 9-digit SIN — stored encrypted.
  let sinEncrypted: string | null = null;
  const sinRaw = str(formData, "sin");
  if (payeeType === "INDIVIDUAL" && sinRaw !== "") {
    const digits = sinRaw.replace(/\D/g, "");
    if (!/^\d{9}$/.test(digits)) {
      throw new Error("SIN must be exactly 9 digits.");
    }
    sinEncrypted = encrypt(digits);
  }

  let businessNumber = opt(formData, "businessNumber");
  if (businessNumber) {
    businessNumber = businessNumber.replace(/\s/g, "").toUpperCase();
    if (!BN15_RE.test(businessNumber)) {
      throw new Error("Business number must be a full BN15 (9 digits + 2 letters + 4 digits, e.g. 123456789RT0001).");
    }
  }

  const dentalRaw = str(formData, "dentalBenefitsCode");
  let dentalBenefitsCode: number | null = null;
  if (dentalRaw !== "") {
    dentalBenefitsCode = Number(dentalRaw);
    if (!Number.isInteger(dentalBenefitsCode) || dentalBenefitsCode < 1 || dentalBenefitsCode > 5) {
      throw new Error("Dental benefits code must be 1–5.");
    }
  }

  const payee = await prisma.payee.create({
    data: {
      companyId,
      payeeType,
      firstName: payeeType === "INDIVIDUAL" ? firstName : null,
      lastName: payeeType === "INDIVIDUAL" ? lastName : null,
      initial: payeeType === "INDIVIDUAL" ? opt(formData, "initial") : null,
      businessName: payeeType === "BUSINESS" ? businessName : null,
      businessName2: payeeType === "BUSINESS" ? opt(formData, "businessName2") : null,
      sinEncrypted,
      businessNumber,
      recipientNumber: opt(formData, "recipientNumber"),
      email: opt(formData, "email"),
      phone: opt(formData, "phone"),
      addressLine1: opt(formData, "addressLine1"),
      addressLine2: opt(formData, "addressLine2"),
      city: opt(formData, "city"),
      province: opt(formData, "province"),
      postalCode: opt(formData, "postalCode"),
      countryCode: opt(formData, "countryCode") ?? "CAN",
      dentalBenefitsCode,
    },
  });

  revalidatePath("/payees");
  return payee.id;
}

export async function deletePayee(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = str(formData, "payeeId");
  const payee = await prisma.payee.findUnique({ where: { id }, select: { companyId: true } });
  if (!payee || payee.companyId !== companyId) {
    throw new Error("Payee not found.");
  }
  // Payments cascade (schema onDelete: Cascade) — deleting a payee is a
  // deliberate removal of its payment history too.
  await prisma.payee.delete({ where: { id } });
  revalidatePath("/payees");
  revalidatePath("/reports/t4a");
}

// ─── Payment recording (the during-the-year tagging) ─────────────────────────

export async function recordPayeePayment(formData: FormData) {
  const { companyId } = await requireCompany();

  const payeeId = str(formData, "payeeId");
  const payee = await prisma.payee.findUnique({ where: { id: payeeId }, select: { companyId: true } });
  if (!payee || payee.companyId !== companyId) {
    throw new Error("Payee not found.");
  }

  const paymentDate = str(formData, "paymentDate");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    throw new Error("Payment date must be YYYY-MM-DD.");
  }

  const boxCode = str(formData, "boxCode");
  if (!T4A_BOX_BY_CODE.has(boxCode)) {
    throw new Error(`"${boxCode}" is not a supported T4A classification.`);
  }

  const amount = parseMoney(str(formData, "amount"), "Amount");
  if (amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  const incomeTaxDeducted = parseMoney(str(formData, "incomeTaxDeducted") || "0", "Income tax deducted");
  if (incomeTaxDeducted > amount) {
    throw new Error("Income tax deducted cannot exceed the payment amount.");
  }

  await prisma.payeePayment.create({
    data: {
      companyId,
      payeeId,
      paymentDate,
      boxCode,
      amount,
      incomeTaxDeducted,
      description: opt(formData, "description"),
      t5018Reportable: formData.get("t5018Reportable") === "on",
    },
  });

  revalidatePath(`/payees/${payeeId}`);
  revalidatePath("/payees");
  revalidatePath("/reports/t4a");
}

export async function deletePayeePayment(formData: FormData) {
  const { companyId } = await requireCompany();
  const id = str(formData, "paymentId");
  const payment = await prisma.payeePayment.findUnique({
    where: { id },
    select: { companyId: true, payeeId: true },
  });
  if (!payment || payment.companyId !== companyId) {
    throw new Error("Payment not found.");
  }
  await prisma.payeePayment.delete({ where: { id } });
  revalidatePath(`/payees/${payment.payeeId}`);
  revalidatePath("/reports/t4a");
}

// ─── Reads for the payee pages ───────────────────────────────────────────────

export interface PayeeListRow {
  id: string;
  displayName: string;
  payeeType: string;
  hasSin: boolean;
  businessNumber: string | null;
  paymentCount: number;
  totalPaid: number;
  t5018PaymentCount: number;
}

export async function getPayees(): Promise<PayeeListRow[]> {
  const { companyId } = await requireCompany();
  const payees = await prisma.payee.findMany({
    where: { companyId },
    include: { payments: { select: { amount: true, t5018Reportable: true } } },
    orderBy: { createdAt: "asc" },
  });
  return payees.map((p) => ({
    id: p.id,
    displayName: displayName(p),
    payeeType: p.payeeType,
    hasSin: !!p.sinEncrypted,
    businessNumber: p.businessNumber,
    paymentCount: p.payments.length,
    totalPaid: Math.round(p.payments.reduce((a, x) => a + x.amount, 0) * 100) / 100,
    t5018PaymentCount: p.payments.filter((x) => x.t5018Reportable).length,
  }));
}

export interface PayeeDetail {
  id: string;
  payeeType: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  businessNumber: string | null;
  recipientNumber: string | null;
  hasSin: boolean;
  email: string | null;
  city: string | null;
  province: string | null;
  payments: {
    id: string;
    paymentDate: string;
    boxCode: string;
    amount: number;
    incomeTaxDeducted: number;
    description: string | null;
    t5018Reportable: boolean;
  }[];
}

export async function getPayeeDetail(payeeId: string): Promise<PayeeDetail | null> {
  const { companyId } = await requireCompany();
  const p = await prisma.payee.findUnique({
    where: { id: payeeId },
    include: { payments: { orderBy: { paymentDate: "desc" } } },
  });
  if (!p || p.companyId !== companyId) return null;
  return {
    id: p.id,
    payeeType: p.payeeType,
    displayName: displayName(p),
    firstName: p.firstName,
    lastName: p.lastName,
    businessName: p.businessName,
    businessNumber: p.businessNumber,
    recipientNumber: p.recipientNumber,
    hasSin: !!p.sinEncrypted,
    email: p.email,
    city: p.city,
    province: p.province,
    payments: p.payments.map((x) => ({
      id: x.id,
      paymentDate: x.paymentDate,
      boxCode: x.boxCode,
      amount: x.amount,
      incomeTaxDeducted: x.incomeTaxDeducted,
      description: x.description,
      t5018Reportable: x.t5018Reportable,
    })),
  };
}

// ─── Year-end report: slips + summary + tie-out ──────────────────────────────

export interface T4aReportSlip {
  payeeId: string;
  displayName: string;
  payeeType: string;
  /** Masked — the full SIN never reaches list views. */
  sinMasked: string;
  slip: T4aSlip;
}

export interface T4aReport {
  year: number;
  companyName: string;
  slips: T4aReportSlip[];
  totals: T4aSummaryTotals;
  /** Tie-out discrepancies (validateT4aSummary) — empty when tied. */
  tieOutProblems: string[];
  /** Per-payee slip warnings, flattened with the payee's name. */
  warnings: string[];
  /**
   * Payees whose slip could not be computed at all (e.g. a payment
   * tagged with an unsupported code). Their amounts are EXCLUDED from
   * the totals and XML generation refuses to run while any exist.
   */
  errors: { payeeId: string; displayName: string; message: string }[];
}

export async function getT4aReport(year: number): Promise<T4aReport> {
  const { companyId } = await requireCompany();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  const payees = await prisma.payee.findMany({
    where: { companyId },
    include: {
      payments: {
        where: { paymentDate: { startsWith: String(year) } },
        orderBy: { paymentDate: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const slips: T4aReportSlip[] = [];
  const errors: T4aReport["errors"] = [];
  const warnings: string[] = [];

  for (const p of payees) {
    if (p.payments.length === 0) continue;
    const name = displayName(p);
    try {
      const data: T4aPayeeYearData = {
        payeeType: p.payeeType === "BUSINESS" ? "BUSINESS" : "INDIVIDUAL",
        surname: p.lastName ?? undefined,
        givenName: p.firstName ?? undefined,
        initial: p.initial ?? undefined,
        businessName: p.businessName ?? undefined,
        businessName2: p.businessName2 ?? undefined,
        // Decrypted here, inside the filing path only — never persisted
        // or returned to the client (the report carries a mask).
        sin: p.sinEncrypted ? decrypt(p.sinEncrypted) : null,
        recipientBn: p.businessNumber,
        recipientNumber: p.recipientNumber ?? undefined,
        addressLine1: p.addressLine1 ?? undefined,
        addressLine2: p.addressLine2 ?? undefined,
        city: p.city ?? undefined,
        province: p.province ?? undefined,
        countryCode: p.countryCode ?? "CAN",
        postalCode: p.postalCode ?? undefined,
        dentalBenefitsCode: p.dentalBenefitsCode ?? undefined,
        payments: p.payments.map((x) => ({
          boxCode: x.boxCode,
          amount: x.amount,
          incomeTaxDeducted: x.incomeTaxDeducted,
        })),
      };
      const slip = computeT4aSlip(data);
      slips.push({
        payeeId: p.id,
        displayName: name,
        payeeType: p.payeeType,
        sinMasked: p.payeeType === "BUSINESS" ? "—" : "•••-•••-•••",
        slip,
      });
      for (const w of slip.warnings) warnings.push(`${name}: ${w}`);
    } catch (e) {
      errors.push({
        payeeId: p.id,
        displayName: name,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const computed = slips.map((s) => s.slip);
  const totals = computeT4aSummary(computed);
  const tieOutProblems = validateT4aSummary(computed, totals);

  return {
    year,
    companyName: company?.name ?? "Nexvar Pay",
    slips,
    totals,
    tieOutProblems,
    warnings,
    errors,
  };
}

// ─── CRA XML generation ──────────────────────────────────────────────────────

/**
 * Filing details the company record does not hold (payer RP account,
 * addresses, contacts). Collected by the export form on the T4A report
 * page and passed through /api/t4a/xml — never fabricated: the route
 * requires every field CRA requires.
 */
export interface T4aFilingDetails {
  /** Payer RP account number (BN15 with RP program account). */
  payerBn15: string;
  payerName2?: string;
  payerName3?: string;
  payerAddressLine1?: string;
  payerAddressLine2?: string;
  payerCity?: string;
  payerProvince?: string;
  payerPostalCode?: string;
  contactName: string;
  contactAreaCode: string;
  contactPhone: string;
  contactExt?: string;
  /** Required by the T619 transmitter contact (XSD), not the summary. */
  contactEmail: string;
  /** Defaults to the company name. */
  transmitterName?: string;
  /** Defaults to payerBn15. */
  transmitterAccountNumber15?: string;
  language?: "E" | "F";
}

export async function generateT4aXmlFile(
  year: number,
  filing: T4aFilingDetails,
): Promise<{ filename: string; content: string }> {
  const report = await getT4aReport(year);

  if (report.errors.length > 0) {
    throw new Error(
      `Cannot generate the T4A XML: ${report.errors.length} payee slip(s) failed to compute (${report.errors
        .map((e) => `${e.displayName}: ${e.message}`)
        .join("; ")}). Fix the payee/payment data first.`,
    );
  }
  if (report.slips.length === 0) {
    throw new Error(`No T4A data for ${year} — no tagged payments were recorded.`);
  }

  const payer: T4aPayer = {
    bn15: filing.payerBn15,
    name1: report.companyName,
    name2: filing.payerName2,
    name3: filing.payerName3,
    address: {
      line1: filing.payerAddressLine1,
      line2: filing.payerAddressLine2,
      city: filing.payerCity,
      province: filing.payerProvince,
      countryCode: "CAN",
      postalCode: filing.payerPostalCode,
    },
    contact: {
      name: filing.contactName,
      areaCode: filing.contactAreaCode,
      phone: filing.contactPhone,
      ext: filing.contactExt,
      email: filing.contactEmail,
    },
  };

  const transmitter: T4Transmitter = {
    accountNumber15: filing.transmitterAccountNumber15 ?? filing.payerBn15,
    language: filing.language ?? "E",
    name1: filing.transmitterName ?? report.companyName,
    countryCode: "CAN",
    contact: {
      name: filing.contactName,
      areaCode: filing.contactAreaCode,
      phone: filing.contactPhone,
      ext: filing.contactExt,
      email: filing.contactEmail,
    },
  };

  const slips = report.slips.map((s) => s.slip);
  const content = buildT4aXml({
    transmitter,
    payer,
    taxYear: year,
    slips,
    summary: computeT4aSummary(slips),
  });

  return { filename: `t4a-${year}.xml`, content };
}
