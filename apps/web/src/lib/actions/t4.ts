"use server";

/**
 * T4 slip generation — per-employee annual summary from finalized pay runs.
 *
 * Wiring layer over the pure filing modules (Wave 2 PR #13):
 *   lib/filings/t4-boxes.ts — computeT4Slip / computeT4Summary own ALL box
 *                             rules; this file only assembles their input.
 *   lib/filings/t4-xml.ts   — buildT4Xml serializes a CRA 1-27-1 submission.
 *
 * Assembly rules (this file's responsibility):
 *   - Only FINALIZED pay runs whose payDate falls in `year` are included.
 *   - employmentIncome = Σ PayRunItem.gross; ei = Σ ei; qpipPremiums = Σ qpip;
 *     federalTax / provincialTax are summed and passed SEPARATELY (the
 *     module excludes Québec tax from box 22; combined figures never cross
 *     this boundary).
 *   - Boxes 24/26 come from the CAPPED totals: YtdLedger.insurableEarnings /
 *     pensionableEarnings for (employee, year), falling back to the LAST
 *     finalized item's ytdInsurable / ytdPensionable snapshot when no ledger
 *     row exists. Gross is never substituted (that was the old bug).
 *   - CPP/QPP routing — by the item columns actually present, never by
 *     assumption: PayRunItem dual-writes QC pension amounts into BOTH
 *     cpp/cpp2 (legacy totals) and qpp/qpp2 (see payroll.ts finalize). For a
 *     Québec employee (province of employment = the employee's province
 *     field, as before) the qpp/qpp2 columns are authoritative and the cpp
 *     duplicates are NOT also passed (no double count, no mixed slip); a QC
 *     employee whose runs predate the qpp columns (qpp sums = 0) falls back
 *     to the cpp columns, which held the QPP amounts for those runs. For a
 *     non-QC employee cpp/cpp2 are passed as CPP, and any stray qpp/qpp2
 *     sums are passed through as QPP so the module can warn and keep them
 *     off the slip (a separate QC slip would be required).
 *   - Employer amounts: employerEi = Σ employerEi for every employee.
 *     employerCpp/employerCpp2 = Σ item fields for non-QC employees only —
 *     for QC runs those item fields hold the employer's QPP/QPP2 share, and
 *     the T4 summary has no QPP employer totals (they must not be folded
 *     into CPP), so QC slips carry 0 there.
 *   - Box 56 (QPIP insurable earnings, QC only): the QPIP share of the
 *     blended insurable accumulation, derived from per-item snapshot
 *     deltas (W4-D3 — the stored total blends EI + QPIP bases, which is
 *     also why box 24 for QC is blended minus that share), capped at
 *     QPIP_2026.maxInsurableEarnings from @maplerun/tax-engine
 *     (packages/tax-engine/src/data/2026/quebec.ts, cleanly re-exported from
 *     the package index). Only applied for tax year 2026, the year that cap
 *     describes; for other years the field is omitted so the module's
 *     "QPIP insurable unknown" warning fires instead of a wrong cap.
 *
 * SIN boundary: getT4Report NEVER decrypts — it passes sin: null and the
 * on-screen report keeps the masked placeholder. Only exportT4Xml decrypts,
 * inside the action, immediately before computeT4Slip; plaintext SINs are
 * never logged, never included in errors, and never returned to the client
 * except as part of the CRA XML document itself.
 *
 * CRA T4 boxes (legacy report shape):
 *   14 — Employment income (total gross)
 *   16 — Employee CPP contributions (non-QC; QC QPP has no legacy field)
 *   16A — Employee CPP2 contributions
 *   18 — Employee EI premiums
 *   22 — Income tax deducted (QC: federal only, per the module)
 *   24 — EI insurable earnings (capped)
 *   26 — CPP/QPP pensionable earnings (capped)
 *   55 — Employee's QPIP premiums (QC)
 *   56 — QPIP insurable earnings (QC)
 */

