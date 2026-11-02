"use server";

/**
 * Employee portal — EMPLOYER-side actions (Wave 3, A4).
 *
 * All actions run under the employer's normal session (requireCompany) and
 * are company-scoped. Nothing here edits Wave 1's employee.ts: invite /
 * revoke write only the portal columns; approve applies a pending payload
 * directly through Prisma in one transaction.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/session";
import { sendEmployeePortalInviteEmail } from "@/lib/employee-portal-email";
import type { PendingPayload } from "@/lib/employee-portal-core";

const PORTAL_PATH = "/company/employee-portal";

/** Invite (or re-invite) an employee to the portal by their email on file. */
export async function inviteEmployeeToPortal(employeeId: string) {
  const { companyId } = await requireCompany();
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  if (!employee) throw new Error("Employee not found.");
  if (!employee.email) {
    throw new Error("Add an email address for this employee before inviting them.");
  }

  await prisma.employee.update({
    where: { id: employee.id },
    data: { portalInvitedAt: new Date() },
  });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });
  await sendEmployeePortalInviteEmail({
    to: employee.email,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    companyName: company?.name ?? "Your employer",
  });

  revalidatePath(PORTAL_PATH);
}

/** Revoke portal access: unlink the Clerk identity and clear the invite. */
export async function revokeEmployeePortalAccess(employeeId: string) {
  const { companyId } = await requireCompany();
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true },
  });
  if (!employee) throw new Error("Employee not found.");

  await prisma.employee.update({
    where: { id: employee.id },
    data: { clerkUserId: null, portalInvitedAt: null },
  });
  revalidatePath(PORTAL_PATH);
}

/**
 * Approve a pending update: apply its payload to the employee record,
 * TD1 profile, and banking — atomically — then mark it APPROVED.
 */
export async function approvePendingUpdate(updateId: string) {
  const { companyId, id: userId } = await requireCompany();
  const update = await prisma.employeePendingUpdate.findFirst({
    where: { id: updateId, companyId, status: "PENDING" },
  });
  if (!update) throw new Error("Pending update not found.");

  const payload = update.payload as unknown as PendingPayload;

  await prisma.$transaction(async (tx) => {
    if (payload.profile) {
      const p = payload.profile;
      await tx.employee.update({
        where: { id: update.employeeId },
        data: {
          ...(p.firstName !== undefined ? { firstName: p.firstName } : {}),
          ...(p.lastName !== undefined ? { lastName: p.lastName } : {}),
          ...(p.phone !== undefined ? { phone: p.phone } : {}),
          ...(p.email !== undefined ? { email: p.email } : {}),
          ...(p.addressLine1 !== undefined ? { addressLine1: p.addressLine1 } : {}),
          ...(p.addressLine2 !== undefined ? { addressLine2: p.addressLine2 } : {}),
          ...(p.city !== undefined ? { city: p.city } : {}),
          ...(p.province !== undefined ? { province: p.province } : {}),
          ...(p.postalCode !== undefined ? { postalCode: p.postalCode } : {}),
          ...(p.dateOfBirth !== undefined
            ? { dateOfBirth: new Date(`${p.dateOfBirth}T00:00:00Z`) }
            : {}),
        },
      });
    }
    if (payload.td1) {
      const t = payload.td1;
      await tx.tD1Profile.upsert({
        where: { employeeId_year: { employeeId: update.employeeId, year: t.year } },
        create: {
          employeeId: update.employeeId,
          year: t.year,
          federalClaim: t.federalClaim ?? null,
          provincialClaim: t.provincialClaim ?? null,
          extraTaxPerPeriod: t.extraTaxPerPeriod ?? null,
        },
        update: {
          ...(t.federalClaim !== undefined ? { federalClaim: t.federalClaim } : {}),
          ...(t.provincialClaim !== undefined ? { provincialClaim: t.provincialClaim } : {}),
          ...(t.extraTaxPerPeriod !== undefined ? { extraTaxPerPeriod: t.extraTaxPerPeriod } : {}),
        },
      });
    }
    if (payload.bankEncrypted) {
      await tx.employee.update({
        where: { id: update.employeeId },
        data: { bankEncrypted: payload.bankEncrypted },
      });
    }
    await tx.employeePendingUpdate.update({
      where: { id: update.id },
      data: { status: "APPROVED", reviewedAt: new Date(), reviewedByUserId: userId },
    });
  });

  revalidatePath(PORTAL_PATH);
}

/** Reject a pending update (optionally with a note the employee can see). */
export async function rejectPendingUpdate(updateId: string, formData?: FormData) {
  const { companyId, id: userId } = await requireCompany();
  const note =
    formData && typeof formData.get("note") === "string"
      ? (formData.get("note") as string).slice(0, 500)
      : undefined;

  const res = await prisma.employeePendingUpdate.updateMany({
    where: { id: updateId, companyId, status: "PENDING" },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedByUserId: userId,
      ...(note ? { reviewNote: note } : {}),
    },
  });
  if (res.count === 0) throw new Error("Pending update not found.");
  revalidatePath(PORTAL_PATH);
}
