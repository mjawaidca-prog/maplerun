import type { PayrollGuide } from "./guides";

/**
 * Guide copy for the public /guides pages.
 *
 * Accuracy rule: every rate, ceiling, and date below is a published
 * 2026 figure from CRA (T4127 121st ed. / canada.ca payroll pages) or
 * Revenu Québec / Retraite Québec, cross-checked against the tax
 * engine's verified 2026 tables in packages/tax-engine/src/data/2026/.
 * 2027 CPP/CPP2 amounts were not yet published when these guides were
 * written, so no 2027 CPP/CPP2 figures appear anywhere in this file;
 * the 2027 EI amounts (published September 2026) are noted as such.
 */
export const GUIDE_CONTENT: PayrollGuide[] = [
  {
    slug: "province-of-employment-rules",
    title: "Province of employment: the rule that decides your payroll taxes",
    metaTitle: "Province of Employment Rules in Canada | Nexvar Pay Guide",
    description:
      "Learn how CRA determines an employee's province of employment — the establishment they report to, the remote-worker rule, and what changes when someone moves — with examples for every common situation.",
    intro:
      "Before a single deduction is calculated, one fact decides which tax tables apply to an employee: their province of employment. It is not always the province they live in, and getting it wrong quietly mis-withholds tax on every paycheque until someone notices at tax time.",
    category: "Payroll rules",
    priority: 0.95,
    related: ["td1-forms-claim-codes", "quebec-payroll-qpp-qpip-rl-1", "cpp-cpp2-ei-deductions-2026"],
    sections: [
      {
        heading: "What the province of employment decides",
        paragraphs: [
          "The province of employment (POE) is the province or territory CRA treats an employee as employed in for source-deduction purposes. It selects the provincial income tax table used on every paycheque, determines whether the employee contributes to the Canada Pension Plan or the Quebec Pension Plan, drives which TD1 forms the employee should complete, and follows the wages onto the year-end T4.",
          "Because provincial tax rates, basic personal amounts, and surtaxes differ across the country, the same salary can produce noticeably different net pay under two different provinces of employment. Provincial employer levies — such as Ontario's Employer Health Tax or BC's Employer Health Tax — also key off where employees are employed, so the POE reaches beyond the employee's own deductions.",
          "The most common mistake is assuming the POE is simply where the employee lives, or where they happen to be working this month. CRA's test is about your business establishments, not the employee's address or travel schedule.",
        ],
      },
      {
        heading: "CRA's rule, step by step",
        paragraphs: [
          "CRA defines an establishment of the employer as any place or premises in Canada that the employer owns, leases, or rents — an office, a plant, a warehouse, a branch. The determination then runs in a fixed order:",
        ],
        steps: [
          "If the employee reports to one of your establishments — they work there in person, or they are attached to it even while working remotely — the province of employment is the province of that establishment.",
          "If the employee does not report to any establishment (a fully remote worker is the classic case), the province of employment is the province of the establishment from which their salary is paid.",
          "If the employee works in several provinces, use the establishment they report to most, or treat as their primary or home establishment.",
          "If the employee works in a province where you have no establishment at all, the answer is still the province of the establishment their pay comes from — not the province where the work is done.",
        ],
        notes: [
          "A home office is the employee's premises, not yours. Renting a desk for yourself does not create an establishment; a premises the business rents for its operations does.",
          "Certified non-resident employers paying non-resident employees follow a separate regime and are outside this guide.",
        ],
      },
      {
        heading: "Common situations, resolved",
        table: {
          headers: ["Situation", "Province of employment", "Why"],
          rows: [
            [
              "Employee works at your Calgary head office",
              "Alberta",
              "They report to an Alberta establishment.",
            ],
            [
              "Employee works from home in Nova Scotia; your only office is in Ontario and payroll runs from there",
              "Ontario",
              "They report to no establishment, so the province of employment follows the establishment that pays them.",
            ],
            [
              "Technician based at your Winnipeg branch, sent to job sites in Saskatchewan for weeks at a time",
              "Manitoba",
              "Temporary work elsewhere does not move the establishment they report to.",
            ],
            [
              "Sales rep splits the year between your BC and Alberta offices, mostly attached to BC",
              "British Columbia",
              "Use the establishment they report to most or treat as primary.",
            ],
            [
              "Remote employee in New Brunswick; the company has no premises anywhere and pays from its Ontario operation",
              "Ontario",
              "With no establishment to report to, the paying establishment governs.",
            ],
          ],
          caption:
            "Notice the pattern: in every row the answer comes from the employer's establishments, never from the employee's home address alone.",
        },
      },
      {
        heading: "When the province of employment changes",
        paragraphs: [
          "An employee's POE changes when the underlying facts change: they transfer to an establishment in another province, or the establishment that pays them changes. When that happens, switch the provincial tax table from the first pay run under the new arrangement, have the employee complete the new province's TD1, and keep the old province's records for the part of the year already paid.",
          "Year-end reporting follows the wages: income is reported under the province of employment that applied when it was paid. An employee who moved mid-year can legitimately have T4 income tied to more than one province's rules across their employment history — and if they changed employers, more than one T4.",
          "What does not change the POE: a temporary assignment, a business trip, or the employee moving house while continuing to report to the same establishment. A remote employee who relocates from Ontario to BC but is still paid from your Ontario establishment keeps an Ontario POE — which often surprises both sides.",
        ],
      },
      {
        heading: "Quebec's special position",
        paragraphs: [
          "The POE also decides the pension plan. An employee whose province of employment is Quebec contributes to the Quebec Pension Plan (QPP) and the Quebec Parental Insurance Plan (QPIP), pays Quebec provincial tax to Revenu Québec, and receives an RL-1 slip at year-end. Everyone else is in CPP and federal-provincial withholding through CRA.",
          "Residence still matters at tax-filing time. A person who lives in Quebec on December 31 files a Quebec return and reconciles what was withheld under their POE during the year — which is why a Quebec resident with an Ontario POE can face a balance owing (or a refund) that has nothing to do with an error by the employer. Withholding follows the POE; the final settlement follows residence.",
        ],
        notes: [
          "An Ontario POE with a Quebec home address is not a mistake to 'fix' mid-year. Changing the POE without a change in establishment would itself be the error.",
        ],
      },
      {
        heading: "Province of employment in Nexvar Pay",
        paragraphs: [
          "In Nexvar Pay, each employee record carries its own province of employment, set once and applied to every pay run: the provincial tax table, CPP versus QPP, the reduced Quebec EI rate where it applies, and the year-end slip mapping all follow from it. Change the province on the employee record when the establishment facts change, and the new rules take over from the next run — the earlier runs keep the tables that applied at the time.",
        ],
      },
    ],
    faq: [
      {
        question: "My employee works remotely from another province. Is their province of employment where they live?",
        answer:
          "Usually not. If they report to no establishment of yours, CRA puts the province of employment in the province of the establishment from which their salary is paid — often your head-office province, not their home province.",
      },
      {
        question: "What if an employee splits their time between two of our offices in different provinces?",
        answer:
          "Use the establishment they report to most, or the one treated as their primary or home establishment. The POE is a single province at any given time; it is never prorated across provinces.",
      },
      {
        question: "Does the province of employment affect the employee's tax return?",
        answer:
          "Yes. Withholding during the year follows the province of employment, but the employee's final tax is settled based on their province of residence on December 31. A mismatch between the two is reconciled on the return and can produce a refund or a balance owing.",
      },
    ],
  },
  {
    slug: "quebec-payroll-qpp-qpip-rl-1",
    title: "Quebec payroll: QPP, QPIP, RL-1, and Revenu Québec",
    metaTitle: "Quebec Payroll Guide: QPP, QPIP & RL-1 (2026) | Nexvar Pay",
    description:
      "Quebec runs its own payroll system alongside the federal one. Learn the 2026 QPP and QPIP rates, the reduced EI premium, the 16.5% federal abatement, and what RL-1 slips and Revenu Québec remittances require.",
    intro:
      "Quebec is the one province where a second payroll system runs in parallel with the federal one. If even one employee's province of employment is Quebec, your business remits to two governments, applies two pension and insurance plans, and files an extra set of year-end slips.",
    category: "Quebec payroll",
    priority: 0.9,
    related: ["province-of-employment-rules", "cpp-cpp2-ei-deductions-2026", "payroll-remittance-due-dates"],
    sections: [
      {
        heading: "Two systems on one paycheque",
        paragraphs: [
          "For a Quebec employee, a single paycheque carries deductions for both governments. CRA still receives the federal income tax and the Employment Insurance premiums. Revenu Québec receives Quebec provincial income tax, Quebec Pension Plan (QPP) contributions, and Quebec Parental Insurance Plan (QPIP) premiums — plus employer contributions that exist only in Quebec, such as the health services fund contribution.",
          "That means two remittances on two schedules, two sets of source-deduction tables, and at year-end both a T4 (for the federal side) and an RL-1 slip (for Quebec). Employers new to Quebec payroll most often stumble by treating it as 'CPP with different rates' — the structure itself is different.",
        ],
      },
      {
        heading: "QPP instead of CPP",
        paragraphs: [
          "The Quebec Pension Plan mirrors the CPP's architecture — same maximum pensionable earnings, same basic exemption, and the same second-tier design since 2024 — but at a higher contribution rate, because QPP benefits and demographics are Quebec's own. For 2026:",
        ],
        table: {
          headers: ["2026", "CPP (rest of Canada)", "QPP (Quebec)"],
          rows: [
            ["Maximum pensionable earnings", "$74,600", "$74,600"],
            ["Basic exemption", "$3,500", "$3,500"],
            ["Employee/employer rate", "5.95%", "6.30%"],
            ["Maximum employee contribution", "$4,230.45", "$4,479.30"],
            ["Second tier (additional plan)", "4.00% on $74,600–$85,000", "4.00% on $74,600–$85,000"],
            ["Maximum second-tier contribution", "$416.00", "$416.00"],
          ],
          caption:
            "The employer matches the employee's QPP contribution dollar for dollar, exactly as with CPP. Self-employed Quebecers pay both halves.",
        },
      },
      {
        heading: "QPIP and the reduced EI rate",
        paragraphs: [
          "The Quebec Parental Insurance Plan funds Quebec's parental, maternity, and paternity benefits. Because QPIP exists, Quebec employees pay a lower federal EI premium — the federal rate is reduced to recognize that Quebec runs its own plan. For 2026, QPIP applies to insurable earnings up to $103,000, at 0.430% for employees (maximum premium $442.90) and 0.602% for employers (maximum $620.06).",
          "On the same paycheque, the EI premium is calculated at the Quebec rate of 1.30% instead of 1.63%, with a maximum employee premium of $895.70 instead of $1,123.07. The employer's EI share stays at 1.4 times the employee premium in both cases. A Quebec payroll that charges full-rate EI, or forgets QPIP, is wrong in both directions at once.",
        ],
      },
      {
        heading: "The 16.5% federal abatement and Quebec's own forms",
        paragraphs: [
          "Quebec employees receive a federal tax abatement of 16.5%: after federal tax is calculated, 16.5% of it is deducted, reflecting tax room Quebec opted out of federal programs to run its own. The abatement is built into the federal withholding calculation for Quebec employees — it is not something the employee claims separately at payday.",
          "Quebec also has its own version of the TD1. Instead of a provincial TD1, Quebec employees complete form TP-1015.3-V (Source Deductions Return) to declare their Quebec credits and deduction amounts, while the federal TD1 still governs the federal side. Quebec's source-deduction tables are published by Revenu Québec (the TP-1015.F guide and the WebRAS formulas), not in CRA's T4127.",
        ],
      },
      {
        heading: "Remitting to Revenu Québec and the RL-1",
        paragraphs: [
          "Quebec source deductions and employer contributions are remitted to Revenu Québec separately from the CRA remittance, on a frequency Revenu Québec assigns from your previous year's total: annual or quarterly for the smallest employers, monthly through the middle range, and twice-monthly or weekly at the top — in general, the same frequency CRA assigns you. The federal portion (federal tax and EI) still goes to CRA on your usual federal schedule, so a Quebec employer runs two remittance calendars at once.",
          "At year-end, Quebec employees receive an RL-1 slip reporting their Quebec income, QPP contributions, QPIP premiums, and Quebec tax withheld, and the employer files the RL-1 slips together with the RL-1 summary to Revenu Québec. The deadline mirrors the federal one: the last day of February following the year — February 28, 2027 for 2026 income, which falls on a Sunday, so the deadline moves to the next business day. The same employees also receive a T4 for the federal side, with their QPP and QPIP amounts shown in the T4's dedicated boxes.",
        ],
        notes: [
          "File RL-1 data with Revenu Québec and T4 data with CRA — the two filings go to different governments and neither substitutes for the other.",
          "Quebec employers also have obligations with no federal equivalent, including the health services fund and CNESST premiums. Confirm your rates with Revenu Québec and the CNESST before your first Quebec pay run.",
        ],
      },
      {
        heading: "Quebec payroll in Nexvar Pay",
        paragraphs: [
          "Set an employee's province of employment to Quebec in Nexvar Pay and the Quebec rules take over that record: QPP at 6.30% with the second-tier contribution, QPIP premiums, the reduced 1.30% EI rate, the 16.5% federal abatement, and Quebec's provincial tax tables. The Year-End Centre prepares both T4 and RL-1 working records from the same finalized pay history, and when the company is connected to LedgerPro, a Quebec pay run posts with QPP carried on the CPP lines and QPIP folded into the EI lines of the journal — the totals your books need, without a separate Quebec journal format.",
        ],
      },
    ],
    faq: [
      {
        question: "Do I still remit anything to CRA for Quebec employees?",
        answer:
          "Yes. Federal income tax and EI premiums for Quebec employees still go to CRA. Revenu Québec receives the Quebec income tax, QPP, QPIP, and Quebec-only employer contributions. Two remittances, two schedules.",
      },
      {
        question: "What is the difference between a T4 and an RL-1?",
        answer:
          "The T4 is the federal year-end slip filed with CRA; the RL-1 is Quebec's slip filed with Revenu Québec, reporting Quebec tax withheld, QPP contributions, and QPIP premiums. Quebec employees receive both.",
      },
      {
        question: "Why is EI cheaper for Quebec employees?",
        answer:
          "Because Quebec runs its own parental insurance plan (QPIP). The federal EI rate is reduced for Quebec employees — 1.30% instead of 1.63% for 2026 — and QPIP premiums apply on top, up to a separate maximum.",
      },
    ],
  },
  {
    slug: "td1-forms-claim-codes",
    title: "TD1 forms and claim codes: how personal credits change withholding",
    metaTitle: "TD1 Forms & Claim Codes Explained (2026) | Nexvar Pay Guide",
    description:
      "Understand federal and provincial TD1 forms, the 2026 federal claim code chart, when claim code 0 applies, and how an employee's total claim amount changes the tax withheld from every paycheque.",
    intro:
      "Every employee's paycheque starts with a TD1. The form looks like a formality; in fact, the total claim amount on it — and the claim code it maps to — directly sets how much income tax is withheld from every single pay run.",
    category: "Payroll rules",
    priority: 0.85,
    related: ["province-of-employment-rules", "cpp-cpp2-ei-deductions-2026", "payroll-remittance-due-dates"],
    sections: [
      {
        heading: "What the TD1 actually does",
        paragraphs: [
          "The TD1, Personal Tax Credits Return, is where an employee declares the credits they are entitled to: the basic personal amount, plus amounts such as the spouse or common-law partner amount, eligible dependant amount, disability amount, tuition transferred from a child, and others. The employee adds them into one number — the total claim amount — and signs the form. There are two TD1s: a federal TD1 and a provincial or territorial TD1 for the employee's province of employment, each with its own basic amount and credit list.",
          "The employer does not verify the credits and does not send the TD1 anywhere. The form stays on file, and its total claim amount feeds the payroll calculation: in CRA's formulas, the employee's claim reduces the tax withheld by applying the lowest tax rate to the claimed amount (with the federal basic personal amount itself income-tested at higher earnings). An employee who claims only the basic personal amount is the default case; every additional credit lowers withholding a little on each cheque.",
        ],
        steps: [
          "Give new employees the current year's federal and provincial TD1 forms before their first pay (or have them complete the fillable versions from canada.ca).",
          "Record the total claim amount from each form on the employee's payroll record — the claim code follows from the chart below.",
          "Keep the signed forms on file. You do not file them with CRA.",
          "Ask for a new TD1 when an employee tells you their credits changed, and apply it to pay runs after you receive it.",
        ],
      },
      {
        heading: "The 2026 federal claim code chart",
        paragraphs: [
          "Payroll tables and software translate the total claim amount into a claim code. For 2026, the federal basic personal amount is $16,452, so claim code 1 covers total claims up to that amount, and each higher code adds a band of $2,833. Claim code 0 means no credits at all are being claimed.",
        ],
        table: {
          headers: ["Claim code", "2026 federal total claim amount"],
          rows: [
            ["0", "No claim amount"],
            ["1", "$0.00 to $16,452.00"],
            ["2", "$16,452.01 to $19,285.00"],
            ["3", "$19,285.01 to $22,118.00"],
            ["4", "$22,118.01 to $24,951.00"],
            ["5", "$24,951.01 to $27,784.00"],
            ["6", "$27,784.01 to $30,617.00"],
            ["7", "$30,617.01 to $33,450.00"],
            ["8", "$33,450.01 to $36,283.00"],
            ["9", "$36,283.01 to $39,116.00"],
            ["10", "$39,116.01 to $41,949.00"],
          ],
          caption:
            "Chart 3 of CRA's T4032 for 2026 (federal claim codes, using the maximum basic personal amount), read from canada.ca. Each province publishes its own chart with its own basic amount — the code an employee has federally is not automatically their provincial code. The chart tops out at claim code 10: for total claims above $41,949.00, formula-based payroll (T4127, and Nexvar Pay) applies the employee's exact total claim amount.",
        },
      },
      {
        heading: "The situations that trip people up",
        paragraphs: [
          "Second job, code 0. An employee who works for two employers can only claim their credits once. On the TD1 for the additional job they check the box for having more than one employer and enter 0 as the total claim amount — claim code 0 — so the second employer withholds tax from the first dollar. Skipping this is the single most common cause of a surprise tax bill for employees with two jobs.",
          "Credits bigger than income. If an employee's total claim amount exceeds what they will earn, they can ask CRA for a reduction of tax deducted at source (form T1213) rather than over-withholding all year and waiting for a refund. Large tuition or support-payment deductions are the usual cases.",
          "Life changes mid-year. Marriage, a new dependant, or a spouse's income changing can all change the right claim amount. A new TD1 takes effect for pay runs after the employer receives it — it does not retroactively fix earlier cheques, and the difference settles on the employee's tax return.",
          "Commission employees are the exception to the standard form: they may use form TD1X to claim commission expenses against withholding instead.",
        ],
        notes: [
          "Quebec employees do not complete a provincial TD1 — they complete Revenu Québec's form TP-1015.3-V for the Quebec side, alongside the federal TD1.",
          "If an employee never returns a TD1, do not leave the field blank and guess: CRA's default treats them as claiming only the basic personal amount. Record that and still ask for the form.",
        ],
      },
      {
        heading: "TD1s in Nexvar Pay",
        paragraphs: [
          "Each employee record in Nexvar Pay stores the federal and provincial claim amounts from their TD1s, and every pay run applies them — including the income-tested federal basic personal amount at higher salaries and the Quebec TP-1015.3-V amounts for Quebec employees. When an employee hands you an updated TD1, update the amounts once and the next run uses them; earlier runs keep the claims that were in effect when they were paid, which is what you want if CRA ever asks how a cheque was calculated.",
        ],
      },
    ],
    faq: [
      {
        question: "Do I send completed TD1 forms to CRA?",
        answer:
          "No. TD1s stay in your payroll files. They are the employee's declaration to you, and you use the total claim amounts to calculate withholding. CRA can ask to see them on review, which is why they must be kept.",
      },
      {
        question: "An employee has two jobs. What claim code should we use?",
        answer:
          "Credits can only be claimed once. On the TD1 for the second employer, the employee enters a total claim amount of 0 — claim code 0 — so tax is withheld from the first dollar of that job's pay.",
      },
      {
        question: "How often should TD1s be updated?",
        answer:
          "Whenever an employee's credits change — a new dependant, a change in marital status, new tuition or disability amounts. Many employers also refresh TD1s each January, since basic personal amounts are indexed annually.",
      },
    ],
  },
  {
    slug: "cpp-cpp2-ei-deductions-2026",
    title: "CPP, CPP2, and EI in 2026: how the three deductions actually work",
    metaTitle: "CPP, CPP2 & EI Deductions 2026: Rates & Maximums | Nexvar Pay",
    description:
      "The 2026 CPP, CPP2, and EI rates, ceilings, and maximums explained — the $3,500 exemption, the two pension tiers, the employer's 1.4× EI share, and worked examples at $60,000 and $90,000 salaries.",
    intro:
      "Three deductions come off almost every Canadian paycheque before income tax is even considered. They look simple — a percentage each — but each has its own ceiling, its own exemption or second tier, and its own stopping point, which is why hand-checking a pay stub takes more than a calculator app.",
    category: "Deductions 2026",
    priority: 0.9,
    related: ["quebec-payroll-qpp-qpip-rl-1", "payroll-remittance-due-dates", "td1-forms-claim-codes"],
    sections: [
      {
        heading: "The three deductions at a glance",
        table: {
          headers: ["2026", "CPP", "CPP2", "EI"],
          rows: [
            ["Applies to earnings", "Pensionable earnings above the exemption", "$74,600 to $85,000 of pensionable earnings", "Insurable earnings"],
            ["Key ceiling", "$74,600 (YMPE)", "$85,000 (YAMPE)", "$68,900 (MIE)"],
            ["Employee rate", "5.95%", "4.00%", "1.63% (1.30% in Quebec)"],
            ["Maximum employee amount", "$4,230.45", "$416.00", "$1,123.07 ($895.70 in Quebec)"],
            ["Employer share", "Matches the employee, dollar for dollar", "Matches the employee", "1.4 × the employee premium"],
          ],
          caption:
            "Published 2026 amounts (CRA T4127, 121st edition). The 2027 EI amounts are already published (see the last question below); the 2027 CPP and CPP2 amounts had not been published when this guide was written — the same structure will apply to new numbers.",
        },
      },
      {
        heading: "CPP: the exemption, the rate, and the split",
        paragraphs: [
          "The Canada Pension Plan contribution is 5.95% of pensionable earnings above a $3,500 basic exemption, up to the year's maximum pensionable earnings (YMPE) of $74,600 for 2026. The exemption is spread across the year: a monthly-paid employee gets $3,500 ÷ 12 = $291.67 of exemption per pay period, not $3,500 up front. The maximum employee contribution for 2026 is ($74,600 − $3,500) × 5.95% = $4,230.45, and the employer matches it exactly.",
          "The 5.95% is really two contributions wearing one coat: a base rate of 4.95% (in place since 2003) and a 1.00% enhancement rate added by the CPP enhancement that began in 2019. The split matters at tax time — the base portion earns a non-refundable tax credit, while the enhancement portion is a deduction from income. Good payroll software tracks the two portions separately all year so the T4 reports them correctly.",
          "A worked example: an Ontario employee earning $60,000, paid monthly ($5,000 per period). Monthly CPP = ($5,000 − $291.67) × 5.95% = $280.15. Over the year that is ($60,000 − $3,500) × 5.95% = $3,361.75 — under the maximum, so CPP comes off all 12 cheques. Contributions generally run from the month after the employee turns 18 until the month they turn 70, and stop for the year once the maximum is reached.",
        ],
      },
      {
        heading: "CPP2: the second tier for higher earners",
        paragraphs: [
          "Since 2024 there is a second pension tier. Once an employee's pensionable earnings pass the YMPE ($74,600), an additional contribution — CPP2 — applies at 4.00% on earnings between the YMPE and a higher ceiling, the year's additional maximum pensionable earnings (YAMPE) of $85,000 for 2026. There is no exemption in this tier, and the maximum CPP2 contribution is ($85,000 − $74,600) × 4.00% = $416.00, again matched by the employer. CPP2 is a deduction from income, not a credit.",
          "In practice CPP2 shows up late in the year and confuses people: the regular CPP line stops (the maximum was reached), then a new, smaller CPP2 line appears. Example: a $90,000 salary. CPP reaches its $4,230.45 maximum during the year. CPP2 then applies to the $10,400 of earnings inside the second-tier band — the salary above $85,000 earns no further contribution — for the full $416.00 maximum. Total employee pension cost for 2026: $4,646.45, with the same again from the employer.",
        ],
        notes: [
          "CPP2 is not a second CPP. It has its own earnings band, its own maximum, and its own T4 reporting — payroll that lumps it into CPP will misstate both.",
          "Quebec's QPP has the identical two-tier structure, at a 6.30% first-tier rate. See the Quebec payroll guide.",
        ],
      },
      {
        heading: "EI: a flat premium with a hard stop",
        paragraphs: [
          "Employment Insurance is simpler: 1.63% of insurable earnings in 2026, with no exemption, up to maximum insurable earnings (MIE) of $68,900. The maximum employee premium is $68,900 × 1.63% = $1,123.07. The employer pays 1.4 times the employee premium — an effective 2.282% — unless CRA has approved a reduced employer rate for a wage-loss replacement plan.",
          "On the $60,000 example, EI is $5,000 × 1.63% = $81.50 per month, $978.00 for the year — under the maximum, so it runs all year. On the $90,000 salary, insurable earnings stop accumulating at $68,900 partway through the year and EI stops at $1,123.07, while salary keeps being paid. Quebec employees pay 1.30% instead (maximum $895.70) because the Quebec Parental Insurance Plan covers parental benefits separately.",
          "One employee-side comfort: if someone works two jobs and overpays EI (or CPP) across employers, the excess employee premiums are refunded when they file their tax return. The employer's overpaid share is not refunded, which is one more reason to track year-to-date maximums per employee rather than per paycheque.",
        ],
      },
      {
        heading: "CPP, CPP2, and EI in Nexvar Pay",
        paragraphs: [
          "Nexvar Pay's calculation engine applies CRA's T4127 formulas for the pay date of each run — per-period exemptions, year-to-date maximums for CPP, CPP2, and EI, the base/enhancement CPP split, the employer's matching and 1.4× shares, and the Quebec rates where they apply. Because maximums are tracked cumulatively, deductions stop in the correct run rather than overshooting and needing a year-end fix, and the remittance totals the reports produce are the employee plus employer amounts CRA expects.",
        ],
      },
    ],
    faq: [
      {
        question: "Why did CPP stop coming off my employee's cheques in November?",
        answer:
          "They reached the 2026 maximum employee contribution of $4,230.45. CPP is capped annually; once year-to-date contributions hit the maximum, no more CPP is deducted until January. Watch for CPP2 — it may still apply to earnings between $74,600 and $85,000.",
      },
      {
        question: "Does the employer really pay the same CPP as the employee?",
        answer:
          "Yes — CPP and CPP2 are matched dollar for dollar by the employer. EI is the exception: the employer pays 1.4 times the employee's premium. Budget roughly $2 of employer cost for every $1 of employee CPP/EI on a typical paycheque below the maximums.",
      },
      {
        question: "Are the 2027 CPP and EI amounts available yet?",
        answer:
          "Partly. The 2027 EI amounts were announced in September 2026: a 1.64% employee rate on insurable earnings up to $70,800, for a maximum premium of $1,161.12 (Quebec: 1.29%, maximum $913.32). The 2027 CPP and CPP2 earnings ceilings and maximums had not been published when this guide was written — they normally appear in the fall. The 2026 figures in this guide remain the ones to use for 2026 pay dates.",
      },
    ],
  },
  {
    slug: "payroll-remittance-due-dates",
    title: "Payroll remittance due dates: your remitter type sets the deadline",
    metaTitle: "Payroll Remittance Due Dates Canada (2026) | Nexvar Pay Guide",
    description:
      "CRA remitter types explained — regular, quarterly, and accelerated threshold 1 and 2 — with the average monthly withholding amounts that assign your type, every due date, and the weekend rule.",
    intro:
      "The money you withhold from employees is held in trust for the Crown, and CRA gives you a deadline for handing it over. Which deadline applies is not your choice: CRA assigns every employer a remitter type based on how much they withhold, and each type has its own calendar.",
    category: "Remittances",
    priority: 0.9,
    related: ["cpp-cpp2-ei-deductions-2026", "quebec-payroll-qpp-qpip-rl-1", "td1-forms-claim-codes"],
    sections: [
      {
        heading: "What a remittance includes",
        paragraphs: [
          "Your remittance is everything payroll withheld plus the employer's own shares: employee and employer CPP (or QPP) contributions including CPP2, employee and employer EI premiums, and the federal and provincial income tax deducted at source. For Quebec employees, the Quebec portions (Quebec tax, QPP, QPIP, and Quebec employer contributions) are remitted separately to Revenu Québec, while the federal tax and EI still go to CRA — the deadlines in this guide are the CRA ones.",
          "The measuring stick for your remitter type is the average monthly withholding amount (AMWA): the total payroll deductions you remitted in a calendar year, divided by the number of months in that year in which you remitted. CRA reviews the AMWA over a look-back period — normally the second preceding calendar year — and your type for a given year is set from it. Cross a threshold and CRA moves you to a faster schedule.",
        ],
      },
      {
        heading: "The four remitter types",
        table: {
          headers: ["Remitter type", "Average monthly withholding", "Due dates"],
          rows: [
            [
              "Quarterly",
              "Under $3,000, with a perfect compliance record",
              "April 15, July 15, October 15, and January 15 — one remittance per quarter",
            ],
            [
              "Regular",
              "Under $25,000 — the default, including new employers (smaller employers who qualify remit quarterly instead)",
              "The 15th of the month after the month you paid your employees",
            ],
            [
              "Accelerated — threshold 1",
              "$25,000 to $99,999.99",
              "Pay dated the 1st–15th: due the 25th of the same month. Pay dated the 16th–end of month: due the 10th of the next month",
            ],
            [
              "Accelerated — threshold 2",
              "$100,000 or more",
              "Within 3 working days after the end of each pay period block: the 1st–7th, 8th–14th, 15th–21st, and 22nd–end of month",
            ],
          ],
          caption:
            "CRA remitter types and due dates (RC4120 / CRA payroll guidance). 'Working days' for threshold 2 exclude Saturdays, Sundays, and public holidays. Quebec employers follow a parallel Revenu Québec schedule for the Quebec portion.",
        },
      },
      {
        heading: "Due dates in practice",
        steps: [
          "Find your type: CRA tells you your remitter type when your payroll account opens and notifies you when it changes. New employers start as regular (monthly) remitters until an AMWA history exists.",
          "Mark the calendar for the whole year, not month by month — accelerated types remit two or four times a month, and the 25th/10th pattern of threshold 1 is easy to miss in a short month.",
          "Apply the weekend rule: if a due date falls on a Saturday, Sunday, or a CRA-recognized public holiday, the deadline moves to the next business day. The money must be received by CRA by the deadline — build in processing time for your payment method rather than paying on the day itself.",
          "Remit even when nothing is owing: if you had no employees or no deductions in a period, report a nil remittance instead of staying silent, so CRA does not assess you for a missing payment.",
        ],
        notes: [
          "Quarterly remitting is a privilege with conditions: AMWA under $3,000 and a perfect compliance record over the previous 12 months — no late remittances, no amounts owing, all T4 filings on time.",
          "Your type can change as you grow. When CRA notifies you of a new type, the new schedule takes effect as stated in their notice — update your calendar the same day.",
        ],
      },
      {
        heading: "What late actually costs",
        paragraphs: [
          "Late remittances are penalized on a sliding scale: 3% if the amount is 1 to 3 days late, 5% at 4 to 5 days, 7% at 6 to 7 days, and 10% if it is 8 or more days late or not remitted at all — plus interest compounded daily at the prescribed rate on amounts owing. A repeat failure in the same calendar year, when the failure was made knowingly or with gross negligence, can be penalized at 20%. Because the penalty is a percentage of the whole remittance, a threshold-2 employer three days late can owe more in penalties than the payroll software that would have prevented it costs in a year.",
          "Directors should know the withheld amounts are trust amounts: in a failure, CRA can pursue directors personally, and the trust claim ranks ahead of most other creditors. The remittance calendar is not an accounts-payable preference — it is the one bill that is never really the company's money.",
        ],
      },
      {
        heading: "Remittances in Nexvar Pay",
        paragraphs: [
          "Nexvar Pay's remittance report totals, for any period, exactly what has to go out: employee and employer CPP/CPP2 and EI, and the tax withheld — the same figures your finalized pay runs produced, in PD7A-ready form. Run the report for the period your remitter type covers, remit that amount by your deadline, and the report and the payment agree because they came from the same records. Quebec companies see the Revenu Québec portion totalled separately.",
        ],
      },
    ],
    faq: [
      {
        question: "I'm a brand-new employer. Which remitter type am I?",
        answer:
          "Regular — monthly, due the 15th of the following month. CRA assigns new employers the regular type until a withholding history exists, then reviews your average monthly withholding amount and notifies you of any change.",
      },
      {
        question: "My due date lands on a Sunday. What do I do?",
        answer:
          "The deadline moves to the next business day. Make sure the payment is received by CRA by that business day — if you pay through a channel with processing delay, send it earlier.",
      },
      {
        question: "Can I choose to remit quarterly to save time?",
        answer:
          "No. Remitter type is assigned by CRA from your average monthly withholding amount. Quarterly remitting is only available under $3,000 AMWA with a perfect 12-month compliance record — and CRA will tell you if you qualify.",
      },
    ],
  },
  {
    slug: "payroll-sync-nexvar-pay-ledgerpro",
    title: "How Nexvar Pay posts payroll into Nexvar LedgerPro",
    metaTitle: "Payroll Sync: Nexvar Pay to LedgerPro Journals | Guide",
    description:
      "See how finalizing a pay run in Nexvar Pay creates one balanced journal in Nexvar LedgerPro — the granular Mode 2 account mapping, Quebec handling, and the duplicate protection behind the sync.",
    intro:
      "In most small businesses, payroll lives in one system and the books in another, and a human re-types the totals every pay period. Nexvar Pay removes that step: when a pay run is finalized, it posts the journal to Nexvar LedgerPro itself — once, balanced, and labelled so you can trace it back.",
    category: "Connected products",
    priority: 0.8,
    related: ["payroll-remittance-due-dates", "province-of-employment-rules", "cpp-cpp2-ei-deductions-2026"],
    sections: [
      {
        heading: "Why payroll belongs in the books automatically",
        paragraphs: [
          "A pay run is not just cheques to employees. It creates the business's wage expense, its employer payroll costs, and a stack of liabilities — CPP, EI, and tax payable to CRA, another set for Revenu Québec, and net pay owed to employees until payday. If those amounts are re-keyed into the accounting system, three things go wrong on a schedule: transposed digits, a remittance paid from the bank that never clears the liability account it was meant to settle, and month-end wages that refuse to match the T4 totals.",
          "The fix is to make the system that calculated the payroll write the journal. The numbers are identical by construction, and the liability accounts in the books always agree with what payroll says is owed.",
        ],
      },
      {
        heading: "What happens when you finalize a pay run",
        steps: [
          "You review and finalize the pay run in Nexvar Pay, exactly as you would without the connection.",
          "On finalization, Nexvar Pay builds one journal entry for the whole run — not one per employee — and sends it to your LedgerPro company through its API, using a per-company API key with posting permission.",
          "The journal lands in LedgerPro dated to the pay run and tagged with the source 'Payroll — Nexvar Pay', so it is recognisable in the journal list and never confused with a hand-keyed entry.",
          "The sync is duplicate-safe: each pay run carries its own identity, so a retried or repeated send cannot post the same payroll twice. If a run did not sync, its status shows it, and it can be sent again deliberately.",
        ],
      },
      {
        heading: "The journal itself: two levels of detail",
        paragraphs: [
          "You choose how much detail the journal carries. Mode 1 keeps it to three lines. Mode 2 — the granular mapping — splits the run into the accounts an accountant actually wants to see, using LedgerPro's default chart (every code can be re-pointed to your own chart during setup):",
        ],
        table: {
          headers: ["Journal line", "Mode 1 (simple)", "Mode 2 (granular)"],
          rows: [
            ["Gross wages expense", "Dr 6920 — combined with employer cost", "Dr 6920 — gross wages only"],
            ["Employer CPP/CPP2/EI expense", "Included in the 6920 debit", "Dr 6940 — Employer Payroll Taxes Expense"],
            ["CPP payable (employee + employer)", "Cr 2400 — combined remittance payable", "Cr 2410 — CPP payable (CPP2 folds in by default)"],
            ["EI payable (employee + employer)", "Cr 2400", "Cr 2420 — EI payable"],
            ["Income tax payable (federal + provincial)", "Cr 2400", "Cr 2430 — Income Tax payable"],
            ["Net pay owed to employees", "Cr 2400", "Cr 2440 — Wages Payable"],
          ],
          caption:
            "Debits always equal credits: gross pay plus employer contributions on one side; net pay plus every amount payable to CRA or Revenu Québec on the other. When employees are paid and remittances are sent, those payments clear the 2440 and payable accounts in LedgerPro's banking — which is how the books prove the liabilities are settled.",
        },
      },
      {
        heading: "Quebec pay runs",
        paragraphs: [
          "Quebec runs use the same journal shape. QPP contributions travel on the CPP lines and QPIP premiums fold into the EI lines, because the tax engine already carries them in those totals — the balance identity (gross + employer cost = net pay + amounts payable) holds unchanged, and there is no separate Quebec journal format to reconcile.",
        ],
      },
      {
        heading: "Setting it up",
        steps: [
          "In LedgerPro, create an API key for the company with posting permission (Settings → Developer).",
          "In Nexvar Pay, open the LedgerPro integration, paste the key, and run Test Connection — it confirms the company and the accounts the journal needs.",
          "Choose Mode 1 or Mode 2 and confirm the account mapping (the defaults follow LedgerPro's template chart; re-point any line to your own codes).",
          "Turn sync on. From the next finalized pay run, journals post themselves.",
        ],
        notes: [
          "The connection is one-directional and narrow: Nexvar Pay can post payroll journals to the one connected LedgerPro company. It does not read or change anything else in your books.",
          "Payroll journals are tagged 'Payroll — Nexvar Pay' in LedgerPro, so an accountant reviewing the year can filter straight to them.",
        ],
      },
      {
        heading: "What this replaces",
        paragraphs: [
          "The spreadsheet of pay-run totals someone used to email the bookkeeper. The journal entry typed from a PDF at month-end. The December afternoon spent explaining why the wages account is $214.60 off the T4 summary. Finalize the run in Nexvar Pay, and the books already know.",
        ],
      },
    ],
    faq: [
      {
        question: "Does the sync post one journal per employee?",
        answer:
          "No — one balanced journal per finalized pay run, using the run's totals. Employee-level detail stays in Nexvar Pay's pay stubs and reports; the general ledger gets the totals it needs.",
      },
      {
        question: "What if the same pay run is sent twice?",
        answer:
          "It can't post twice. Each pay run syncs under its own unique identity, so a retry after a network failure is recognised and the duplicate is refused. The journal in LedgerPro always appears exactly once.",
      },
      {
        question: "Can I change which LedgerPro accounts the journal uses?",
        answer:
          "Yes. The default mapping follows LedgerPro's template chart (6920 wages, 6940 employer payroll taxes, 2410/2420/2430 payables, 2440 wages payable), and each line can be re-pointed to a different account code when you set up the connection.",
      },
    ],
  },
];
