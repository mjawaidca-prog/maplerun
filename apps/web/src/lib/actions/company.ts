"use server";

/**
 * Server actions for Company and Membership management.
 */

import { requireSession, requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCompany(formData: FormData) {
  const user = await requireSession();

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const defaultProvince = formData.get("defaultProvince") as string;
  const payFrequency = formData.get("payFrequency") as string;

  if (!name || !slug || !defaultProvince || !payFrequency) {
    throw new Error("All fields are required.");
  }

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(slug)) {
    throw new Error("Slug must be alphanumeric with optional hyphens.");
  }

  // Check slug uniqueness
  const existing = await prisma.company.findUnique({ where: { slug } });
  if (existing) {
    throw new Error("That slug is already taken. Choose another.");
  }

  const company = await prisma.company.create({
    data: {
      name,
      slug,
    },
  });

  // Create the owner membership
  await prisma.membership.create({
    data: {
      userId: user.id,
      companyId: company.id,
      role: "OWNER",
    },
  });

  // Create a default pay group
  await prisma.payGroup.create({
    data: {
      companyId: company.id,
      name: "Default",
      frequency: payFrequency.toUpperCase() as "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY",
      defaultProvince,
    },
  });

  revalidatePath("/app");
  redirect("/app");
}

export async function updateCompany(formData: FormData) {
  const { companyId } = await requireCompany();

  const name = formData.get("name") as string;
  if (!name) throw new Error("Company name is required.");

  await prisma.company.update({
    where: { id: companyId },
    data: { name },
  });

  revalidatePath("/app/company");
}

export async function getCompany() {
  const { companyId } = await requireCompany();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      payGroups: true,
    },
  });

  if (!company) throw new Error("Company not found.");
  return company;
}
