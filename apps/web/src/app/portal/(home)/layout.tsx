/**
 * Employee portal — authenticated area guard (Wave 3, A4).
 *
 * Resolves the Clerk identity → Employee link on every request. Two
 * fail-closed states, rendered instead of the children:
 *  - no Clerk identity → "sign in" state;
 *  - identity but no linked/invited employee record → "not linked" state.
 */

import Link from "next/link";
import {
  resolvePortalEmployments,
  getActivePortalEmployee,
} from "@/lib/employee-portal-session";
import { selectPortalEmployment } from "../actions";

export default async function PortalHomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { identity, employments } = await resolvePortalEmployments();

  if (!identity) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h1 className="text-lg font-bold text-[#1C1917] mb-2">Sign in to view your portal</h1>
        <p className="text-sm text-[#57534E] leading-relaxed">
          Please sign in with the email address your employer sent your
          invitation to. If you don&apos;t have an account yet, sign up with
          that same email address first.
        </p>
      </div>
    );
  }

  if (employments.length === 0) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h1 className="text-lg font-bold text-[#1C1917] mb-2">This sign-in isn&apos;t linked yet</h1>
        <p className="text-sm text-[#57534E] leading-relaxed">
          You&apos;re signed in as <strong>{identity.email}</strong>, but no
          employer has invited that email address to their portal yet. Ask
          your employer to send your portal invitation to this address, then
          reload this page.
        </p>
      </div>
    );
  }

  const session = await getActivePortalEmployee();
  const active = session?.active ?? (employments[0] as (typeof employments)[number]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-lg font-bold text-[#1C1917]">
            {active.firstName} {active.lastName}
          </p>
          <p className="text-sm text-[#78716C]">{active.companyName}</p>
        </div>
        {employments.length > 1 && (
          <form action={selectPortalEmployment} className="flex items-center gap-2">
            <select
              name="employeeId"
              defaultValue={active.employeeId}
              className="text-sm border border-[#E7E5E4] rounded-lg px-2.5 py-2 bg-white"
            >
              {employments.map((e) => (
                <option key={e.employeeId} value={e.employeeId}>
                  {e.companyName}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="text-sm font-medium bg-[#1C1917] text-white rounded-lg px-3 py-2"
            >
              Switch
            </button>
          </form>
        )}
      </div>
      <nav className="flex gap-2 mb-6">
        <Link
          href="/portal"
          className="text-sm font-medium border border-[#E7E5E4] bg-white rounded-full px-4 py-1.5"
        >
          Pay stubs
        </Link>
        <Link
          href="/portal/profile"
          className="text-sm font-medium border border-[#E7E5E4] bg-white rounded-full px-4 py-1.5"
        >
          My details
        </Link>
      </nav>
      {children}
    </div>
  );
}
