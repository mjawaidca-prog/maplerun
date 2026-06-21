import { NextResponse } from "next/server";
import { generateEftFile } from "@/lib/actions/eft";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const payRunId = searchParams.get("payRunId");
  if (!payRunId) return NextResponse.json({ error: "payRunId required" }, { status: 400 });

  try {
    const { filename, content } = await generateEftFile(payRunId);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
