import { NextResponse } from "next/server";
import {
  generateRoeBlkFile,
  type RoeOtherPaymentInput,
} from "@/lib/actions/roe";

/**
 * GET /api/roe/[employeeId]?reason=A&vacation=123.45&other=<url-encoded JSON>
 *
 * Downloads the ROE Web Payroll Extract (.BLK) file for one employee.
 * Query params mirror the ROE detail page's editable form:
 *  - reason:   Block 16 reason code (defaults to "A")
 *  - vacation: Block 17A vacation pay on termination, dollars (defaults to
 *              the employee's accrued vacation balance inside the action)
 *  - other:    URL-encoded JSON array of Block 17C payments
 *              [{ code, amount, startDate?, endDate? }]
 *
 * The SIN is decrypted only inside `generateRoeBlkFile`; errors returned
 * here are the action's already-scrubbed messages.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ employeeId: string }> },
) {
  const { employeeId } = await ctx.params;
  const { searchParams } = new URL(request.url);

  const reason = searchParams.get("reason") ?? "A";

  const vacationRaw = searchParams.get("vacation");
  const vacation =
    vacationRaw !== null && vacationRaw !== ""
      ? Number(vacationRaw)
      : undefined;
  if (vacation !== undefined && !Number.isFinite(vacation)) {
    return NextResponse.json(
      { error: "vacation must be a number" },
      { status: 400 },
    );
  }

  let otherPayments: RoeOtherPaymentInput[] | undefined;
  const otherRaw = searchParams.get("other");
  if (otherRaw) {
    try {
      const parsed: unknown = JSON.parse(otherRaw);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      otherPayments = parsed as RoeOtherPaymentInput[];
    } catch {
      return NextResponse.json(
        { error: "other must be a JSON array of payments" },
        { status: 400 },
      );
    }
  }

  try {
    const { filename, content } = await generateRoeBlkFile(
      employeeId,
      reason,
      { vacationPayOnTermination: vacation, otherPayments },
    );
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
