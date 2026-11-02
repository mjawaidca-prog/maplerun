"use server";

/**
 * Employee portal — EMPLOYEE-side actions (Wave 3, A4).
 *
 * Every action resolves the active employment from the Clerk seam
 * (getActivePortalEmployee) and scopes writes to that employee only.
 * Submissions become EmployeePendingUpdate rows — they take effect only
 * when the employer approves them.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import {
  getActivePortalEmployee,
  PORTAL_COMPANY_COOKIE,
} from "@/lib/employee-portal-session";
import {
  sanitizePendingPayload,
  validateBankDetails,
  type PendingPayload,
} from "@/lib/employee-portal-core";

function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function moneyOrUndefined(formData: FormData, name: string): number | undefined {
  const s = str(formData, name);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Switch the active employment (multi-company employees only). */
export async function selectPortalEmployment(formData: FormData) {
  const session = await getActivePortalEmployee();
  if (!session) redirect("/portal");
  const employeeId = str(formData, "employeeId");
  if (!session.employments.some((e) => e.employeeId === employeeId)) {
    redirect("/portal");
  }
  const cookieStore = await cookies();
  cookieStore.set(PORTAL_COMPANY_COOKIE, employeeId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/portal",
    maxAge: 60 * 60 * 24 * 180,
  });
  revalidatePath("/portal", "layout");
  redirect("/portal");
}

/**
 * Submit profile / TD1 / banking changes for employer approval.
 * Banking is encrypted here, before it is stored in the pending payload.
 */
export async function submitPortalUpdate(formData: FormData) {
  const session = await getActivePortalEmployee();
  if (!session) redirect("/portal");
  const { active } = session;

  const raw: Record<string, unknown> = {};

  const profile: Record<string, unknown> = {};
  for (const key of [
    "firstName", "lastName", "phone", "email",
    "addressLine1", "addressLine2", "city", "province", "postalCode", "dateOfBirth",
  ]) {
    const v = str(formData, key);
    if (v) profile[key] = v;
  }
  if (Object.keys(profile).length > 0) raw.profile = profile;

  const yearRaw = str(formData, "td1Year");
  const td1: Record<string, unknown> = {};
  const fed = moneyOrUndefined(formData, "federalClaim");
  const prov = moneyOrUndefined(formData, "provincialClaim");
  const extra = moneyOrUndefined(formData, "extraTaxPerPeriod");
  if (fed !== undefined) td1.federalClaim = fed;
  if (prov !== undefined) td1.provincialClaim = prov;
  if (extra !== undefined) td1.extraTaxPerPeriod = extra;
  if (Object.keys(td1).length > 0) {
    td1.year = yearRaw ? Number(yearRaw) : new Date().getFullYear();
    raw.td1 = td1;
  }

  const transit = str(formData, "bankTransit");
  const institution = str(formData, "bankInstitution");
  const account = str(formData, "bankAccount");
  if (transit || institution || account) {
    const bank = validateBankDetails({ transit, institution, account });
    raw.bankEncrypted = encrypt(JSON.stringify(bank));
  }

  let payload: PendingPayload;
  try {
    payload = sanitizePendingPayload(raw);
  } catch (e) {
    redirect(`/portal/profile?error=${encodeURIComponent(e instanceof Error ? e.message : "Invalid submission.")}`);
  }

  await prisma.$transaction(async (tx) => {
    // A new submission supersedes the employee's previous PENDING row.
    await tx.employeePendingUpdate.updateMany({
      where: { employeeId: active.employeeId, status: "PENDING" },
      data: { status: "SUPERSEDED", reviewedAt: new Date() },
    });
    await tx.employeePendingUpdate.create({
      data: {
        employeeId: active.employeeId,
        companyId: active.companyId,
        payload: JSON.parse(JSON.stringify(payload)),
        status: "PENDING",
      },
    });
  });

  revalidatePath("/portal/profile");
  revalidatePath("/portal");
  redirect("/portal/profile?submitted=1");
}