import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/session";
import { decrypt } from "@/lib/encryption";
import {
  computeT4Slip,
  computeT4Summary,
  round2,
  type T4EmployeeYearData,
  type T4Slip as FilingT4Slip,
  type T4SummaryTotals,
} from "@/lib/filings/t4-boxes";
import { buildT4Xml, type T4SubmissionInput } from "@/lib/filings/t4-xml";
import { QPIP_2026 } from "@maplerun/tax-engine";

export type T4Slip = {
  employeeId: string;
  employeeName: string;
  sinMasked: string;
  province: string;
  box14: number; // Employment income
  box16: number; // Employee CPP
  box16A: number; // Employee CPP2
  /** Wave 4 (W4-D3) — Employee QPP / QPP2 (QC only; the filing module
   *  computed them all along, the legacy report shape dropped them). */
  box17: number;
  box17A: number;
  box18: number; // Employee EI
  box22: number; // Income tax deducted
  box24: number; // EI insurable earnings
  box26: number; // CPP pensionable earnings
  box55: number; // QPIP premiums (QC only)
  box56: number; // QPIP insurable earnings (QC only)
  payPeriods: number;
};

export type T4Report = {
  year: number;
  companyName: string;
  slips: T4Slip[];
  totals: {
    employees: number;
    box14: number;
    box16: number;
    box16A: number;
    box17: number;
    box17A: number;
    box18: number;
    box22: number;
    box24: number;
    box26: number;
  };
};

/** Transmitter/contact details collected by the Export T4 XML dialog. */
export type T4TransmitterInput = {
  /** Transmitter name for the T619; defaults to the company name. */
  name?: string;
  contactName: string;
  areaCode: string;
  phone: string;
  /** Required — CRA's T619 <CNTC> makes the transmitter email mandatory. */
  email: string;
};

// ─── Assembly ────────────────────────────────────────────────────────────────

type EmployeeYearAggregate = {
  employeeId: string;
  firstName: string;
  lastName: string;
  province: string;
  sinEncrypted: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  payPeriods: number;
  gross: number;
  cpp: number;
  cpp2: number;
  qpp: number;
  qpp2: number;
  ei: number;
  qpip: number;
  federalTax: number;
  provincialTax: number;
  employerCpp: number;
  employerCpp2: number;
  employerEi: number;
  /** Capped snapshots from the most recent finalized item (fallback only). */
  lastYtdInsurable?: number;
  lastYtdPensionable?: number;
  /** Wave 4 (W4-D3) — the QPIP share of the blended insurable
   *  accumulation, derived from per-item ytdInsurable deltas (the
   *  engine feeds the same insurable base to EI and QPIP, so a
   *  QPIP-bearing item's blended delta is half QPIP). */
  qpipInsurable: number;
  prevYtdInsurable: number;
};

type AssembledT4 = {
  companyName: string;
  businessNumber: string | null;
  slips: FilingT4Slip[];
  summary: T4SummaryTotals;
  aggregates: EmployeeYearAggregate[];
};

/** Decrypt a SIN for export. Errors are deliberately identifier-free. */
function decryptSinForExport(sinEncrypted: string): string {
  try {
    return decrypt(sinEncrypted);
  } catch {
    throw new Error(
      "An employee SIN could not be decrypted for the T4 export. Check the ENCRYPTION_KEY configuration and try again.",
    );
  }
}

