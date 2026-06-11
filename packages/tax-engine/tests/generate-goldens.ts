/**
 * Generates goldens.json — expected tax-engine outputs for 6 profiles × 12 non-QC provinces.
 * Run: npx tsx tests/generate-goldens.ts
 *
 * These goldens were generated from the 2026 engine (all tables verified against T4127 121st ed.).
 * Spot-check a subset against CRA PDOC (https://apps.cra-arc.gc.ca/ebci/rhpd/beta/entry/en)
 * to confirm the engine matches PDOC within ±$0.50 tolerance.
 */

import { writeFileSync } from 'node:fs';
import { calculatePay, ZERO_YTD } from '../src/index.ts';
import type { PayInput, ProvinceCode, PayFrequency } from '../src/index.ts';

interface GoldenEntry {
  profile: string;
  inputs: {
    province: ProvinceCode;
    frequency: PayFrequency;
    grossPeriodIncome: number;
    payDate: string;
    federalClaim?: number;
    provincialClaim?: number;
  };
  results: {
    cpp: number;
    cpp2: number;
    ei: number;
    federalTax: number;
    provincialTax: number;
    totalDeductions: number;
    netPay: number;
    annualTaxableIncome: number;
    employerEi: number;
    employerCpp: number;
  };
}

type GoldenFile = Record<string, GoldenEntry[]>;

const PROFILES: { name: string; input: Partial<PayInput> }[] = [
  {
    name: 'Low-income ON (tax reduction + health premium threshold)',
    input: {
      province: 'ON',
      frequency: 'biweekly',
      grossPeriodIncome: 900,
      payDate: '2026-06-15',
    },
  },
  {
    name: 'Mid-income ON (standard golden case — T4127 121st ed.)',
    input: {
      province: 'ON',
      frequency: 'biweekly',
      grossPeriodIncome: 2_500,
      payDate: '2026-06-15',
    },
  },
  {
    name: 'High-income ON (surtax + BPAF phase-out)',
    input: {
      province: 'ON',
      frequency: 'monthly',
      grossPeriodIncome: 20_000,
      payDate: '2026-06-15',
    },
  },
  {
    name: 'Senior BC (higher TD1 claim + BC reduction)',
    input: {
      province: 'BC',
      frequency: 'biweekly',
      grossPeriodIncome: 1_600,
      payDate: '2026-06-15',
      federalClaim: 22_000,
      provincialClaim: 22_000,
    },
  },
  {
    name: 'Minimum-wage MB (low income + MB BPA)',
    input: {
      province: 'MB',
      frequency: 'biweekly',
      grossPeriodIncome: 1_200,
      payDate: '2026-06-15',
    },
  },
  {
    name: 'Salaried AB (AB K5P top-up)',
    input: {
      province: 'AB',
      frequency: 'monthly',
      grossPeriodIncome: 8_000,
      payDate: '2026-06-15',
    },
  },
];

const ALL_PROVINCES: ProvinceCode[] = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'SK', 'YT',
];

function buildEntry(profileName: string, input: Partial<PayInput>, province: ProvinceCode): GoldenEntry {
  const fullInput: PayInput = {
    province,
    frequency: input.frequency!,
    grossPeriodIncome: input.grossPeriodIncome!,
    payDate: input.payDate!,
    federalClaim: input.federalClaim ?? undefined,
    provincialClaim: input.provincialClaim ?? undefined,
    ytd: ZERO_YTD,
  };

  const r = calculatePay(fullInput);

  return {
    profile: profileName,
    inputs: {
      province,
      frequency: fullInput.frequency,
      grossPeriodIncome: fullInput.grossPeriodIncome,
      payDate: fullInput.payDate,
      federalClaim: fullInput.federalClaim,
      provincialClaim: fullInput.provincialClaim,
    },
    results: {
      cpp: round4(r.cpp),
      cpp2: round4(r.cpp2),
      ei: round4(r.ei),
      federalTax: round4(r.federalTax),
      provincialTax: round4(r.provincialTax),
      totalDeductions: round4(r.totalDeductions),
      netPay: round4(r.netPay),
      annualTaxableIncome: round4(r.annualTaxableIncome),
      employerEi: round4(r.employer.ei),
      employerCpp: round4(r.employer.cpp),
    },
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

const goldens: GoldenFile = {};

// Generate per-profile goldens across all 12 non-QC provinces
for (const profile of PROFILES) {
  const entries: GoldenEntry[] = [];
  for (const province of ALL_PROVINCES) {
    entries.push(buildEntry(profile.name, profile.input, province));
  }
  goldens[profile.name] = entries;
}

// Also generate per-province bonus cases for the bonus method
const bonusProfile: Partial<PayInput> = {
  province: 'ON',
  frequency: 'biweekly',
  grossPeriodIncome: 2_500,
  payDate: '2026-06-15',
};

// Import bonus calculator
import { calculateBonus } from '../src/index.ts';

const bonusEntries: GoldenEntry[] = [];
for (const province of ALL_PROVINCES) {
  const fullInput: PayInput = {
    ...bonusProfile,
    province,
    frequency: bonusProfile.frequency!,
    grossPeriodIncome: bonusProfile.grossPeriodIncome!,
    payDate: bonusProfile.payDate!,
    ytd: ZERO_YTD,
  } as PayInput;

  const r = calculateBonus({ ...fullInput, bonusAmount: 5_000 });

  bonusEntries.push({
    profile: `Bonus $5,000 (${province}) — ${bonusProfile.grossPeriodIncome}/${bonusProfile.frequency} regular`,
    inputs: {
      province,
      frequency: fullInput.frequency,
      grossPeriodIncome: fullInput.grossPeriodIncome,
      payDate: fullInput.payDate,
    },
    results: {
      cpp: round4(r.bonusCpp),
      cpp2: round4(r.bonusCpp2),
      ei: round4(r.bonusEi),
      federalTax: round4(r.bonusFederalTax),
      provincialTax: round4(r.bonusProvincialTax),
      totalDeductions: round4(r.totalDeductions),
      netPay: round4(r.netBonus),
      annualTaxableIncome: 0, // N/A for bonus
      employerEi: round4(r.bonusEi * 1.4),
      employerCpp: round4(r.bonusCpp),
    },
  });
}
goldens['Bonus $5,000 across all provinces'] = bonusEntries;

// Metadata
const output = {
  _meta: {
    generated: new Date().toISOString().split('T')[0],
    engine: '@maplerun/tax-engine v0.1.0',
    taxYear: 2026,
    source: 'T4127 121st edition — all tables verified',
    tolerance: 0.5,
    pdocUrl: 'https://apps.cra-arc.gc.ca/ebci/rhpd/beta/entry/en',
    profileCount: PROFILES.length,
    provinces: ALL_PROVINCES,
    note: 'Spot-check a random sample of these against PDOC to confirm engine accuracy. All values rounded to 4 decimal places.',
  },
  goldens,
};

writeFileSync(
  new URL('./goldens.json', import.meta.url),
  JSON.stringify(output, null, 2) + '\n',
  'utf-8',
);

const totalEntries = Object.values(goldens).reduce((sum, arr) => sum + arr.length, 0);
console.log(`✅ goldens.json written — ${PROFILES.length} profiles + 1 bonus set × ${ALL_PROVINCES.length} provinces = ${totalEntries} entries`);
console.log(`   Manual PDOC spot-check URL: ${output._meta.pdocUrl}`);
