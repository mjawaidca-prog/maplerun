/**
 * Help & FAQ — getting started, how payroll works, CRA compliance, billing.
 */
export default function HelpPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Help & FAQ</h1>
        <p className="text-sm text-muted-foreground mt-1">Everything you need to run payroll with Nexvar Pay.</p>
      </div>

      {/* Getting Started */}
      <Section title="Getting started">
        <Q q="How do I run my first payroll?" a="Go to Payroll → Run Payroll. Select a pay group, enter the period end date, and enter gross pay for each employee. Click Calculate to preview deductions, then Finalize to create the pay run." />
        <Q q="How do I add employees?" a="Go to Employees → Add Employee. Fill in their name, SIN, province, and assign a pay group. A TD1 profile and YTD ledger are created automatically." />
        <Q q="What's a pay group?" a="A pay group defines how often employees are paid (weekly, biweekly, semi-monthly, monthly) and their default province for tax calculations." />
      </Section>

      {/* Payroll calculations */}
      <Section title="Payroll calculations">
        <Q q="Are the tax calculations accurate?" a="Yes. Nexvar Pay uses CRA T4127 formulas (2026 editions). CPP, CPP2, EI, and income tax are calculated exactly per CRA guidelines. All provinces and territories are supported including Quebec (QPP/QPIP)." />
        <Q q="What rates does Nexvar Pay use?" a="CPP: 5.95% (employee) on pensionable earnings up to $74,600. CPP2: 4.00% on $74,600–$85,000. EI: 1.63% (employee) on insurable earnings up to $68,900 (QC: 1.30%). Federal/provincial income tax per T4127 brackets." />
        <Q q="How is vacation pay handled?" a="Check 'Vacation pay' on any employee in the wizard and enter a percentage (typically 4% or 6%). The amount is calculated automatically and shown on the pay stub." />
        <Q q="How are insurable hours tracked?" a="Enter hours per employee in the pay run wizard (defaults to 75 for biweekly). Hours are stored per pay period and used for ROE Block 15A." />
      </Section>

      {/* CRA compliance */}
      <Section title="CRA compliance">
        <Q q="Does Nexvar Pay file taxes with CRA?" a="No. Nexvar Pay calculates the amounts and generates reports (T4, PD7A, ROE) for you to file with CRA. You remit payments through your CRA business account or online banking." />
        <Q q="When are remittances due?" a="For regular remitters (monthly), PD7A remittances are due by the 15th of the following month. Use the Remittance Report to see amounts and due dates." />
        <Q q="How do T4s work?" a="Go to Reports → T4 Slips. Each employee's T4 is generated from finalized pay runs. Boxes 14, 16, 16A, 18, 22, 24, and 26 are all populated. Distribute to employees and file with CRA by February 28." />
        <Q q="What about Quebec?" a="Nexvar Pay supports QPP (6.30%), QPIP (0.43%), reduced EI (1.30%), Quebec provincial tax, and the 16.5% federal abatement. Select QC as the province for any employee." />
      </Section>

      {/* Plans & billing */}
      <Section title="Plans & billing">
        <Q q="What plans are available?" a="Solo ($7/mo + $2/employee): Basic payroll. Growth ($19/mo + $2/employee): Timesheets, remittances, ROE, more reports. Accountant ($49/mo + $1.50/employee): Full suite with GL, year-end centre, audit log, multi-company." />
        <Q q="Is there a free trial?" a="Yes. Each plan includes 2 free pay runs. No credit card required to start." />
        <Q q="How do I upgrade?" a="Go to Company → Billing tab → select a plan → complete checkout through Stripe. Your plan updates immediately." />
      </Section>

      {/* Technical */}
      <Section title="Data & security">
        <Q q="How is SIN protected?" a="SINs are encrypted at rest using AES-256-GCM. They are never logged, never exposed in API responses without explicit permission, and only accessible to authorized users in your company." />
        <Q q="Where is my data stored?" a="Nexvar Pay uses Neon PostgreSQL (US East region). All connections use SSL encryption. SINs and bank details are AES-256-GCM encrypted at rest. We recommend Canadian businesses review their PIPEDA compliance requirements." />
        <Q q="Can I export my data?" a="Yes. Payroll reports support PDF and CSV export. GL Journal entries are ready for QuickBooks and Xero import." />
      </Section>

      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-[14px] p-6 text-center">
        <p className="text-base font-bold text-[#1E40AF]">Still have questions?</p>
        <p className="text-[13px] text-[#1E40AF]/70 mt-1">Contact us at support@nexvarlab.com</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold mb-3">{title}</h2>
      <div className="bg-white border border-[#E7E5E4] rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {children}
      </div>
    </div>
  );
}

function Q({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-[#F0EFED] last:border-b-0">
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#FAFAF9] text-sm font-semibold">
        {q}
        <span className="text-[#A8A29E] text-xs group-open:rotate-90 transition-transform">▶</span>
      </summary>
      <div className="px-5 pb-4 text-[13px] text-[#57534E] leading-relaxed">{a}</div>
    </details>
  );
}
