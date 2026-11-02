/** Two-letter codes for all Canadian provinces and territories. */
export type ProvinceCode =
  | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT'
  | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

export class TaxEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaxEngineError';
  }
}

export interface TableMeta {
  /** False until every value has been checked against the cited CRA/provincial source. */
  verified: boolean;
  source: string;
  /** ISO date of last human/agent review. */
  lastReviewed: string;
}

export interface TaxBracket {
  /** Upper bound of annual taxable income for this bracket; null = top bracket. */
  upTo: number | null;
  rate: number;
  /**
   * Published cumulative constant for this bracket (K in T4127 Table 8.1
   * for federal, KP for provinces/territories; K in TP-1015.F for Quebec).
   * When present, bracketFor uses it verbatim — CRA/RQ publish these
   * rounded to whole dollars, and PDOC/WebRAS compute with the published
   * values, not with the exact threshold derivation. Absent on tables
   * whose constants have not been published yet (e.g. 2027), where
   * bracketFor falls back to deriving from the thresholds.
   */
  k?: number;
}

/** Income-tested basic personal amount (federal and Yukon). */
export interface DynamicBpa {
  max: number;
  min: number;
  phaseOutStart: number;
  phaseOutEnd: number;
}

export interface FederalTable {
  year: number;
  edition: string;
  lowestRate: number;
  brackets: TaxBracket[];
  bpa: DynamicBpa;
  /** Canada Employment Amount (K4 credit base). */
  cea: number;
  meta: TableMeta;
}

export interface SurtaxThreshold {
  /** Surtax applies to basic provincial tax above this amount. */
  over: number;
  rate: number;
}

/** BC low-income tax reduction (factor S): min(tax, max − rate × (A − start)), zero above end. */
export interface LowIncomeReduction {
  max: number;
  phaseOutStart: number;
  phaseOutRate: number;
  phaseOutEnd: number;
}

/** ON tax reduction (factor S): lesser of tax and 2 × base − tax, floored at zero. */
export interface OntarioTaxReduction {
  base: number;
}

/** AB K5P: credits beyond the first bracket's tax are topped up by this rate (8% credits effective at 10%). */
export interface CreditTopUp {
  rate: number;
}

export interface HealthPremiumBand {
  /** Band applies when annual taxable income exceeds this amount. */
  over: number;
  base: number;
  rate: number;
  cap: number;
}

export interface ProvincialTable {
  province: ProvinceCode;
  year: number;
  lowestRate: number;
  brackets: TaxBracket[];
  bpa: number | DynamicBpa;
  /** Ontario surtax tiers. */
  surtax?: SurtaxThreshold[];
  /** Ontario health premium schedule. */
  healthPremiumBands?: HealthPremiumBand[];
  /** Provincial Canada-employment-amount credit (K4P) — Yukon only. */
  cea?: number;
  /** Alberta K5P. */
  creditTopUp?: CreditTopUp;
  /** BC factor S. */
  lowIncomeReduction?: LowIncomeReduction;
  /** ON factor S (Y dependant amounts not yet modelled — over-deduction reconciles at T1 filing). */
  ontarioTaxReduction?: OntarioTaxReduction;
  /** Quebec until Phase 2 — engine refuses to compute. */
  notImplemented?: boolean;
  /** Known unmodelled features (e.g. BC tax reduction) — surfaced as warnings. */
  notes?: string[];
  meta: TableMeta;
}

export interface CppTable {
  year: number;
  /** Year's Maximum Pensionable Earnings. */
  ympe: number;
  /** Year's Additional Maximum Pensionable Earnings (CPP2 ceiling). */
  yampe: number;
  basicExemption: number;
  /** Total first-tier employee rate (base + first enhancement). */
  employeeRate: number;
  /** Base rate — the portion that is a non-refundable tax credit (K2). */
  baseRate: number;
  /** Second additional contribution rate between YMPE and YAMPE. */
  cpp2Rate: number;
  meta: TableMeta;
}

export interface EiTable {
  year: number;
  maxInsurableEarnings: number;
  employeeRate: number;
  /** Reduced employee rate for Quebec (QPIP exists there). */
  employeeRateQuebec: number;
  employerMultiple: number;
  meta: TableMeta;
}

