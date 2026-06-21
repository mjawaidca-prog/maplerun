/**
 * Company settings — Profile / Payroll / Billing tabs.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PLAN_META, type Plan } from "@/lib/plan";
import { UpgradePlanButton } from "@/components/upgrade-plan-button";
import { PlanSwitcher } from "@/components/plan-switcher";
import Link from "next/link";

type SearchParams = Promise<{ tab?: string }>;

export default async function CompanySettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const { companyId } = await requireCompany();
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return null;

  const { tab: rawTab } = await searchParams;
  const activeTab = rawTab ?? "profile";
  const plan: Plan = (company.plan as Plan) ?? "growth";
  const meta = PLAN_META[plan];

  const tabs = [
    { key: "profile", label: "Profile" },
    { key: "payroll", label: "Payroll" },
    { key: "billing", label: "Billing" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Company</h1>
        <p className="text-sm text-muted-foreground mt-1">{company.name}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-6 border-b border-[#E7E5E4] mb-6">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/company?tab=${t.key}`}
            className={`text-sm font-semibold pb-3 border-b-2 -mb-[1px] no-underline ${
              activeTab === t.key
                ? "text-[#B3261E] border-[#B3261E]"
                : "text-[#A8A29E] border-transparent hover:text-[#1C1917]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── Profile tab ── */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-[1.1fr_1fr] gap-5 items-start">
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-[22px] py-[18px] border-b border-[#F0EFED] flex justify-between items-center">
              <span className="text-base font-bold">Company profile</span>
              <button className="rounded-[9px] border border-[#D6D3D1] bg-white px-4 py-2 text-[13px] font-semibold">Edit</button>
            </div>
            <div className="p-[22px] space-y-4">
              {[
                ["Legal name", company.name],
                ["Workspace slug", company.slug],
                ["Status", company.active ? "Active" : "Inactive"],
                ["Created", company.createdAt.toISOString().slice(0, 10)],
              ].map(([k, v]) => (
                <div key={k}><label className="text-xs font-semibold text-[#78716C] block mb-1.5">{k}</label>
                  <input className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans" value={v as string} disabled />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-[22px] py-[18px] border-b border-[#F0EFED]"><span className="text-base font-bold">Plan</span></div>
            <div className="p-[22px]">
              <PlanSwitcher currentPlan={plan} companyId={company.id} />
            </div>
          </div>
        </div>
      )}

      {/* ── Payroll tab ── */}
      {activeTab === "payroll" && (
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-[22px] py-[18px] border-b border-[#F0EFED] flex justify-between items-center">
            <span className="text-base font-bold">Tax rates & limits</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] rounded-full px-[11px] py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />Active rates · 2026
            </span>
          </div>
          <div className="p-[22px]">
            <div className="border border-[#E7E5E4] rounded-[10px] overflow-hidden">
              {[
                ["CPP rate / max pensionable", "5.95% · $74,600"],
                ["CPP2 rate / ceiling", "4.00% · $85,000"],
                ["EI rate (employee)", "1.63% · $68,900"],
                ["EI employer multiple", "1.4×"],
                ["Federal basic personal amount", "$16,452"],
                ["ON basic personal amount", "$12,989"],
                ["QC QPP rate", "6.30%"],
                ["QC QPIP employee rate", "0.43%"],
              ].map(([k, v], i) => (
                <div key={k} className={`flex justify-between px-3.5 py-[11px] text-[13px] border-b border-[#F0EFED] last:border-b-0 ${i % 2 ? "bg-[#FAFAF9]" : ""}`}>
                  <span className="text-[#57534E]">{k}</span>
                  <span className="font-mono tabular-nums font-medium">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#A8A29E] mt-3 leading-relaxed">
              Source: CRA T4127 (123rd ed., Jul 2026) + Revenu Québec TP-1015.3. Rates apply per pay date — past runs keep their original year's rates.
            </p>
          </div>
        </div>
      )}

      {/* ── Billing tab ── */}
      {activeTab === "billing" && (
        <div className="space-y-4 max-w-lg">
          <div className="bg-white border border-[#E7E5E4] rounded-[14px] p-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
            <div>
              <span className="text-base font-bold block mb-1">Current plan</span>
              <div className="flex items-center gap-3 mt-3">
                <span className="w-3 h-3 rounded-full" style={{ background: meta.dot }} />
                <span className="text-lg font-bold">{plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
                <span className="text-sm text-[#78716C]">{meta.price}/mo base + $2-3/employee</span>
              </div>
            </div>
            <div className="border-t border-[#F0EFED] pt-4 space-y-2">
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Billing is handled through Stripe. Upgrade or change your plan by selecting one below and completing checkout.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            {(["solo", "growth", "accountant"] as Plan[]).map((p) => {
              const m = PLAN_META[p];
              const isCurrent = p === plan;
              return (
                <div
                  key={p}
                  className={`bg-white border rounded-[14px] p-5 text-center space-y-3 ${
                    isCurrent ? "border-[#B3261E] ring-2 ring-[#B3261E]/20" : "border-[#E7E5E4]"
                  } shadow-[0_1px_3px_rgba(0,0,0,0.04)]`}
                >
                  <p className="text-sm font-bold capitalize">{p}</p>
                  <p className="text-2xl font-extrabold tracking-[-0.02em]">{m.price}<span className="text-xs font-medium text-[#A8A29E]">/mo</span></p>
                  {isCurrent ? (
                    <span className="inline-flex rounded-[9px] bg-[#F0EFED] text-[#A8A29E] text-xs font-semibold px-4 py-2">Current plan</span>
                  ) : (
                    <UpgradePlanButton planId={p} label={`Upgrade to ${p}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
