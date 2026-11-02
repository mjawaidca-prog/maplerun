/**
 * Employee portal — my details (Wave 3, A4).
 *
 * Shows the employee's record with SIN and banking MASKED (masks computed
 * server-side; full values never reach the client), plus the self-service
 * update form. Submissions go to the employer for approval — nothing here
 * writes the employee record directly.
 */

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { getActivePortalEmployee } from "@/lib/employee-portal-session";
import { maskSin, maskBank, describePayload, type PendingPayload } from "@/lib/employee-portal-core";
import { submitPortalUpdate } from "../../actions";

function maskedSin(sinEncrypted: string): string {
  try {
    return maskSin(decrypt(sinEncrypted));
  } catch {
    return "••• ••• •••";
  }
}

function maskedBank(bankEncrypted: string | null): string {
  if (!bankEncrypted) return "No banking on file";
  try {
    const bank = JSON.parse(decrypt(bankEncrypted)) as {
      transit: string;
      institution: string;
      account: string;
    };
    return maskBank(bank);
  } catch {
    return "Banking on file";
  }
}

const inputCls =
  "w-full text-sm border border-[#E7E5E4] rounded-lg px-3 py-2 bg-white text-[#1C1917]";
const labelCls = "block text-xs font-semibold text-[#57534E] mb-1";

export default async function PortalProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const params = await searchParams;
  const session = await getActivePortalEmployee();
  if (!session) return null;
  const { active } = session;

  const employee = await prisma.employee.findUnique({
    where: { id: active.employeeId },
    include: {
      td1Profiles: { orderBy: { year: "desc" }, take: 1 },
      pendingUpdates: {
        where: { status: { in: ["PENDING", "REJECTED"] } },
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!employee) return null;

  const td1 = employee.td1Profiles[0];
  const latestUpdate = employee.pendingUpdates[0];
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-5">
      {params.submitted && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[14px] p-4 text-sm text-[#15803D]">
          Submitted — your changes will take effect once your employer approves them.
        </div>
      )}
      {params.error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[14px] p-4 text-sm text-[#991B1B]">
          {params.error}
        </div>
      )}
      {latestUpdate?.status === "PENDING" && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-4 text-sm text-[#92400E]">
          <p className="font-semibold mb-1">Awaiting employer approval</p>
          <ul className="list-disc ml-5">
            {describePayload(latestUpdate.payload as unknown as PendingPayload).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {latestUpdate?.status === "REJECTED" && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[14px] p-4 text-sm text-[#991B1B]">
          Your last submission was not approved
          {latestUpdate.reviewNote ? `: ${latestUpdate.reviewNote}` : "."} You
          can submit corrected details below.
        </div>
      )}

      <section className="bg-white border border-[#E7E5E4] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="text-base font-bold text-[#1C1917] mb-3">On file</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div><dt className="text-[#A8A29E] text-xs">SIN</dt><dd className="font-mono">{maskedSin(employee.sinEncrypted)}</dd></div>
          <div><dt className="text-[#A8A29E] text-xs">Direct deposit</dt><dd>{maskedBank(employee.bankEncrypted)}</dd></div>
          <div><dt className="text-[#A8A29E] text-xs">Email</dt><dd>{employee.email ?? "—"}</dd></div>
          <div><dt className="text-[#A8A29E] text-xs">Phone</dt><dd>{employee.phone ?? "—"}</dd></div>
        </dl>
        <p className="text-xs text-[#A8A29E] mt-3">
          Your SIN can&apos;t be changed here — contact your employer if it is wrong.
        </p>
      </section>

      <section className="bg-white border border-[#E7E5E4] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="text-base font-bold text-[#1C1917] mb-1">Update my details</h2>
        <p className="text-sm text-[#78716C] mb-4">
          Changes are sent to your employer for approval before they take effect.
        </p>
        <form action={submitPortalUpdate} className="space-y-5">
          <fieldset>
            <legend className="text-sm font-bold text-[#1C1917] mb-2">Contact & address</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls} htmlFor="firstName">First name</label><input id="firstName" name="firstName" defaultValue={employee.firstName} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="lastName">Last name</label><input id="lastName" name="lastName" defaultValue={employee.lastName} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={employee.email ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="phone">Phone</label><input id="phone" name="phone" defaultValue={employee.phone ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="addressLine1">Address line 1</label><input id="addressLine1" name="addressLine1" defaultValue={employee.addressLine1 ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="addressLine2">Address line 2</label><input id="addressLine2" name="addressLine2" defaultValue={employee.addressLine2 ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="city">City</label><input id="city" name="city" defaultValue={employee.city ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="province">Province (2-letter)</label><input id="province" name="province" maxLength={2} defaultValue={employee.province ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="postalCode">Postal code</label><input id="postalCode" name="postalCode" defaultValue={employee.postalCode ?? ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="dateOfBirth">Date of birth</label><input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={employee.dateOfBirth ? employee.dateOfBirth.toISOString().slice(0, 10) : ""} className={inputCls} /></div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-bold text-[#1C1917] mb-2">TD1 amounts</legend>
            <input type="hidden" name="td1Year" value={td1?.year ?? currentYear} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={labelCls} htmlFor="federalClaim">Federal claim ($)</label><input id="federalClaim" name="federalClaim" type="number" step="0.01" min="0" placeholder={td1?.federalClaim != null ? String(td1.federalClaim) : ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="provincialClaim">Provincial claim ($)</label><input id="provincialClaim" name="provincialClaim" type="number" step="0.01" min="0" placeholder={td1?.provincialClaim != null ? String(td1.provincialClaim) : ""} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="extraTaxPerPeriod">Extra tax per period ($)</label><input id="extraTaxPerPeriod" name="extraTaxPerPeriod" type="number" step="0.01" min="0" placeholder={td1?.extraTaxPerPeriod != null ? String(td1.extraTaxPerPeriod) : ""} className={inputCls} /></div>
            </div>
            <p className="text-xs text-[#A8A29E] mt-2">Leave a field blank to keep its current amount.</p>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-bold text-[#1C1917] mb-2">Direct deposit banking</legend>
            <p className="text-xs text-[#A8A29E] mb-2">Current: {maskedBank(employee.bankEncrypted)}. Fill all three fields to replace it; leave blank to keep it.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={labelCls} htmlFor="bankTransit">Transit (5 digits)</label><input id="bankTransit" name="bankTransit" inputMode="numeric" maxLength={5} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="bankInstitution">Institution (3 digits)</label><input id="bankInstitution" name="bankInstitution" inputMode="numeric" maxLength={3} className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="bankAccount">Account number</label><input id="bankAccount" name="bankAccount" inputMode="numeric" maxLength={12} className={inputCls} /></div>
            </div>
          </fieldset>

          <button type="submit" className="bg-[#B3261E] text-white text-sm font-semibold rounded-lg px-5 py-2.5">
            Submit for approval
          </button>
        </form>
      </section>
    </div>
  );
}