export interface TaxTables {
  effectiveFrom: string;
  effectiveTo: string;
  federal: FederalTable;
  provinces: Record<ProvinceCode, ProvincialTable>;
  cpp: CppTable;
  ei: EiTable;
}

export interface EmployeeYtd {
  pensionableEarnings: number;
  cpp: number;
  cpp2: number;
  insurableEarnings: number;
  ei: number;
}

export const ZERO_YTD: EmployeeYtd = {
  pensionableEarnings: 0,
  cpp: 0,
  cpp2: 0,
  insurableEarnings: 0,
  ei: 0,
};

/**
 * A named per-period deduction (Wave 3 B6) — e.g. an RRSP contribution,
 * union dues, or a benefits premium withheld from this period's pay.
 * Each flag controls which statutory base the amount reduces:
 *  - reducesTaxable:     the T4127 factor F (lowers income tax only);
 *  - reducesPensionable: the CPP/QPP pensionable base;
 *  - reducesInsurable:   the EI (and QPIP) insurable base.
 * The amount itself is withheld from net pay by the CALLER — the
 * engine only models its effect on the bases (see resolveDeductions).
 */
// Declared as a type alias (not an interface) on purpose: object
// type aliases get implicit index signatures, which is what lets a
// NamedDeduction[] be assigned to a Prisma `Json` column
// (Prisma.InputJsonValue) by callers persisting the applied list.
export type NamedDeduction = {
  name: string;
  amount: number;
  reducesPensionable: boolean;
  reducesInsurable: boolean;
  reducesTaxable: boolean;
};

export interface PayInput {
  /** ISO yyyy-mm-dd — selects the tax-table edition. */
  payDate: string;
  province: ProvinceCode;
  frequency: PayFrequency;
  /** Gross taxable income for the period (earnings + taxable benefits). */
  grossPeriodIncome: number;
  /**
   * Per-period tax-deductible amounts (RPP, RRSP, union dues) — F in T4127.
   * Either a bare total (legacy form: reduces the taxable base only,
   * exactly as before) or a list of NamedDeduction (Wave 3 B6), whose
   * per-flag amounts reduce the pensionable / insurable / taxable bases.
   */
  periodDeductions?: number | NamedDeduction[];
  /**
   * Wave 3 B6 — non-cash taxable benefits for the period (e.g. employer
   * paid group insurance, car benefit). CPP/EI/tax are computed on
   * (gross + benefits); the cash gross and the amount the employee is
   * paid do NOT include the benefit. Defaults to 0.
   */
  taxableBenefits?: number;
  /**
   * Wave 3 B6 — TD1 additional tax to deduct per period (TD1 line 2).
   * Added to the period's federal tax after the T4127 computation.
   * Defaults to 0.
   */
  extraTaxPerPeriod?: number;
  /** CRA-authorized annual deductions (e.g. prescribed-zone) — HD in T4127. */
  annualDeductions?: number;
  /** TD1 federal total claim (TC). Defaults to the income-tested federal BPA. */
  federalClaim?: number;
  /** TD1 provincial total claim (TCP). Defaults to the provincial BPA. */
  provincialClaim?: number;
  ytd?: EmployeeYtd;
  cppExempt?: boolean;
  eiExempt?: boolean;
}

export interface EmployerCosts {
  cpp: number;
  cpp2: number;
  ei: number;
  total: number;
}

export interface PayResult {
  gross: number;
  /** Wave 3 B6 — the taxable-benefits amount the deduction bases
   *  included (echo of PayInput.taxableBenefits; 0 when none). Not
   *  part of `gross` and never added to net pay. */
  taxableBenefits: number;
  cpp: number;
  cpp2: number;
  ei: number;
  /** Employee QPIP premium (Quebec only; 0 elsewhere). For QC, `cpp`/`cpp2`
   * carry the QPP/QPP2 amounts and `ei` excludes QPIP — this field exposes
   * the QPIP component that totalDeductions already includes. */
  qpip: number;
  federalTax: number;
  provincialTax: number;
  totalDeductions: number;
  netPay: number;
  /** A — annualized taxable income used for the tax calculation. */
  annualTaxableIncome: number;
  employer: EmployerCosts;
  /** YTD ledger rolled forward to after this payment. */
  newYtd: EmployeeYtd;
  warnings: string[];
}
