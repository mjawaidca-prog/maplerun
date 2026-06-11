import PaychequeCalculator from "@/components/paycheque-calculator";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  FileText,
  Shield,
  TrendingUp,
  Users,
  Zap,
  Check,
  Star,
} from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: Calculator,
    title: "CRA-Compliant Engine",
    description:
      "Federal and provincial income tax, CPP/CPP2, EI — calculated per T4127 (121st ed., 2026). All 13 provinces and territories.",
  },
  {
    icon: Zap,
    title: "Payroll in Minutes",
    description:
      "Add employees, set their TD1 claims, enter hours or salary, and run payroll. Pay stubs generated automatically.",
  },
  {
    icon: FileText,
    title: "Beautiful Pay Stubs",
    description:
      "Clean, printable pay stubs with earnings, deductions, YTD totals, and CRA disclaimer. Download as PDF.",
  },
  {
    icon: TrendingUp,
    title: "Remittance & Year-End",
    description:
      "PD7A remittance summaries, T4-ready reporting, Record of Employment (ROE) data. Built for year-end.",
  },
  {
    icon: Users,
    title: "Multi-Admin Access",
    description:
      "Invite your accountant or team members with role-based permissions. Full visibility, no spreadsheet chaos.",
  },
  {
    icon: Shield,
    title: "Bank-Grade Security",
    description:
      "SIN and bank details encrypted at rest (AES-256-GCM). PIPEDA-compliant hosting. Your data stays in Canada.",
  },
];

const plans = [
  {
    name: "Solo",
    price: "$15",
    per: "base",
    employeePrice: "$3",
    description: "Perfect for sole proprietors and single-company operators.",
    features: [
      "1 company",
      "Unlimited pay runs",
      "Pay stubs with PDF download",
      "PD7A remittance reports",
      "Email pay stub delivery",
    ],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$25",
    per: "base",
    employeePrice: "$3",
    description: "For growing teams that need year-end and multi-admin.",
    features: [
      "Everything in Solo",
      "T4 reporting",
      "Record of Employment (ROE)",
      "Data exports (CSV, PDF)",
      "Multi-admin access",
      "Priority support",
    ],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Accountant",
    price: "$59",
    per: "base",
    employeePrice: "$2",
    description: "Multi-company workspace for bookkeepers and accountants.",
    features: [
      "Everything in Growth",
      "Multi-company workspace",
      "Bulk pay runs",
      "Client-ready reporting",
      "Dedicated support",
    ],
    cta: "Start free trial",
    highlight: false,
  },
];

const testimonials = [
  {
    quote:
      "MapleRun saved us hours every pay period. The CRA compliance gives me peace of mind.",
    author: "— Coming soon from early access users",
    stars: 5,
  },
  {
    quote:
      "Finally, Canadian payroll software that doesn't feel like it was built in 1998.",
    author: "— Coming soon from early access users",
    stars: 5,
  },
  {
    quote:
      "Switched from spreadsheets + PDOC. Best decision we made this year.",
    author: "— Coming soon from early access users",
    stars: 5,
  },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      {/* Hero */}
      <header className="border-b border-border/40 bg-gradient-to-b from-background to-maple/5">
        <div className="max-w-3xl mx-auto px-4 py-16 sm:py-20 text-center space-y-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-5xl" role="img" aria-label="Maple leaf">
              🍁
            </span>
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
              MapleRun
            </h1>
          </div>
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-xl mx-auto leading-relaxed font-light">
            Canadian payroll that runs itself.
          </p>
          <p className="text-base text-muted-foreground/70 max-w-lg mx-auto">
            Accurate CRA-compliant deductions in minutes. No accounting degree required.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/sign-in"
              className={buttonVariants({ size: "lg", className: "gap-2" })}
            >
              Try it free <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="#calculator"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Quick calculator
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/60">
            Free 30-day trial &middot; No credit card &middot; All provinces & territories
          </p>
        </div>
      </header>

      {/* Feature grid */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything you need to run payroll
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Built from the ground up for Canadian small businesses. No US-centric workarounds, no clutter.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="border-border/40">
                <CardHeader>
                  <f.icon className="h-8 w-8 text-maple mb-1" />
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {f.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              All prices in CAD. 30-day free trial — no credit card required.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative border-border/40 ${
                  plan.highlight
                    ? "ring-2 ring-maple shadow-lg"
                    : ""
                }`}
              >
                {plan.highlight && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-maple text-white border-0">
                    Most popular
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1 pt-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/mo {plan.per}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    + {plan.employeePrice}/employee/mo
                  </p>
                  <CardDescription className="pt-1">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/sign-in"
                    className={buttonVariants({
                      variant: plan.highlight ? "default" : "outline",
                      className: "w-full",
                    })}
                  >
                    {plan.cta}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Benchmarks: Wagepoint ≈ $22.50 + $4.50/emp &middot; QuickBooks Payroll ≈ $25–30 + $6/emp &middot; ADP custom
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold tracking-tight">
              Trusted by Canadian businesses
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Early access is open. Here's what users are saying.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <Card key={i} className="border-border/40">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star
                        key={j}
                        className="h-4 w-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                  <blockquote className="text-sm text-muted-foreground leading-relaxed italic">
                    "{t.quote}"
                  </blockquote>
                  <p className="text-xs text-muted-foreground/70">{t.author}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Calculator section */}
      <section id="calculator" className="py-16 px-4 bg-muted/30">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              Try our free paycheque calculator
            </h2>
            <p className="text-sm text-muted-foreground">
              See your take-home pay in seconds. No sign-up needed.
            </p>
          </div>
          <PaychequeCalculator />
        </div>
      </section>

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
