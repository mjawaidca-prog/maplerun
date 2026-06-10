import PaychequeCalculator from "@/components/paycheque-calculator";

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      {/* Hero / header */}
      <header className="border-b border-border/40 bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16 text-center space-y-4">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-4xl" role="img" aria-label="Maple leaf">
              🍁
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              MapleRun
            </h1>
          </div>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Canadian payroll that runs itself.
            <br />
            Accurate CRA-compliant deductions in minutes.
          </p>
          <p className="text-sm text-muted-foreground/70">
            Free calculator &middot; 2026 T4127 tax tables &middot; All provinces & territories
          </p>
        </div>
      </header>

      {/* Calculator section */}
      <main className="flex-1 py-10 px-4">
        <PaychequeCalculator />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-4">
        <div className="max-w-3xl mx-auto text-center text-xs text-muted-foreground space-y-1">
          <p>
            MapleRun &copy; {new Date().getFullYear()} &mdash; Built for Canadian small businesses.
          </p>
          <p>
            Tax data sourced from CRA T4127 (121st ed., Jan 2026). Estimates only &mdash; always verify with{" "}
            <a
              href="https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/payroll-deductions-online-calculator.html"
              className="underline underline-offset-2 hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              CRA PDOC
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
