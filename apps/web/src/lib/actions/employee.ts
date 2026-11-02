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
  const payType = formData.get("payType") as string;
  const payRate = formData.get("payRate") as string;
  const bankTransit = formData.get("bankTransit") as string;
  const bankInstitution = formData.get("bankInstitution") as string;
  const bankAccount = formData.get("bankAccount") as string;

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
      payType: payType || null,
      payRate: payRate ? parseFloat(payRate) : null,
      // Wave 1: persist the pay-group assignment (previously validated
      // above and then discarded — the run loader now scopes by it).
      payGroupId: payGroupId || null,
      // Wave 3 B6: per-employee province of employment (null = the pay
      // group's default province applies at run time).
      provinceOfEmployment: ((formData.get("provinceOfEmployment") as string) || "").trim() || null,
      // Wave 1 PR E: employment facts + vacation policy (schema PR A).
      startDate: (formData.get("startDate") as string)
        ? new Date(formData.get("startDate") as string)
        : null,
      jobTitle: ((formData.get("jobTitle") as string) || "").trim() || null,
      department: ((formData.get("department") as string) || "").trim() || null,
      vacationMode: ["ACCRUE", "PAYOUT", "NONE"].includes(formData.get("vacationMode") as string)
        ? (formData.get("vacationMode") as string)
        : "PAYOUT",
      vacationRatePct: formData.get("vacationRatePct")
        ? parseFloat(formData.get("vacationRatePct") as string)
        : null,
      bankEncrypted: (bankTransit || bankInstitution || bankAccount)
        ? encrypt(JSON.stringify({ transit: bankTransit, institution: bankInstitution, account: bankAccount }))
        : null,
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
  };

  // Only touch `active` when the form actually carries the field. The
  // edit form does not render one, and reading a missing field as
  // false silently deactivated the employee on every save (pre-Wave-1
  // bug). Reactivation clears the termination date (PR E).
  if (formData.has("active")) {
    updateData.active = formData.get("active") === "true";
    if (updateData.active) updateData.terminationDate = null;
  }

  // Wave 1 PR E+F — employment facts, vacation policy, pay terms,
  // date of birth, pay group and bank details are editable here too
  // (all were create-only before). Fields are applied only when the
  // submitting form carries them, so partial forms can't wipe data.
  if (formData.has("startDate")) {
    const v = formData.get("startDate") as string;
    updateData.startDate = v ? new Date(v) : null;
  }
  if (formData.has("jobTitle")) {
    updateData.jobTitle = ((formData.get("jobTitle") as string) || "").trim() || null;
  }
  if (formData.has("department")) {
    updateData.department = ((formData.get("department") as string) || "").trim() || null;
  }
  if (["ACCRUE", "PAYOUT", "NONE"].includes(formData.get("vacationMode") as string)) {
    updateData.vacationMode = formData.get("vacationMode") as string;
  }
  if (formData.has("vacationRatePct")) {
    const v = formData.get("vacationRatePct") as string;
    updateData.vacationRatePct = v ? parseFloat(v) : null;
  }
  if (formData.has("payType")) {
    updateData.payType = (formData.get("payType") as string) || null;
  }
  if (formData.has("payRate")) {
    const v = parseFloat(formData.get("payRate") as string);
    if (Number.isFinite(v)) updateData.payRate = v;
  }
  if (formData.has("dateOfBirth")) {
    const v = formData.get("dateOfBirth") as string;
    updateData.dateOfBirth = v ? new Date(v) : null;
  }
  if (formData.has("payGroupId")) {
    updateData.payGroupId = (formData.get("payGroupId") as string) || null;
  }
  // Wave 3 B6: province of employment override (blank = pay-group default).
  if (formData.has("provinceOfEmployment")) {
    updateData.provinceOfEmployment = ((formData.get("provinceOfEmployment") as string) || "").trim() || null;
  }
  const bankTransit = (formData.get("bankTransit") as string) || "";
  const bankInstitution = (formData.get("bankInstitution") as string) || "";
  const bankAccount = (formData.get("bankAccount") as string) || "";
  if (bankTransit || bankInstitution || bankAccount) {
    updateData.bankEncrypted = encrypt(
      JSON.stringify({ transit: bankTransit, institution: bankInstitution, account: bankAccount }),
    );
  }

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
    // Wave 1 PR E: termination is a dated event, not just a flag —
    // ROE and final-pay work (Wave 2) key off terminationDate.
    data: { active: false, terminationDate: new Date() },
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
