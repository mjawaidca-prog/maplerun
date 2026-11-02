/**
 * Company settings — Profile / Pay Groups / Payroll / Billing tabs.
 */
import { requireCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PLAN_META, type Plan } from "@/lib/plan";
import { BillingUpgradeCards } from "@/components/upgrade-plan-button";
import { PlanSwitcher } from "@/components/plan-switcher";
import { PayGroupsManager } from "@/components/pay-groups-manager";
import { LedgerProIntegrations } from "@/components/ledgerpro-integrations";
import { updatePayrollSettings } from "@/lib/actions/company";
import { normalizeMapping, type MappingMode } from "@/lib/ledgerpro-journal";
import { updateEftOriginatorProfile } from "@/lib/actions/eft";
import { decrypt } from "@/lib/encryption";
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
    { key: "paygroups", label: "Pay Groups" },
    { key: "payroll", label: "Payroll" },
    { key: "integrations", label: "Integrations" },
    { key: "billing", label: "Billing" },
  ];

  // Fetch pay groups for the paygroups tab
  const payGroups = await prisma.payGroup.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });

  // EFT originator profile (Payroll tab): the stored account number is
  // encrypted at rest and is NEVER rendered in full — only a mask of its
  // last 3 digits reaches the page.
  let eftAccountMasked: string | null = null;
  if (company.eftAccount) {
    try {
      const plain = decrypt(company.eftAccount).replace(/[\s-]/g, "");
      if (plain) eftAccountMasked = `•••${plain.slice(-3)}`;
    } catch {
      eftAccountMasked = null;
    }
  }

  // LedgerPro connection for the integrations tab — the encrypted key is
  // never sent to the client; only a hasKey flag.
  const ledgerConnection = await prisma.ledgerProConnection.findUnique({ where: { companyId } });
  const ledgerConnectionView = ledgerConnection
    ? {
        baseUrl: ledgerConnection.baseUrl,
        mappingMode: (ledgerConnection.mappingMode === "MODE2" ? "MODE2" : "MODE1") as MappingMode,
        mapping: normalizeMapping(ledgerConnection.mapping),
        syncEnabled: ledgerConnection.syncEnabled,
        hasKey: ledgerConnection.apiKeyEncrypted.length > 0,
      }
    : null;

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
                ["Business Number (BN)", company.businessNumber || "—"],
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

      {/* ── Pay Groups tab ── */}
      {activeTab === "paygroups" && (
        <PayGroupsManager companyId={companyId} payGroups={payGroups} />
      )}

      {/* ── Payroll tab ── */}
      {activeTab === "payroll" && (
        <div className="space-y-5">
        {/* Pay-stub email opt-in (Wave 3 B5) */}
        <form action={updatePayrollSettings} className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-[22px] py-[18px] border-b border-[#F0EFED]">
            <span className="text-base font-bold">Pay stub delivery</span>
          </div>
          <div className="p-[22px] space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="stubEmailOnFinalize"
                defaultChecked={company.stubEmailOnFinalize ?? false}
                className="mt-0.5 rounded"
              />
              <span>
                <span className="text-sm font-semibold block">Email pay stubs when a pay run is finalized</span>
                <span className="text-[13px] text-muted-foreground leading-relaxed block mt-0.5">
                  Each employee with an email address on file gets a notice pointing to the employee
                  portal sign-in. Off by default — email failures never block finalizing a run.
                </span>
              </span>
            </label>
            <button type="submit" className="rounded-[9px] border border-[#D6D3D1] bg-white px-4 py-2 text-[13px] font-semibold">
              Save
            </button>
          </div>
        </form>
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

        {/* EFT originator profile — bank-issued values for CPA-005 files.
            Nothing here is pre-filled or guessed: an incomplete profile
            blocks EFT downloads until every field is saved. */}
        <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-[22px] py-[18px] border-b border-[#F0EFED]">
            <span className="text-base font-bold">EFT originator profile</span>
            <p className="text-xs text-[#A8A29E] mt-1 leading-relaxed">
              Your bank assigns these values when it enables CPA-005 file upload for your business account.
              They appear in every direct-deposit file — enter them exactly as your bank issued them.
            </p>
          </div>
          <form action={updateEftOriginatorProfile} className="p-[22px]">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#78716C] block mb-1.5" htmlFor="eftOriginatorName">Originator short name</label>
                <input id="eftOriginatorName" name="eftOriginatorName" maxLength={15} required
                  defaultValue={company.eftOriginatorName ?? ""}
                  className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans" />
                <p className="text-[11px] text-[#A8A29E] mt-1">Max 15 characters — appears on employees&apos; bank statements.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#78716C] block mb-1.5" htmlFor="eftOriginatorId">Originator ID / client number</label>
                <input id="eftOriginatorId" name="eftOriginatorId" maxLength={10} required
                  defaultValue={company.eftOriginatorId ?? ""}
                  className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans" />
                <p className="text-[11px] text-[#A8A29E] mt-1">Bank-assigned, max 10 characters.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#78716C] block mb-1.5" htmlFor="eftDataCentre">Data centre</label>
                <input id="eftDataCentre" name="eftDataCentre" maxLength={5} inputMode="numeric" required
                  defaultValue={company.eftDataCentre ?? ""}
                  className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans" />
                <p className="text-[11px] text-[#A8A29E] mt-1">Bank-assigned, exactly 5 digits.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#78716C] block mb-1.5" htmlFor="eftInstitution">Institution number</label>
                <input id="eftInstitution" name="eftInstitution" maxLength={3} inputMode="numeric" required
                  defaultValue={company.eftInstitution ?? ""}
                  className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans" />
                <p className="text-[11px] text-[#A8A29E] mt-1">Your bank&apos;s 3-digit institution number (return account).</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#78716C] block mb-1.5" htmlFor="eftTransit">Transit number</label>
                <input id="eftTransit" name="eftTransit" maxLength={5} inputMode="numeric" required
                  defaultValue={company.eftTransit ?? ""}
                  className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans" />
                <p className="text-[11px] text-[#A8A29E] mt-1">Your branch&apos;s 5-digit transit number (return account).</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#78716C] block mb-1.5" htmlFor="eftAccount">Account number</label>
                <input id="eftAccount" name="eftAccount" maxLength={12} inputMode="numeric"
                  placeholder={eftAccountMasked ? `Current: ${eftAccountMasked} — leave blank to keep` : "Business account the deposits are drawn from"}
                  className="w-full border border-[#D6D3D1] rounded-lg px-3 py-2.5 text-sm bg-white font-sans" />
                <p className="text-[11px] text-[#A8A29E] mt-1">
                  {eftAccountMasked
                    ? `Stored encrypted, shown masked (${eftAccountMasked}). Leave blank to keep the current account.`
                    : "Stored encrypted. It is never shown in full after saving."}
                </p>
              </div>
            </div>
            <div className="mt-5">
              <button type="submit" className="rounded-[9px] bg-[#B3261E] hover:bg-[#8F1D17] text-white text-[13px] font-semibold px-5 py-2.5 transition-colors">
                Save EFT profile
              </button>
            </div>
          </form>
        </div>
        </div>
      )}

      {/* ── Integrations tab ── */}
      {activeTab === "integrations" && (
        <LedgerProIntegrations companyId={companyId} connection={ledgerConnectionView} />
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
                Billing is handled through Stripe. Choose monthly or annual billing, then select a plan to complete checkout.
              </p>
            </div>
          </div>

          <BillingUpgradeCards currentPlan={plan} />
        </div>
      )}
    </div>
  );
}
