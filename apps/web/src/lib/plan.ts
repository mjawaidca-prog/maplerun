/**
 * Plan tiering — one product, three plans.
 *
 * Principle: never refactor, only wrap or extend. Every feature gate
 * reads company.plan and renders less (not disabled) at lower tiers.
 *
 * All fields/functions in this file are pure and side-effect-free.
 */

// ── Types ────────────────────────────────────────────────────────────────

export type Plan = "solo" | "growth" | "accountant";

// ── Feature capability map ───────────────────────────────────────────────

/** Features unlock at this plan tier and above. */
export const REQUIRES: Record<string, Plan> = {
  // Core (all plans)
  payRunWizard: "solo",
  payStubs: "solo",
  employees: "solo",
  company: "solo",

  // Growth unlocks
  timesheets: "growth",
  remittances: "growth",
  eft: "growth",
  roe: "growth",
  reportsCore: "growth",
  reportsDashboard: "growth",
  payrollSummary: "growth",
  payTypesExtra: "growth", // bonus, stat, vacation
  comparePriorRun: "growth",

  // Accountant unlocks
  yearEndCentre: "accountant",
  gl: "accountant",
  auditLog: "accountant",
  quebec: "accountant",
  compliancePanel: "accountant",
  customReports: "accountant",
  payrollJournal: "accountant",
  payTypesFull: "accountant", // retro, commission, gross-up, GL code
};

const TIERS: Plan[] = ["solo", "growth", "accountant"];

/** Returns true if the given plan unlocks a feature. */
export function can(plan: Plan | undefined | null, feature: string): boolean {
  if (!plan) return false;
  const required = REQUIRES[feature];
  if (!required) return false; // unknown feature — deny
  return TIERS.indexOf(plan) >= TIERS.indexOf(required);
}

// ── Plan metadata (display) ──────────────────────────────────────────────

export const PLAN_META: Record<Plan, { label: string; dot: string; price: string }> = {
  solo: { label: "Solo plan", dot: "#0891B2", price: "$15" },
  growth: { label: "Growth plan", dot: "#16A34A", price: "$25" },
  accountant: { label: "Accountant plan", dot: "#B3261E", price: "$59" },
};

// ── Sidebar navigation config ────────────────────────────────────────────

export interface NavItem {
  icon?: string;
  label?: string;
  href?: string;
  section?: string;
  feature?: string; // gated by can()
}

// Sidebar: only links to routes that exist today.
// Extra items gated behind feature flags — greyed out if plan doesn't qualify.
export const SIDEBAR_NAV: Record<Plan, NavItem[]> = {
  solo: [
    { icon: "🏠", label: "Dashboard", href: "/app" },
    { icon: "👥", label: "Employees", href: "/employees" },
    { icon: "💵", label: "Run Payroll", href: "/payroll" },
    { icon: "📊", label: "Reports", href: "/reports" },
    { icon: "⚙️", label: "Company", href: "/company" },
  ],
  growth: [
    { icon: "🏠", label: "Dashboard", href: "/app" },
    { icon: "👥", label: "Employees", href: "/employees" },
    { icon: "💵", label: "Run Payroll", href: "/payroll" },
    { icon: "📊", label: "Reports", href: "/reports" },
    { icon: "📋", label: "ROE", href: "/reports/roe" },
    { icon: "🧾", label: "T4 Slips", href: "/reports/t4" },
    { icon: "📄", label: "Pay Summary", href: "/reports/summary" },
    { icon: "⚙️", label: "Company", href: "/company" },
  ],
  accountant: [
    { icon: "🏠", label: "Dashboard", href: "/app" },
    { icon: "👥", label: "Employees", href: "/employees" },
    { icon: "💵", label: "Run Payroll", href: "/payroll" },
    { icon: "📊", label: "Reports", href: "/reports" },
    { icon: "📋", label: "ROE", href: "/reports/roe" },
    { icon: "🧾", label: "T4 Slips", href: "/reports/t4" },
    { icon: "📄", label: "Pay Summary", href: "/reports/summary" },
    { icon: "🗓", label: "Year-End", href: "/reports/t4" },
    { icon: "⚙️", label: "Company", href: "/company" },
  ],
};

// ── Dashboard widget config ──────────────────────────────────────────────

export interface DashboardWidget {
  key: string;
  feature?: string;
}

export const DASHBOARD_WIDGETS: Record<Plan, DashboardWidget[]> = {
  solo: [
    { key: "employees" }, { key: "payGroups" }, { key: "nextPayRun" }, { key: "ytdPayroll" },
  ],
  growth: [
    { key: "employees" }, { key: "payGroups" }, { key: "nextPayRun" }, { key: "ytdPayroll" },
    { key: "remittanceDue", feature: "remittances" }, { key: "employerCost", feature: "remittances" },
  ],
  accountant: [
    { key: "employees" }, { key: "payGroups" }, { key: "nextPayRun" }, { key: "ytdPayroll" },
    { key: "remittanceDue", feature: "remittances" }, { key: "employerCost", feature: "remittances" },
    { key: "complianceStatus", feature: "compliancePanel" }, { key: "yearEndReadiness", feature: "yearEndCentre" },
  ],
};
