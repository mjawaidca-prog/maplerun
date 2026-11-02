import { describe, expect, it } from 'vitest';
import {
  albertaAverageDailyWage,
  calcStatHolidayPay,
  ontarioPublicHolidayPay,
} from '../src/calc/stat-holiday';
import { TaxEngineError } from '../src/types';

describe('albertaAverageDailyWage', () => {
  it('is 5% of wages in the 4 weeks before the holiday week (4000 → 200)', () => {
    expect(albertaAverageDailyWage(4000)).toBe(200);
  });

  it('rounds to cents and handles zero', () => {
    expect(albertaAverageDailyWage(0)).toBe(0);
    expect(albertaAverageDailyWage(3333.33)).toBe(166.67);
  });

  it('throws on a negative wage base', () => {
    expect(() => albertaAverageDailyWage(-1)).toThrow(TaxEngineError);
  });
});

describe('ontarioPublicHolidayPay', () => {
  it('is (regular wages + vacation pay payable) / 20 (8000 + 320 → 416)', () => {
    expect(ontarioPublicHolidayPay(8000, 320)).toBe(416);
  });

  it('rounds to cents and handles zero', () => {
    expect(ontarioPublicHolidayPay(0, 0)).toBe(0);
    expect(ontarioPublicHolidayPay(1000, 0)).toBe(50);
  });

  it('throws on negative inputs', () => {
    expect(() => ontarioPublicHolidayPay(-1, 0)).toThrow(TaxEngineError);
    expect(() => ontarioPublicHolidayPay(0, -1)).toThrow(TaxEngineError);
  });
});

describe('calcStatHolidayPay — Alberta', () => {
  const base = {
    province: 'AB' as const,
    hourlyRate: 30,
    holidayOnRegularWorkDay: true,
    wagesIn4WeeksBeforeHolidayWeek: 4000,
    employed30WorkDaysInPast12Months: true,
  };

  it('eligible, not worked, holiday on a regular work day → ADW as holiday pay', () => {
    const r = calcStatHolidayPay({ ...base });
    expect(r.eligible).toBe(true);
    expect(r.holidayPay).toBe(200);
    expect(r.premiumPay).toBe(0);
    expect(r.regularPayForHolidayHours).toBe(0);
    expect(r.substituteDayOwed).toBe(false);
    expect(r.explanation.length).toBeGreaterThan(0);
  });

  it('not eligible (fewer than 30 work days in past 12 months) → zeros', () => {
    const r = calcStatHolidayPay({ ...base, employed30WorkDaysInPast12Months: false });
    expect(r.eligible).toBe(false);
    expect(r.holidayPay).toBe(0);
    expect(r.premiumPay).toBe(0);
    expect(r.regularPayForHolidayHours).toBe(0);
    expect(r.substituteDayOwed).toBe(false);
  });

  it('not eligible → zeros even when the employee worked the holiday', () => {
    const r = calcStatHolidayPay({
      ...base,
      employed30WorkDaysInPast12Months: false,
      hoursWorkedOnHoliday: 8,
    });
    expect(r.eligible).toBe(false);
    expect(r.holidayPay).toBe(0);
    expect(r.premiumPay).toBe(0);
  });

  it('not worked, holiday on a non-regular work day → no holiday pay', () => {
    const r = calcStatHolidayPay({ ...base, holidayOnRegularWorkDay: false });
    expect(r.eligible).toBe(true);
    expect(r.holidayPay).toBe(0);
    expect(r.premiumPay).toBe(0);
    expect(r.substituteDayOwed).toBe(false);
  });

  it('worked on a regular day, premium-plus-ADW election (default) → premium 360 + holidayPay 200', () => {
    const r = calcStatHolidayPay({ ...base, hoursWorkedOnHoliday: 8 });
    expect(r.eligible).toBe(true);
    expect(r.premiumPay).toBe(360);
    expect(r.holidayPay).toBe(200);
    expect(r.regularPayForHolidayHours).toBe(0);
    expect(r.substituteDayOwed).toBe(false);
  });

  it('worked on a regular day, explicit premium-plus-ADW election → premium 360 + holidayPay 200', () => {
    const r = calcStatHolidayPay({
      ...base,
      hoursWorkedOnHoliday: 8,
      albertaElection: 'premium-plus-adw',
    });
    expect(r.premiumPay).toBe(360);
    expect(r.holidayPay).toBe(200);
    expect(r.substituteDayOwed).toBe(false);
  });

  it('worked on a regular day, regular-plus-day-off election → regular 240, substitute owed, holidayPay 0', () => {
    const r = calcStatHolidayPay({
      ...base,
      hoursWorkedOnHoliday: 8,
      albertaElection: 'regular-plus-day-off',
    });
    expect(r.eligible).toBe(true);
    expect(r.regularPayForHolidayHours).toBe(240);
    expect(r.premiumPay).toBe(0);
    expect(r.holidayPay).toBe(0);
    expect(r.substituteDayOwed).toBe(true);
    expect(r.explanation.join(' ')).toMatch(/substitute/i);
  });

  it('worked on a non-regular work day → premium only', () => {
    const r = calcStatHolidayPay({
      ...base,
      holidayOnRegularWorkDay: false,
      hoursWorkedOnHoliday: 8,
    });
    expect(r.eligible).toBe(true);
    expect(r.premiumPay).toBe(360);
    expect(r.holidayPay).toBe(0);
    expect(r.regularPayForHolidayHours).toBe(0);
    expect(r.substituteDayOwed).toBe(false);
  });

  it('warns when the 4-week wage base is missing (defaulted to 0)', () => {
    const r = calcStatHolidayPay({
      province: 'AB',
      hourlyRate: 30,
      holidayOnRegularWorkDay: true,
      employed30WorkDaysInPast12Months: true,
    });
    expect(r.holidayPay).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings.join(' ')).toMatch(/4-week wage base/i);
  });
});