async function assembleT4(year: number, opts: { decryptSin: boolean }): Promise<AssembledT4> {
  const { companyId } = await requireCompany();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, businessNumber: true },
  });

  // Get all finalized pay runs for the year
  const payRuns = await prisma.payRun.findMany({
    where: {
      companyId,
      status: "FINALIZED",
      payDate: { startsWith: String(year) },
    },
    include: {
      items: {
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              province: true,
              sinEncrypted: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              postalCode: true,
            },
          },
        },
      },
    },
    orderBy: { payDate: "asc" },
  });

  // Aggregate per employee
  const empMap = new Map<string, EmployeeYearAggregate>();

  for (const run of payRuns) {
    for (const item of run.items) {
      let agg = empMap.get(item.employeeId);
      if (!agg) {
        agg = {
          employeeId: item.employeeId,
          firstName: item.employee.firstName,
          lastName: item.employee.lastName,
          province: item.employee.province ?? "ON",
          sinEncrypted: item.employee.sinEncrypted,
          addressLine1: item.employee.addressLine1 ?? undefined,
          addressLine2: item.employee.addressLine2 ?? undefined,
          city: item.employee.city ?? undefined,
          postalCode: item.employee.postalCode ?? undefined,
          payPeriods: 0,
          gross: 0,
          cpp: 0,
          cpp2: 0,
          qpp: 0,
          qpp2: 0,
          ei: 0,
          qpip: 0,
          federalTax: 0,
          provincialTax: 0,
          employerCpp: 0,
          employerCpp2: 0,
          employerEi: 0,
          qpipInsurable: 0,
          prevYtdInsurable: 0,
        };
        empMap.set(item.employeeId, agg);
      }

      agg.gross += item.gross;
      agg.cpp += item.cpp;
      agg.cpp2 += item.cpp2;
      agg.qpp += item.qpp;
      agg.qpp2 += item.qpp2;
      agg.ei += item.ei;
      agg.qpip += item.qpip;
      agg.federalTax += item.federalTax;
      agg.provincialTax += item.provincialTax;
      agg.employerCpp += item.employerCpp;
      agg.employerCpp2 += item.employerCpp2;
      agg.employerEi += item.employerEi;
      // W4-D3 — track the QPIP share of the blended insurable total:
      // runs are payDate-ascending (finalization order in practice), so
      // each item's snapshot delta is its own insurable contribution.
      const insurableDelta = item.ytdInsurable - agg.prevYtdInsurable;
      if (item.qpip > 0) agg.qpipInsurable += insurableDelta / 2;
      agg.prevYtdInsurable = item.ytdInsurable;
      // Runs are ordered by payDate ascending, so the last write wins and
      // holds the year-end capped snapshot for the fallback path.
      agg.lastYtdInsurable = item.ytdInsurable;
      agg.lastYtdPensionable = item.ytdPensionable;
      agg.payPeriods += 1;
    }
  }

  const aggregates = Array.from(empMap.values());

  // Capped earnings (boxes 24/26) from the YtdLedger for (employee, year).
  const ledgers: Array<{
    employeeId: string;
    insurableEarnings: number;
    pensionableEarnings: number;
  }> = aggregates.length
    ? await prisma.ytdLedger.findMany({
        where: { employeeId: { in: aggregates.map((a) => a.employeeId) }, year },
        select: { employeeId: true, insurableEarnings: true, pensionableEarnings: true },
      })
    : [];
  const ledgerByEmployee = new Map(ledgers.map((l) => [l.employeeId, l]));

  const data: T4EmployeeYearData[] = aggregates.map((agg) => {
    const provinceOfEmployment = agg.province.trim().toUpperCase() || "ON";
    const isQuebec = provinceOfEmployment === "QC";
    const ledger = ledgerByEmployee.get(agg.employeeId);

    // CPP/QPP routing by the item columns actually present (see header).
    let cpp: number | undefined;
    let cpp2: number | undefined;
    let qpp: number | undefined;
    let qpp2: number | undefined;
    if (isQuebec) {
      qpp = agg.qpp > 0 ? agg.qpp : agg.cpp;
      qpp2 = agg.qpp2 > 0 ? agg.qpp2 : agg.cpp2;
    } else {
      cpp = agg.cpp;
      cpp2 = agg.cpp2;
      if (agg.qpp > 0) qpp = agg.qpp;
      if (agg.qpp2 > 0) qpp2 = agg.qpp2;
    }

    // W4-D3 — boxes 24/56 for Quebec: the stored insurable total
    // BLENDS the EI and QPIP bases (Sophie's read 9,600 for 4,800 of
    // earnings, so box 24 showed double). Box 24 is the EI share only
    // (blended − QPIP share); box 56 is the QPIP share, capped at the
    // QPIP maximum. When premiums exist but no snapshot split could be
    // derived (pre-split items), fall back to the capped-gross figure
    // the wiring used before.
    const blendedInsurable = ledger ? ledger.insurableEarnings : agg.lastYtdInsurable;
    const qpipInsurableDerived =
      agg.qpipInsurable > 0
        ? round2(agg.qpipInsurable)
        : agg.qpip > 0
          ? Math.min(agg.gross, QPIP_2026.maxInsurableEarnings)
          : 0;
    const eiInsurableEarnings =
      isQuebec && blendedInsurable !== undefined
        ? Math.max(0, round2(blendedInsurable - qpipInsurableDerived))
        : blendedInsurable;

    return {
      surname: agg.lastName,
      givenName: agg.firstName,
      // Report path passes null (masked on screen); export decrypts here,
      // inside the action only.
      sin: opts.decryptSin ? decryptSinForExport(agg.sinEncrypted) : null,
      addressLine1: agg.addressLine1,
      addressLine2: agg.addressLine2,
      city: agg.city,
      provinceOfResidence: provinceOfEmployment,
      countryCode: "CAN",
      postalCode: agg.postalCode,
      provinceOfEmployment,

      employmentIncome: agg.gross,
      cpp,
      cpp2,
      qpp,
      qpp2,
      ei: agg.ei,
      qpipPremiums: agg.qpip,
      federalTax: agg.federalTax,
      provincialTax: agg.provincialTax,
      eiInsurableEarnings,
      cppPensionableEarnings: ledger ? ledger.pensionableEarnings : agg.lastYtdPensionable,
      // Box 56: the derived QPIP insurable share, capped (see above).
      // Only applied for tax year 2026, the year that cap describes;
      // for other years the field is omitted so the module's "QPIP
      // insurable unknown" warning fires instead of a wrong cap.
      qpipInsurableEarnings:
        isQuebec && year === QPIP_2026.year
          ? Math.min(qpipInsurableDerived, QPIP_2026.maxInsurableEarnings)
          : undefined,
      // QC item employerCpp/CPP2 are the employer's QPP share — not T4
      // summary amounts (see header); EI employer share applies everywhere.
      employerCpp: isQuebec ? 0 : agg.employerCpp,
      employerCpp2: isQuebec ? 0 : agg.employerCpp2,
      employerEi: agg.employerEi,
    };
  });

  const slips = data.map((d) => computeT4Slip(d));
  return {
    companyName: company?.name ?? "Nexvar Pay",
    businessNumber: company?.businessNumber ?? null,
    slips,
    summary: computeT4Summary(slips),
    aggregates,
  };
}

