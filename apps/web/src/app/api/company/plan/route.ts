import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId, plan } = await request.json();
  if (!companyId || !plan) {
    return NextResponse.json({ error: "companyId and plan required" }, { status: 400 });
  }

  if (!["solo", "growth", "accountant"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Verify user is OWNER of this company
  const membership = await prisma.membership.findFirst({
    where: { userId: userId, companyId, role: "OWNER" },
  });
  if (!membership) {
    return NextResponse.json({ error: "Only the company owner can change the plan" }, { status: 403 });
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { plan },
  });

  return NextResponse.json({ success: true, plan });
}
