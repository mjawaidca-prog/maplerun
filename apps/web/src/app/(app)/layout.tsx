/**
 * Protected app layout with sidebar navigation.
 * All routes under (app) require authentication + company membership.
 */

import { requireCompany } from "@/lib/session";
import { signOut } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Building2,
  Users,
  ClipboardList,
  Settings,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/payroll", label: "Payroll", icon: ClipboardList },
  { href: "/company", label: "Company", icon: Building2 },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCompany();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border/40 bg-card flex flex-col">
        {/* Brand */}
        <div className="px-4 py-5 border-b border-border/40">
          <Link href="/app" className="flex items-center gap-2">
            <span className="text-xl" role="img" aria-label="Maple leaf">
              🍁
            </span>
            <span className="font-bold tracking-tight">MapleRun</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-border/40 px-4 py-4 space-y-3">
          <div className="truncate">
            <p className="text-sm font-medium truncate">{user.name ?? user.email}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
              <LogOut className="h-3 w-3" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
