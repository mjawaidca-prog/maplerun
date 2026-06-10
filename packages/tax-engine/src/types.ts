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

export interface PayInput {
  /** ISO yyyy-mm-dd — selects the tax-table edition. */
  payDate: string;
  province: ProvinceCode;
  frequency: PayFrequency;
  /** Gross taxable income for the period (earnings + taxable benefits). */
  grossPeriodIncome: number;
  /** Per-period tax-deductible amounts (RPP, RRSP, union dues) — F in T4127. */
  periodDeductions?: number;
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
  cpp: number;
  cpp2: number;
  ei: number;
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
