/**
 * Employee bank-details completeness — ONE rule everywhere (Wave 4
 * defect W4-D5).
 *
 * Banking is stored as a single AES-256-GCM encrypted JSON blob
 * (Employee.bankEncrypted = { institution, transit, account }). The
 * blob EXISTING is not completeness: Erin's Prairie Peak record holds
 * institution + transit with a BLANK account, yet her pay stub claimed
 * "Deposited to account •••• XXXX" and the Direct Deposit page counted
 * her among "6/6 employees have bank details" (it counted non-empty
 * blobs), while the CPA-005 builder — correctly — excluded her.
 *
 * Completeness mirrors the CPA-005 builder's payee validation
 * (lib/eft/cpa005.ts): institution exactly 3 digits, transit exactly
 * 5 digits, account numeric (spaces/dashes ignored) and at most 12
 * digits. Every surface — stub payment-method line, Direct Deposit
 * counts, EFT inclusion — must use this rule.
 */

import { decrypt } from "./encryption";

export interface BankDetails {
  institution: string;
  transit: string;
  account: string;
}

/** Parse the encrypted blob; null when absent, undecryptable, or malformed. */
export function parseBankDetails(bankEncrypted: string | null | undefined): BankDetails | null {
  if (!bankEncrypted) return null;
  try {
    const parsed = JSON.parse(decrypt(bankEncrypted)) as Partial<BankDetails>;
    return {
      institution: typeof parsed.institution === "string" ? parsed.institution : "",
      transit: typeof parsed.transit === "string" ? parsed.transit : "",
      account: typeof parsed.account === "string" ? parsed.account : "",
    };
  } catch {
    return null;
  }
}

/** The completeness rule: all three fields present and well-formed. */
export function bankDetailsComplete(bank: BankDetails | null): boolean {
  if (!bank) return false;
  const account = bank.account.replace(/[\s-]/g, "");
  return (
    /^\d{3}$/.test(bank.institution.trim()) &&
    /^\d{5}$/.test(bank.transit.trim()) &&
    account.length > 0 &&
    account.length <= 12 &&
    /^\d+$/.test(account)
  );
}

export function bankDetailsCompleteFromEncrypted(bankEncrypted: string | null | undefined): boolean {
  return bankDetailsComplete(parseBankDetails(bankEncrypted));
}

/** Last 4 digits of the account number, for stub display; null when incomplete. */
export function bankAccountLast4(bank: BankDetails | null): string | null {
  if (!bankDetailsComplete(bank)) return null;
  const digits = (bank as BankDetails).account.replace(/[\s-]/g, "");
  return digits.slice(-4);
}