describe('calcStatHolidayPay — Ontario', () => {
  const base = {
    province: 'ON' as const,
    hourlyRate: 30,
    holidayOnRegularWorkDay: true,
    regularWagesIn4WorkWeeksBefore: 8000,
    vacationPayPayableIn4WorkWeeksBefore: 320,
    workedLastScheduledDayBefore: true,
    workedFirstScheduledDayAfter: true,
  };

  it('eligible, not worked, holiday on an ordinary work day → PHP 416', () => {
    const r = calcStatHolidayPay({ ...base });
    expect(r.eligible).toBe(true);
    expect(r.holidayPay).toBe(416);
    expect(r.premiumPay).toBe(0);
    expect(r.regularPayForHolidayHours).toBe(0);
    expect(r.substituteDayOwed).toBe(false);
    expect(r.explanation.length).toBeGreaterThan(0);
  });

  it('last-and-first failed without reasonable cause → zeros, not eligible', () => {
    const r = calcStatHolidayPay({ ...base, workedLastScheduledDayBefore: false });
    expect(r.eligible).toBe(false);
    expect(r.holidayPay).toBe(0);
    expect(r.premiumPay).toBe(0);
    expect(r.substituteDayOwed).toBe(false);
  });

  it('last-and-first failed on the day after without reasonable cause → zeros, not eligible', () => {
    const r = calcStatHolidayPay({ ...base, workedFirstScheduledDayAfter: false });
    expect(r.eligible).toBe(false);
    expect(r.holidayPay).toBe(0);
    expect(r.premiumPay).toBe(0);
  });

  it('last-and-first failed WITH reasonable cause → still entitled to PHP 416', () => {
    const r = calcStatHolidayPay({
      ...base,
      workedLastScheduledDayBefore: false,
      failureHasReasonableCause: true,
    });
    expect(r.eligible).toBe(true);
    expect(r.holidayPay).toBe(416);
  });

  it('worked, default → PHP 416 + premium 1.5 × 30 × 8 = 360', () => {
    const r = calcStatHolidayPay({ ...base, hoursWorkedOnHoliday: 8 });
    expect(r.eligible).toBe(true);
    expect(r.holidayPay).toBe(416);
    expect(r.premiumPay).toBe(360);
    expect(r.regularPayForHolidayHours).toBe(0);
    expect(r.substituteDayOwed).toBe(false);
  });

  it('worked with substituteDayElected → zeros + substitute day owed', () => {
    const r = calcStatHolidayPay({
      ...base,
      hoursWorkedOnHoliday: 8,
      substituteDayElected: true,
    });
    expect(r.eligible).toBe(true);
    expect(r.holidayPay).toBe(0);
    expect(r.premiumPay).toBe(0);
    expect(r.regularPayForHolidayHours).toBe(0);
    expect(r.substituteDayOwed).toBe(true);
  });

  it('not worked, holiday on a non-working day → substitute day owed, holidayPay 0', () => {
    const r = calcStatHolidayPay({ ...base, holidayOnRegularWorkDay: false });
    expect(r.eligible).toBe(true);
    expect(r.holidayPay).toBe(0);
    expect(r.premiumPay).toBe(0);
    expect(r.substituteDayOwed).toBe(true);
  });

  it('not worked, holiday on a non-working day with PHP in lieu agreed → PHP 416, no substitute day', () => {
    const r = calcStatHolidayPay({
      ...base,
      holidayOnRegularWorkDay: false,
      ontarioPhpInLieuAgreed: true,
    });
    expect(r.eligible).toBe(true);
    expect(r.holidayPay).toBe(416);
    expect(r.premiumPay).toBe(0);
    expect(r.substituteDayOwed).toBe(false);
  });

  it('warns when the 4-work-week wage bases are missing (defaulted to 0)', () => {
    const r = calcStatHolidayPay({
      province: 'ON',
      hourlyRate: 30,
      holidayOnRegularWorkDay: true,
      workedLastScheduledDayBefore: true,
      workedFirstScheduledDayAfter: true,
    });
    expect(r.holidayPay).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('calcStatHolidayPay — validation', () => {
  it('throws on a negative hourly rate', () => {
    expect(() =>
      calcStatHolidayPay({
        province: 'AB',
        hourlyRate: -30,
        holidayOnRegularWorkDay: true,
        wagesIn4WeeksBeforeHolidayWeek: 4000,
        employed30WorkDaysInPast12Months: true,
      }),
    ).toThrow(TaxEngineError);
  });

  it('throws on negative hours worked', () => {
    expect(() =>
      calcStatHolidayPay({
        province: 'ON',
        hourlyRate: 30,
        hoursWorkedOnHoliday: -1,
        holidayOnRegularWorkDay: true,
        regularWagesIn4WorkWeeksBefore: 8000,
        vacationPayPayableIn4WorkWeeksBefore: 320,
      }),
    ).toThrow(TaxEngineError);
  });

  it('throws on a negative 4-week wage base', () => {
    expect(() =>
      calcStatHolidayPay({
        province: 'AB',
        hourlyRate: 30,
        holidayOnRegularWorkDay: true,
        wagesIn4WeeksBeforeHolidayWeek: -4000,
        employed30WorkDaysInPast12Months: true,
      }),
    ).toThrow(TaxEngineError);
    expect(() =>
      calcStatHolidayPay({
        province: 'ON',
        hourlyRate: 30,
        holidayOnRegularWorkDay: true,
        regularWagesIn4WorkWeeksBefore: -8000,
        vacationPayPayableIn4WorkWeeksBefore: 320,
      }),
    ).toThrow(TaxEngineError);
  });

  it('throws on an unknown province', () => {
    expect(() =>
      calcStatHolidayPay({
        // @ts-expect-error — deliberately invalid province for the runtime check
        province: 'BC',
        hourlyRate: 30,
        holidayOnRegularWorkDay: true,
      }),
    ).toThrow(TaxEngineError);
  });
});
