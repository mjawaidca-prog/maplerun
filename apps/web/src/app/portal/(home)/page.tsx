/**
 * Employee portal — home: my pay stubs (Wave 3, A4).
 *
 * Lists the signed-in employee's items from FINALIZED pay runs only,
 * scoped by the resolved employment (never by client input).
 */

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActivePortalEmployee } from "@/lib/employee-portal-session";

function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default async function PortalHomePage() {
  const session = await getActivePortalEmployee();
  if (!session) return null;
  const { active } = session;

  const [items, pending] = await Promise.all([
    prisma.payRunItem.findMany({
      where: { employeeId: active.employeeId, payRun: { status: "FINALIZED" } },
      include: {
        payRun: { select: { payDate: true, periodStart: true, periodEnd: true } },
      },
      orderBy: { payRun: { payDate: "desc" } },
      take: 50,
    }),
    prisma.employeePendingUpdate.findFirst({
      where: { employeeId: active.employeeId, status: "PENDING" },
      select: { id: true, submittedAt: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      {pending && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-4 text-sm text-[#92400E]">
          You have changes awaiting your employer&apos;s approval (submitted{" "}
          {pending.submittedAt.toLocaleDateString("en-CA")}).{" "}
          <Link href="/portal/profile" className="font-semibold underline">
            View
          </Link>
        </div>
      )}

      <section className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-5 py-4 border-b border-[#F0EFED]">
          <h2 className="text-base font-bold text-[#1C1917]">Pay stubs</h2>
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#78716C]">
            No pay stubs yet — your finalized pay stubs will appear here after
            each pay run.
          </p>
        ) : (
          <ul>
            {items.map((item) => (
              <li
                key={item.id}
                className="px-5 py-4 border-b border-[#F0EFED] last:border-b-0 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[#1C1917]">
                    Pay date {item.payRun.payDate}
                  </p>
                  <p className="text-xs text-[#A8A29E]">
                    Period {item.payRun.periodStart} – {item.payRun.periodEnd} ·
                    Gross {fmt(item.gross)} · Deductions {fmt(item.totalDeductions)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-[#1C1917]">
                    Net {fmt(item.netPay)}
                  </span>
                  <a
                    href={`/portal/stubs/${item.id}/pdf`}
                    className="text-sm font-medium bg-[#1C1917] text-white rounded-lg px-3 py-1.5"
                  >
                    PDF
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-[#E7E5E4] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="text-base font-bold text-[#1C1917] mb-1">Tax slips</h2>
        <p className="text-sm text-[#78716C]">
          Your T4 will appear here after your employer completes year-end.
        </p>
      </section>
    </div>
  );
}
