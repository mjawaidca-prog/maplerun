"use server";

/**
 * Server actions for Employee CRUD with AES-256-GCM SIN encryption.
 *
 * Every action is tenant-scoped: companyId is injected from the session
 * via requireCompany(). No raw queries — all go through the Prisma client.
 */

import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createEmployee(formData: FormData) {
  const { companyId } = await requireCompany();

  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const sin = formData.get("sin") as string;
  const dateOfBirth = formData.get("dateOfBirth") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const addressLine1 = formData.get("addressLine1") as string;
  const city = formData.get("city") as string;
  const province = formData.get("province") as string;
  const postalCode = formData.get("postalCode") as string;
  const payGroupId = formData.get("payGroupId") as string;

  if (!firstName || !lastName || !sin) {
    throw new Error("First name, last name, and SIN are required.");
  }

  // Basic SIN validation (9 digits)
  const sinDigits = sin.replace(/\s/g, "");
  if (!/^\d{9}$/.test(sinDigits)) {
    throw new Error("SIN must be exactly 9 digits.");
  }

  // Verify pay group belongs to the company
  if (payGroupId) {
    const pg = await prisma.payGroup.findUnique({ where: { id: payGroupId } });
    if (!pg || pg.companyId !== companyId) {
      throw new Error("Invalid pay group.");
    }
  }

  const employee = await prisma.employee.create({
    data: {
      companyId,
      firstName,
      lastName,
      sinEncrypted: encrypt(sinDigits),
      email: email || null,
      phone: phone || null,
      addressLine1: addressLine1 || null,
      city: city || null,
      province: province || null,
      postalCode: postalCode || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    },
  });

  // Create default TD1 profile for 2026
  await prisma.tD1Profile.create({
    data: {
      employeeId: employee.id,
      year: 2026,
    },
  });

  // Create YTD ledger for 2026
  await prisma.ytdLedger.create({
    data: {
      employeeId: employee.id,
      year: 2026,
    },
  });

  revalidatePath("/employees");
  redirect("/employees");
}

export async function updateEmployee(formData: FormData) {
  const { companyId } = await requireCompany();

  const id = formData.get("id") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const addressLine1 = formData.get("addressLine1") as string;
  const city = formData.get("city") as string;
  const province = formData.get("province") as string;
  const postalCode = formData.get("postalCode") as string;
  const active = formData.get("active") === "true";

  if (!id || !firstName || !lastName) {
    throw new Error("First name and last name are required.");
  }

  // Verify ownership through company scoping
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found.");
  }

  // Handle SIN update if provided
  const sin = formData.get("sin") as string;
  const updateData: Record<string, unknown> = {
    firstName,
    lastName,
    email: email || null,
    phone: phone || null,
    addressLine1: addressLine1 || null,
    city: city || null,
    province: province || null,
    postalCode: postalCode || null,
    active,
  };

  if (sin) {
    const sinDigits = sin.replace(/\s/g, "");
    if (!/^\d{9}$/.test(sinDigits)) {
      throw new Error("SIN must be exactly 9 digits.");
    }
    updateData.sinEncrypted = encrypt(sinDigits);
  }

  await prisma.employee.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/employees");
  redirect("/employees");
}

export async function terminateEmployee(formData: FormData) {
  const { companyId } = await requireCompany();

  const id = formData.get("id") as string;
  if (!id) throw new Error("Employee ID is required.");

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found.");
  }

  await prisma.employee.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/app/employees");
}

export async function updateTD1Profile(formData: FormData) {
  const { companyId } = await requireCompany();

  const employeeId = formData.get("employeeId") as string;
  const year = parseInt(formData.get("year") as string);
  const federalClaim = formData.get("federalClaim") as string;
  const provincialClaim = formData.get("provincialClaim") as string;
  const extraTaxPerPeriod = formData.get("extraTaxPerPeriod") as string;
  const cppExempt = formData.get("cppExempt") === "true";
  const eiExempt = formData.get("eiExempt") === "true";

  if (!employeeId || !year) throw new Error("Employee and year are required.");

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found.");
  }

  await prisma.tD1Profile.upsert({
    where: { employeeId_year: { employeeId, year } },
    create: {
      employeeId,
      year,
      federalClaim: federalClaim ? parseFloat(federalClaim) : null,
      provincialClaim: provincialClaim ? parseFloat(provincialClaim) : null,
      extraTaxPerPeriod: extraTaxPerPeriod ? parseFloat(extraTaxPerPeriod) : null,
      cppExempt,
      eiExempt,
    },
    update: {
      federalClaim: federalClaim ? parseFloat(federalClaim) : null,
      provincialClaim: provincialClaim ? parseFloat(provincialClaim) : null,
      extraTaxPerPeriod: extraTaxPerPeriod ? parseFloat(extraTaxPerPeriod) : null,
      cppExempt,
      eiExempt,
    },
  });

  revalidatePath(`/app/employees/${employeeId}`);
}

export async function getEmployees() {
  const { companyId } = await requireCompany();

  return prisma.employee.findMany({
    where: { companyId },
    orderBy: { lastName: "asc" },
    include: {
      td1Profiles: { where: { year: 2026 }, take: 1 },
    },
  });
}

export async function deleteEmployee(formData: FormData) {
  "use server";
  const { companyId } = await requireCompany();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Employee ID is required.");
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee || employee.companyId !== companyId) throw new Error("Employee not found.");
  await prisma.employee.delete({ where: { id } });
  revalidatePath("/employees");
}

export async function getEmployee(id: string) {
  const { companyId } = await requireCompany();

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      td1Profiles: true,
      ytdLedgers: { where: { year: 2026 }, take: 1 },
    },
  });

  if (!employee || employee.companyId !== companyId) {
    throw new Error("Employee not found.");
  }

  return employee;
}