// ─── On-screen report (no SIN decryption, ever) ─────────────────────────────

export async function getT4Report(year: number): Promise<T4Report> {
  const { companyName, slips, aggregates } = await assembleT4(year, { decryptSin: false });

  const legacySlips: T4Slip[] = slips.map((slip, i) => {
    const agg = aggregates[i]!;
    return {
      employeeId: agg.employeeId,
      employeeName: `${agg.firstName} ${agg.lastName}`,
      sinMasked: "•••-•••-•••",
      province: agg.province,
      box14: slip.box14,
      box16: slip.box16,
      box16A: slip.box16A,
      box17: slip.box17,
      box17A: slip.box17A,
      box18: slip.box18,
      box22: slip.box22,
      box24: slip.box24,
      box26: slip.box26,
      box55: slip.box55,
      box56: slip.box56,
      payPeriods: agg.payPeriods,
    };
  });

  const sum = (pick: (s: T4Slip) => number) => round2(legacySlips.reduce((acc, s) => acc + pick(s), 0));
  const totals = {
    employees: legacySlips.length,
    box14: sum((s) => s.box14),
    box16: sum((s) => s.box16),
    box16A: sum((s) => s.box16A),
    box17: sum((s) => s.box17),
    box17A: sum((s) => s.box17A),
    box18: sum((s) => s.box18),
    box22: sum((s) => s.box22),
    box24: sum((s) => s.box24),
    box26: sum((s) => s.box26),
  };

  return { year, companyName, slips: legacySlips, totals };
}

