export const PAY_URL = "https://pay.nexvarlab.com";
export const LEDGERPRO_URL = "https://ledger.nexvarlab.com";
export const NEXVAR_URL = "https://www.nexvarlab.online";

export type PayrollSeoFeature = {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  intro: string;
  benefits: Array<{ title: string; body: string }>;
  workflow: string[];
  faq: Array<{ question: string; answer: string }>;
};

export const PAYROLL_FEATURES: Record<string, PayrollSeoFeature> = {
  "canadian-payroll": {
    slug: "canadian-payroll",
    title: "Canadian payroll software for small businesses",
    metaTitle: "Canadian Payroll Software for Small Business | Nexvar Pay",
    description:
      "Calculate CPP, CPP2, EI, federal tax, and provincial tax with CRA-aligned payroll software built for Canadian small businesses.",
    eyebrow: "Payroll built for Canada",
    intro:
      "Nexvar Pay guides Canadian employers from gross pay to net pay with current-year deduction tables, clear previews, and records that remain tied to the tax year used for each pay run.",
    benefits: [
      {
        title: "CRA-aligned payroll calculations",
        body: "Calculate CPP, CPP2, EI, federal income tax, and provincial or territorial tax using the payroll tables configured for the year.",
      },
      {
        title: "All provinces and territories",
        body: "Set the employee's province of employment and pay frequency so the calculation follows the appropriate Canadian payroll inputs.",
      },
      {
        title: "Preview before finalizing",
        body: "Review employee deductions, employer contributions, net pay, and total remittance before you confirm a payroll run.",
      },
      {
        title: "Year-specific records",
        body: "Historical payroll runs retain the rates used at the time, helping accountants understand how a prior-period result was calculated.",
      },
    ],
    workflow: [
      "Add the company, pay schedule, and employee payroll details.",
      "Enter earnings, hours, benefits, and other applicable inputs.",
      "Review deductions, employer cost, net pay, and remittance.",
      "Finalize the run and produce the payroll records your team needs.",
    ],
    faq: [
      {
        question: "Which Canadian payroll deductions does Nexvar Pay calculate?",
        answer:
          "Nexvar Pay calculates CPP or CPP2 where applicable, EI, federal income tax, and provincial or territorial tax based on the payroll inputs and tables configured for the year.",
      },
      {
        question: "Are Nexvar Pay outputs official CRA documents?",
        answer:
          "No. Nexvar Pay is a payroll calculation and record-keeping tool. Employers should verify remittances and filings against their CRA account and current requirements.",
      },
    ],
  },
  "pay-stubs-t4": {
    slug: "pay-stubs-t4",
    title: "Pay stubs and year-end payroll records employees can understand",
    metaTitle: "Pay Stub & T4 Payroll Software Canada | Nexvar Pay",
    description:
      "Create downloadable pay stubs, payroll summaries, and T4 working records from the same Canadian payroll data in Nexvar Pay.",
    eyebrow: "Payroll documents",
    intro:
      "Nexvar Pay turns finalized payroll data into clear employee and accountant records. Each document stays connected to the underlying pay run, deductions, employer contributions, and year-end totals.",
    benefits: [
      {
        title: "Clear employee pay stubs",
        body: "Provide earnings, deductions, net pay, and year-to-date totals in a downloadable format employees can review.",
      },
      {
        title: "T4 year-end workflow",
        body: "Prepare employee T4 working records from finalized payroll history and review year-end amounts before filing.",
      },
      {
        title: "Payroll summaries",
        body: "Give owners and accountants a consolidated view of gross pay, deductions, employer cost, and remittance totals.",
      },
      {
        title: "Secure delivery options",
        body: "Download, print, or email supported payroll documents while keeping the source payroll record available for audit and review.",
      },
    ],
    workflow: [
      "Finalize payroll after reviewing the calculation.",
      "Open the employee or company payroll record.",
      "Generate the required pay stub, summary, or year-end working record.",
      "Download or deliver the document through the supported workflow.",
    ],
    faq: [
      {
        question: "Can employees download their pay stubs?",
        answer: "Nexvar Pay produces downloadable pay-stub records that can be printed or delivered to the employee.",
      },
      {
        question: "Does Nexvar Pay submit T4 slips to the CRA?",
        answer:
          "Nexvar Pay supports T4 preparation and year-end review. Employers remain responsible for verifying and completing their filing through the applicable CRA process.",
      },
    ],
  },
  "direct-deposit": {
    slug: "direct-deposit",
    title: "Prepare Canadian EFT and direct-deposit payroll files",
    metaTitle: "Payroll EFT & Direct Deposit File Software Canada | Nexvar Pay",
    description:
      "Prepare Canadian bank EFT and payroll direct-deposit files from finalized pay runs, with totals available for review before upload.",
    eyebrow: "Payroll payment preparation",
    intro:
      "Nexvar Pay converts finalized net-pay amounts into an EFT or direct-deposit file workflow for supported Canadian banking arrangements. Review employee banking details and payroll totals before providing the file to your bank.",
    benefits: [
      {
        title: "Built from finalized net pay",
        body: "Generate payment instructions from the same approved pay run used for pay stubs and payroll reporting.",
      },
      {
        title: "Canadian banking fields",
        body: "Store the institution, transit, and account information needed for supported Canadian EFT file preparation.",
      },
      {
        title: "Control totals before upload",
        body: "Compare the payment count and total with the finalized payroll before the file leaves Nexvar Pay.",
      },
      {
        title: "Bank upload remains under your control",
        body: "Nexvar Pay prepares the file; your authorized user reviews and uploads it through the financial institution's process.",
      },
    ],
    workflow: [
      "Maintain employee banking details with appropriate access controls.",
      "Finalize the payroll run and confirm net-pay totals.",
      "Generate and review the supported EFT or direct-deposit file.",
      "Upload the approved file through your bank's authorized channel.",
    ],
    faq: [
      {
        question: "Does Nexvar Pay move money from my bank account?",
        answer:
          "Nexvar Pay prepares supported EFT or direct-deposit files. The authorized user completes the upload and approval through their financial institution.",
      },
      {
        question: "Will every Canadian bank accept the same file?",
        answer:
          "Bank requirements can vary. Confirm the required format and approval process with your financial institution before using a payroll payment file.",
      },
    ],
  },
  "payroll-for-accountants": {
    slug: "payroll-for-accountants",
    title: "Multi-company payroll software for accountants and bookkeepers",
    metaTitle: "Payroll Software for Accountants & Bookkeepers Canada | Nexvar Pay",
    description:
      "Manage Canadian payroll for multiple companies with payroll summaries, remittance records, GL journals, year-end workflows, and audit history.",
    eyebrow: "Accountant payroll workspace",
    intro:
      "Nexvar Pay gives accountants and bookkeepers a multi-company workspace for recurring payroll work, review, reporting, and year-end preparation without mixing one client's data with another's.",
    benefits: [
      {
        title: "Multi-company workspace",
        body: "Move between client companies from one account while keeping employees, payroll runs, reports, and settings separated.",
      },
      {
        title: "Review-ready payroll summaries",
        body: "See gross pay, deductions, employer contributions, remittance totals, and payroll history for each company and period.",
      },
      {
        title: "GL journal support",
        body: "Prepare payroll journal information for posting to the client's accounting records and month-end review.",
      },
      {
        title: "Year-end and audit history",
        body: "Use T4 preparation workflows and activity history to support review, corrections, and client questions.",
      },
    ],
    workflow: [
      "Create or select the client company.",
      "Review employee, pay-group, and company payroll settings.",
      "Process and approve payroll with company-specific records.",
      "Export reports, remittance support, and general-ledger information.",
    ],
    faq: [
      {
        question: "Can an accountant manage more than one payroll company?",
        answer:
          "Yes. The Accountant plan includes a multi-company workspace designed for firms that process payroll for several clients.",
      },
      {
        question: "Can payroll information be posted to accounting software?",
        answer:
          "Nexvar Pay provides GL journal information that can support posting payroll totals to the company's accounting records.",
      },
    ],
  },
};

export const PAYROLL_FEATURE_SLUGS = Object.keys(PAYROLL_FEATURES);
