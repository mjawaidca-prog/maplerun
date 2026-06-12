/**
 * Protected app layout — dark sidebar, user avatar, plan badge.
 */

import { requireCompany } from "@/lib/session";
import { auth, signOut } from "@/lib/auth";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart3,
  Building2,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/payroll", label: "Payroll", icon: ClipboardList },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/company", label: "Company", icon: Building2 },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCompany();
  const session = await auth();
  const email = session?.user?.email ?? user.email;
  const initial = (user.name ?? email ?? "U")[0].toUpperCase();

  return (
    <div className="min-h-screen flex bg-[#F5F5F4] dark:bg-[#0C0A09]">
      {/* Dark sidebar */}
      <aside className="w-[220px] bg-[#1C1917] min-h-screen flex-shrink-0 flex flex-col py-6 px-4 text-white">
        {/* Logo */}
        <Link href="/app" className="flex items-center gap-2 px-2 mb-6">
          <span className="text-[22px]">🍁</span>
          <span className="text-[17px] font-extrabold tracking-tight">MapleRun</span>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-[9px] text-sm font-medium text-[#A8A29E] hover:bg-[#292524] hover:text-[#E7E5E4] transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* New company */}
        <div className="px-2 pb-2">
          <Link href="/onboarding" className="flex items-center gap-2.5 px-3 py-2.5 rounded-[9px] text-sm font-medium text-[#A8A29E] hover:bg-[#292524] hover:text-[#E7E5E4] transition-colors">
            <span className="text-base">＋</span> New company
          </Link>
        </div>

        {/* Footer */}
        <div className="border-t border-[#292524] pt-4 mt-auto space-y-3">
          {/* Plan badge */}
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#E7E5E4] bg-[#292524] rounded-full px-2.5 py-1.5 ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
            Growth plan
          </span>

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

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="px-12 py-9">{children}</div>
      </main>
    </div>
  );
}
