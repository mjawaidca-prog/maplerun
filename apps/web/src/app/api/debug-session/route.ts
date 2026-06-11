import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  return NextResponse.json({
    hasSession: !!session,
    userId: session?.user?.id ?? null,
    email: session?.user?.email ?? null,
    companyId: session?.user?.companyId ?? null,
    cookies: "check your browser's Application > Cookies > localhost",
  });
}
