import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function AppPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="Maple leaf">
              🍁
            </span>
            <span className="font-bold tracking-tight text-lg">MapleRun</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {session.user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center space-y-4 py-16">
          <h2 className="text-3xl font-bold tracking-tight">
            Welcome to MapleRun
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your payroll dashboard will appear here. Phase 3 will build the
            employee management, pay run wizard, and remittance reports.
          </p>
          <p className="text-xs text-muted-foreground pt-4">
            Company ID: {session.user.companyId ?? "None (create or join a company)"}
          </p>
        </div>
      </main>
    </div>
  );
}