// ─── CRA XML export (the only place SINs are decrypted) ─────────────────────

/**
 * Derive the 15-char payroll account number (BN15) from the company's
 * business number: a bare 9-digit BN gets the default RP0001 payroll
 * account appended; an already-15-char account number is used as-is.
 */
function toPayrollBn15(businessNumber: string | null | undefined): string {
  const v = (businessNumber ?? "").replace(/\s/g, "");
  if (/^\d{9}$/.test(v)) return `${v}RP0001`;
  if (v.length === 15) return v;
  throw new Error(
    "Set the company business number before exporting T4 XML: a 9-digit BN or the full 15-character payroll account number (e.g. 123456789RP0001) is required.",
  );
}

/**
 * Wave 4 (W4-D7) — the export returns a DISCRIMINATED RESULT instead of
 * throwing for expected failures. In production, Next.js masks a thrown
 * server-action error behind the generic "Server Components render"
 * message, which is exactly what the Prairie Peak proof hit: a valid
 * slip existed, the export died (most plausibly on the transmitter
 * phone format — the CRA builder wants a 7-digit local number and the
 * dialog invited a full number), and the user saw no actionable text.
 * Expected failures now travel back as { ok: false, error } with the
 * real reason; the phone is also normalized here (a 10-digit entry is
 * split into area code + local number) so the common case just works.
 */
export type T4XmlExportResult =
  | { ok: true; filename: string; content: string }
  | { ok: false; error: string };

export async function exportT4Xml(
  year: number,
  transmitter: T4TransmitterInput,
): Promise<T4XmlExportResult> {
  try {
    return await buildT4XmlExport(year, transmitter);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "T4 XML export failed." };
  }
}

async function buildT4XmlExport(
  year: number,
  transmitter: T4TransmitterInput,
): Promise<{ ok: true; filename: string; content: string }> {
  // The T619 transmitter contact email is schema-REQUIRED (CRA 1-27-1) —
  // fail with a clear message before any building happens.
  const email = transmitter?.email?.trim() ?? "";
  if (!email) {
    throw new Error(
      "Transmitter contact email is required: CRA's T619 transmittal record requires a contact email for every T4 submission.",
    );
  }
  const contactName = transmitter?.contactName?.trim() ?? "";
  if (!contactName) throw new Error("Transmitter contact name is required for the T4 XML export.");

  // Phone normalization (W4-D7): strip punctuation; a 10-digit entry
  // with no separate area code is split; a leading country "1" drops.
  let areaCode = (transmitter?.areaCode ?? "").replace(/\D/g, "");
  let phone = (transmitter?.phone ?? "").replace(/\D/g, "");
  if (!areaCode && phone.length === 11 && phone.startsWith("1")) phone = phone.slice(1);
  if (!areaCode && phone.length === 10) {
    areaCode = phone.slice(0, 3);
    phone = phone.slice(3);
  }
  if (areaCode.length !== 3) {
    throw new Error("Transmitter contact area code must be 3 digits for the T4 XML export.");
  }
  if (phone.length !== 7) {
    throw new Error(
      "Transmitter contact phone must be a 7-digit local number for the T4 XML export (the area code goes in its own field).",
    );
  }

  const { companyName, businessNumber, slips, summary } = await assembleT4(year, {
    decryptSin: true,
  });

  const bn15 = toPayrollBn15(businessNumber);
  const contact = { name: contactName, areaCode, phone, email };

  const input: T4SubmissionInput = {
    transmitter: {
      name1: transmitter?.name?.trim() || companyName,
      language: "E",
      countryCode: "CAN",
      contact,
      accountNumber15: bn15,
    },
    employer: {
      bn15,
      name1: companyName,
      contact,
    },
    taxYear: year,
    slips,
    summary,
  };

  return { ok: true, filename: `T4-${year}.xml`, content: buildT4Xml(input) };
}
