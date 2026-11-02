/**
 * Employee portal — employer admin (Wave 3, A4).
 *
 * Invite / revoke portal access per employee and review self-service
 * change requests. Employees sign in with Clerk using the email on file;
 * submissions take effect only when approved here.
 *
 * Note: linked from Help ("Employee portal & self-onboarding") for now —
 * a Settings tab link belongs with Wave 1's company-page rework.
 */

import { prisma } from "@/lib/prisma";
import { requireCompany } from "@/lib/session";
import {
  inviteEmployeeToPortal,
  revokeEmployeePortalAccess,
  approvePendingUpdate,
  rejectPendingUpdate,
} from "@/app/actions/employee-portal";
import { describePayload, type PendingPayload } from "@/lib/employee-portal-core";

function portalStatus(e: { clerkUserId: string | null; portalInvitedAt: Date | null }): string {
  if (e.clerkUserId) return "Active — employee has signed in";
  if (e.portalInvitedAt) return `Invited ${e.portalInvitedAt.toLocaleDateString("en-CA")} — awaiting first sign-in`;
  return "Not invited";
}

export default async function EmployeePortalAdminPage() {
  const { companyId } = await requireCompany();

  const [employees, pending] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true, firstName: true, lastName: true, email: true, active: true,
        clerkUserId: true, portalInvitedAt: true,
      },
    }),
    prisma.employeePendingUpdate.findMany({
      where: { companyId, status: "PENDING" },
      orderBy: { submittedAt: "asc" },
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const card = "bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]";
  const btn = "text-[13px] font-medium rounded-lg px-3 py-1.5";
  const btnDark = `${btn} bg-[#1C1917] text-white`;
  const btnGhost = `${btn} border border-[#E7E5E4] bg-white text-[#57534E]`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#1C1917]">Employee portal</h1>
        <p className="text-sm text-[#78716C] mt-1 max-w-2xl">
          Invite employees to view their pay stubs and keep their own details
          up to date. Employees sign in with the email address on their
          record. Anything they submit — address, TD1 amounts, banking —
          waits here for your approval before it takes effect.
        </p>
      </div>

      <section className={card}>
        <div className="px-5 py-4 border-b border-[#F0EFED]">
          <h2 className="text-base font-bold text-[#1C1917]">Employees</h2>
        </div>
        {employees.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#78716C]">No employees yet.</p>
        ) : (
          <ul>
            {employees.map((e) => (
              <li key={e.id} className="px-5 py-3.5 border-b border-[#F0EFED] last:border-b-0 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#1C1917]">
                    {e.firstName} {e.lastName}
                    {!e.active && <span className="text-[#A8A29E] font-normal"> · inactive</span>}
                  </p>
                  <p className="text-xs text-[#A8A29E]">
                    {e.email ?? "No email on file"} · {portalStatus(e)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={inviteEmployeeToPortal.bind(null, e.id)}>
                    <button type="submit" className={btnDark} disabled={!e.email}>
                      {e.portalInvitedAt || e.clerkUserId ? "Re-invite" : "Invite"}
                    </button>
                  </form>
                  {(e.portalInvitedAt || e.clerkUserId) && (
                    <form action={revokeEmployeePortalAccess.bind(null, e.id)}>
                      <button type="submit" className={btnGhost}>Revoke</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <div className="px-5 py-4 border-b border-[#F0EFED]">
          <h2 className="text-base font-bold text-[#1C1917]">
            Change requests awaiting approval
            {pending.length > 0 && <span className="text-[#B3261E]"> · {pending.length}</span>}
          </h2>
        </div>
        {pending.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#78716C]">Nothing to review.</p>
        ) : (
          <ul>
            {pending.map((u) => (
              <li key={u.id} className="px-5 py-4 border-b border-[#F0EFED] last:border-b-0">
                <p className="text-sm font-semibold text-[#1C1917]">
                  {u.employee.firstName} {u.employee.lastName}
                  <span className="text-[#A8A29E] font-normal text-xs">
                    {" "}· submitted {u.submittedAt.toLocaleDateString("en-CA")}
                  </span>
                </p>
                <ul className="list-disc ml-5 mt-1.5 text-sm text-[#57534E]">
                  {describePayload(u.payload as unknown as PendingPayload).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 mt-3">
                  <form action={approvePendingUpdate.bind(null, u.id)}>
                    <button type="submit" className={btnDark}>Approve & apply</button>
                  </form>
                  <form action={rejectPendingUpdate.bind(null, u.id)} className="flex gap-2">
                    <input
                      name="note"
                      placeholder="Reason (optional, shown to employee)"
                      className="text-[13px] border border-[#E7E5E4] rounded-lg px-3 py-1.5 w-64"
                    />
                    <button type="submit" className={btnGhost}>Reject</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
