import { getAuthMode } from "@/lib/auth-mode";
import { prisma } from "@/lib/prisma";
import { getAuthUserId, getCompanyId } from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * Session diagnostic — reports through the mode-dispatched seam
 * (lib/session.ts) so it works in both legacy and Clerk modes.
 */
export async function GET() {
  const userId = await getAuthUserId();
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      })
    : null;
  return NextResponse.json({
    authMode: getAuthMode(),
    hasSession: !!userId,
    userId: userId ?? null,
    email: user?.email ?? null,
    companyId: await getCompanyId(),
    cookies: "check your browser's Application > Cookies > localhost",
  });
}
