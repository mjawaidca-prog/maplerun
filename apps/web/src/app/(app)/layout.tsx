/**
 * Protected app layout — plan-aware dark sidebar.
 */
import { requireCompany } from "@/lib/session";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SIDEBAR_NAV, can, PLAN_META, REQUIRES as REQ_MAP, type NavItem, type Plan } from "@/lib/plan";
import { CompanySwitcher } from "@/components/company-switcher";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCompany();
  const session = await auth();
  const email = session?.user?.email ?? user.email;
  const initial = (user.name ?? email ?? "U")[0].toUpperCase();

  // Get company plan + all user companies for switcher
  const [company, allCompanies] = await Promise.all([
    prisma.company.findUnique({ where: { id: user.companyId }, select: { plan: true } }),
    prisma.company.findMany({
      where: { memberships: { some: { userId: session?.user?.id } } },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const plan: Plan = (company?.plan as Plan) ?? "growth";
  const meta = PLAN_META[plan];
  const nav = SIDEBAR_NAV[plan];

  return (
    <div className="min-h-screen flex bg-[#F5F5F4] dark:bg-[#0C0A09]">
      <aside className="w-[220px] bg-[#1C1917] min-h-screen flex-shrink-0 flex flex-col py-6 px-4 text-white">
        {/* Logo */}
        <Link href="/app" className="flex items-center px-2 mb-6">
          <Logo size={26} />
        </Link>

        {/* Navigation — plan-aware */}
        <nav className="flex-1 space-y-0.5">
          {nav.map((item, i) => {
            // Section header
            if (item.section) {
              return (
                <div key={`sec-${i}`} className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#57534E] px-3 pt-3.5 pb-1">
                  {item.section}
                </div>
              );
            }

            // Gated feature — show upgrade hint at Solo
            if (item.feature && !can(plan, item.feature)) {
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-[9px] text-sm font-medium text-[#44403C] cursor-not-allowed opacity-50"
                  title={`${item.label} requires ${requiredPlan(item.feature!)} plan`}
                >
                  <span className="text-base opacity-50">{item.icon}</span>
                  {item.label}
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href ?? "#"}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-[9px] text-sm font-medium text-[#A8A29E] hover:bg-[#292524] hover:text-[#E7E5E4] transition-colors"
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* New company */}
        <Link href="/onboarding" className="flex items-center gap-2.5 px-3 py-2.5 rounded-[9px] text-sm font-medium text-[#A8A29E] hover:bg-[#292524] hover:text-[#E7E5E4] transition-colors no-underline">
          <span className="text-base">＋</span> New company
        </Link>

        {/* Company switcher (Accountant plan only) */}
        {can(plan, "roe") ? (
          <CompanySwitcher companies={allCompanies} activeId={user.companyId} />
        ) : (
          allCompanies.length > 1 && (
            <div className="px-2">
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#57534E] mb-1.5">Companies</p>
              <CompanySwitcher companies={allCompanies} activeId={user.companyId} />
            </div>
          )
        )}

        {/* Footer */}
        <div className="border-t border-[#292524] pt-4 mt-auto space-y-3">
          {/* Plan badge — links to company settings */}
          <Link href="/company" className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#E7E5E4] bg-[#292524] rounded-full px-2.5 py-1.5 ml-2 no-underline hover:bg-[#3F1413] transition-colors">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
            {meta.label}
          </Link>

          {/* User row */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#B3261E] to-[#E56A5C] flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#FAFAF9] truncate">
                {user.name ?? email}
              </p>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="text-[11px] text-[#78716C] hover:text-[#A8A29E] cursor-pointer">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="px-12 py-9">{children}</div>
      </main>
    </div>
  );
}

/** Helper to resolve which plan a feature requires (for display). */
function requiredPlan(feature: string): string {
  return (REQ_MAP as Record<string, string>)[feature] ?? "growth";
}
