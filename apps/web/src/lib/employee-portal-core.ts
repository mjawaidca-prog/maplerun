/**
 * Employee portal — pure core logic (Wave 3, A4).
 *
 * Everything in this module is framework-free and unit-tested: input
 * validation for employee self-service submissions, the pending-payload
 * sanitizer, and display masking. Server-side session/link resolution lives
 * in `employee-portal-session.ts`; the Clerk identity seam in
 * `clerk-identity.ts`.
 *
 * Security invariants enforced here:
 *  - A SIN can never be submitted through the portal (field rejected).
 *  - Unknown payload keys are stripped, never persisted.
 *  - Banking is validated to CPA-005 shapes and encrypted by the caller
 *    BEFORE it enters the payload (this module only sees ciphertext).
 */

export interface PendingProfileChanges {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  /** ISO date string YYYY-MM-DD */
  dateOfBirth?: string;
}

export interface PendingTd1Changes {
  year: number;
  federalClaim?: number;
  provincialClaim?: number;
  extraTaxPerPeriod?: number;
}

export interface PendingPayload {
  profile?: PendingProfileChanges;
  td1?: PendingTd1Changes;
  /** AES-256-GCM ciphertext of JSON {transit, institution, account}. */
  bankEncrypted?: string;
}

const PROFILE_KEYS = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "addressLine1",
  "addressLine2",
  "city",
  "province",
  "postalCode",
  "dateOfBirth",
] as const;

const PROVINCES = new Set([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function cleanString(v: unknown, maxLen: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (s.length === 0 || s.length > maxLen) return undefined;
  return s;
}

function cleanMoney(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  if (v < 0 || v > 1_000_000) return undefined;
  return Math.round(v * 100) / 100;
}

/**
 * Sanitize an untrusted pending-update payload. Returns a payload containing
 * ONLY known, valid fields — or throws on structurally invalid input and on
 * any attempt to submit a SIN (which the portal must never accept).
 */
export function sanitizePendingPayload(input: unknown): PendingPayload {
  if (!isRecord(input)) throw new Error("Invalid payload.");
  if ("sin" in input || "sinEncrypted" in input) {
    throw new Error("A SIN cannot be changed through the employee portal.");
  }
  const out: PendingPayload = {};

  if (input.profile !== undefined) {
    if (!isRecord(input.profile)) throw new Error("Invalid profile changes.");
    if ("sin" in input.profile || "sinEncrypted" in input.profile) {
      throw new Error("A SIN cannot be changed through the employee portal.");
    }
    const profile: PendingProfileChanges = {};
    for (const key of PROFILE_KEYS) {
      const raw = input.profile[key];
      if (raw === undefined || raw === null || raw === "") continue;
      if (key === "province") {
        const p = typeof raw === "string" ? raw.trim().toUpperCase() : "";
        if (!PROVINCES.has(p)) throw new Error("Invalid province.");
        profile.province = p;
      } else if (key === "postalCode") {
        const pc = cleanString(raw, 7);
        if (!pc || !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(pc)) {
          throw new Error("Invalid postal code.");
        }
        profile.postalCode = pc.toUpperCase();
      } else if (key === "email") {
        const em = cleanString(raw, 254);
        if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
          throw new Error("Invalid email address.");
        }
        profile.email = em;
      } else if (key === "dateOfBirth") {
        const dob = cleanString(raw, 10);
        if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob))) {
          throw new Error("Invalid date of birth.");
        }
        profile.dateOfBirth = dob;
      } else {
        const s = cleanString(raw, 120);
        if (s !== undefined) profile[key] = s;
      }
    }
    if (Object.keys(profile).length > 0) out.profile = profile;
  }

  if (input.td1 !== undefined) {
    if (!isRecord(input.td1)) throw new Error("Invalid TD1 changes.");
    const year = input.td1.year;
    if (typeof year !== "number" || !Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new Error("Invalid TD1 year.");
    }
    const td1: PendingTd1Changes = { year };
    const fed = cleanMoney(input.td1.federalClaim);
    const prov = cleanMoney(input.td1.provincialClaim);
    const extra = cleanMoney(input.td1.extraTaxPerPeriod);
    if (fed !== undefined) td1.federalClaim = fed;
    if (prov !== undefined) td1.provincialClaim = prov;
    if (extra !== undefined) td1.extraTaxPerPeriod = extra;
    if (fed === undefined && prov === undefined && extra === undefined) {
      throw new Error("TD1 changes are empty.");
    }
    out.td1 = td1;
  }

  if (input.bankEncrypted !== undefined) {
    // The caller encrypts before calling; we only check it looks like the
    // iv:authTag:ciphertext hex format from lib/encryption.ts.
    if (typeof input.bankEncrypted !== "string" || !/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i.test(input.bankEncrypted)) {
      throw new Error("Invalid encrypted banking payload.");
    }
    out.bankEncrypted = input.bankEncrypted;
  }

  if (!out.profile && !out.td1 && !out.bankEncrypted) {
    throw new Error("Nothing to submit — no valid changes were provided.");
  }
  return out;
}

/** CPA-005 shapes: transit 5 digits, institution 3 digits, account 5–12 digits. */
export function validateBankDetails(input: {
  transit?: unknown;
  institution?: unknown;
  account?: unknown;
}): { transit: string; institution: string; account: string } {
  const digits = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : "");
  const transit = digits(input.transit);
  const institution = digits(input.institution);
  const account = digits(input.account);
  if (!/^\d{5}$/.test(transit)) throw new Error("Transit (branch) number must be 5 digits.");
  if (!/^\d{3}$/.test(institution)) throw new Error("Institution number must be 3 digits.");
  if (!/^\d{5,12}$/.test(account)) throw new Error("Account number must be 5–12 digits.");
  return { transit, institution, account };
}

/** Mask a SIN for display: only the last 3 digits are ever shown. */
export function maskSin(sinDigits: string): string {
  const d = sinDigits.replace(/\D/g, "");
  if (d.length < 3) return "••• ••• •••";
  return `••• ••• ${d.slice(-3)}`;
}

/** Mask banking for display from its decrypted parts. */
export function maskBank(bank: { transit: string; institution: string; account: string }): string {
  const acct = bank.account;
  return `Transit •••${bank.transit.slice(-2)} · Institution ${bank.institution} · Account ••••${acct.slice(-4)}`;
}

/** Human-readable summary lines for a pending payload (employer review UI). */
export function describePayload(payload: PendingPayload): string[] {
  const lines: string[] = [];
  if (payload.profile) {
    for (const [k, v] of Object.entries(payload.profile)) lines.push(`${k}: ${v}`);
  }
  if (payload.td1) {
    const t = payload.td1;
    if (t.federalClaim !== undefined) lines.push(`TD1 ${t.year} federal claim: $${t.federalClaim.toFixed(2)}`);
    if (t.provincialClaim !== undefined) lines.push(`TD1 ${t.year} provincial claim: $${t.provincialClaim.toFixed(2)}`);
    if (t.extraTaxPerPeriod !== undefined) lines.push(`TD1 ${t.year} extra tax per period: $${t.extraTaxPerPeriod.toFixed(2)}`);
  }
  if (payload.bankEncrypted) lines.push("New direct-deposit banking provided (encrypted; applied on approval)");
  return lines;
}
