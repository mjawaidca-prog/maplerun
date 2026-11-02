/**
 * Statutory (general / public) holiday pay — Alberta and Ontario.
 *
 * Sources (official guides):
 * - Alberta: Employment Standards Code, general holidays; Government of
 *   Alberta, alberta.ca — "General holidays and general holiday pay".
 *   Eligibility requires 30 work days in the 12 months before the holiday.
 *   Average daily wage (ADW) = 5% of the wages earned in the 4 weeks
 *   immediately preceding the week in which the holiday falls (wages include
 *   general-holiday pay and vacation pay earned in that period).
 * - Ontario: Employment Standards Act, 2000 (ESA), Part X — Public holidays;
 *   Government of Ontario, ontario.ca — "Public holidays".
 *   Public holiday pay (PHP) = (regular wages earned + vacation pay payable
 *   in the 4 work weeks before the holiday week) / 20, subject to the
 *   "last and first" rule (the employee must work their last regularly
 *   scheduled day/shift before and first regularly scheduled day/shift after
 *   the holiday, unless the failure was for reasonable cause).
 *
 * This module is engine-level only: it computes the holiday-pay, premium-pay
 * and substitute-day entitlements for a single holiday. It does not decide
 * which days are named statutory holidays in each province, and it does not
 * model agreements that are more generous than the statutory minimums.
 */

import { roundCent } from '../money';
import { TaxEngineError } from '../types';

export interface StatHolidayInput {
  province: 'AB' | 'ON';
  hourlyRate: number;
  hoursWorkedOnHoliday?: number; // 0/undefined = did not work
  holidayOnRegularWorkDay: boolean;
  // Alberta (Employment Standards Code)
  wagesIn4WeeksBeforeHolidayWeek?: number; // total wages incl. general-holiday pay + vacation pay earned in the 4 weeks immediately preceding the holiday week
  employed30WorkDaysInPast12Months?: boolean;
  albertaElection?: 'premium-plus-adw' | 'regular-plus-day-off'; // employer's choice when employee works the holiday; default 'premium-plus-adw'
  // Ontario (ESA)
  regularWagesIn4WorkWeeksBefore?: number;
  vacationPayPayableIn4WorkWeeksBefore?: number;
  workedLastScheduledDayBefore?: boolean; // Ontario last-and-first rule
  workedFirstScheduledDayAfter?: boolean;
  failureHasReasonableCause?: boolean;
  substituteDayElected?: boolean; // ON: agreed substitute day instead of PHP + premium when worked; AB not applicable
  ontarioPhpInLieuAgreed?: boolean; // ON: holiday on non-working day, employee agreed in writing to PHP instead of a substitute day
}

export interface StatHolidayResult {
  eligible: boolean;
  holidayPay: number; // AB average daily wage / ON public holiday pay payable for this holiday (0 when deferred to a substitute day)
  premiumPay: number; // 1.5x pay for hours worked on the holiday
  regularPayForHolidayHours: number; // AB 'regular-plus-day-off' election only
  substituteDayOwed: boolean;
  explanation: string[];
  warnings: string[];
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new TaxEngineError(`${name} must be a non-negative number, got ${value}`);
  }
}

/** Alberta average daily wage: 5% of wages earned in the 4 weeks before the holiday week. */
export function albertaAverageDailyWage(wagesIn4WeeksBeforeHolidayWeek: number): number {
  assertNonNegativeFinite(wagesIn4WeeksBeforeHolidayWeek, 'wagesIn4WeeksBeforeHolidayWeek');
  return roundCent(0.05 * wagesIn4WeeksBeforeHolidayWeek);
}

/** Ontario public holiday pay: (regular wages + vacation pay payable in the 4 work weeks before) / 20. */
export function ontarioPublicHolidayPay(regularWages: number, vacationPayPayable: number): number {
  assertNonNegativeFinite(regularWages, 'regularWages');
  assertNonNegativeFinite(vacationPayPayable, 'vacationPayPayable');
  return roundCent((regularWages + vacationPayPayable) / 20);
}

export function calcStatHolidayPay(input: StatHolidayInput): StatHolidayResult {
  if (!input || (input.province !== 'AB' && input.province !== 'ON')) {
    throw new TaxEngineError(`Unknown province "${input?.province}"`);
  }

  assertNonNegativeFinite(input.hourlyRate, 'hourlyRate');

  const hoursWorked = input.hoursWorkedOnHoliday ?? 0;
  assertNonNegativeFinite(hoursWorked, 'hoursWorkedOnHoliday');

  // Validate every supplied monetary base, regardless of province, so a
  // negative value never silently flows through a branch that ignores it.
  if (input.wagesIn4WeeksBeforeHolidayWeek !== undefined) {
    assertNonNegativeFinite(input.wagesIn4WeeksBeforeHolidayWeek, 'wagesIn4WeeksBeforeHolidayWeek');
  }
  if (input.regularWagesIn4WorkWeeksBefore !== undefined) {
    assertNonNegativeFinite(input.regularWagesIn4WorkWeeksBefore, 'regularWagesIn4WorkWeeksBefore');
  }
  if (input.vacationPayPayableIn4WorkWeeksBefore !== undefined) {
    assertNonNegativeFinite(
      input.vacationPayPayableIn4WorkWeeksBefore,
      'vacationPayPayableIn4WorkWeeksBefore',
    );
  }

  if (
    input.albertaElection !== undefined &&
    input.albertaElection !== 'premium-plus-adw' &&
    input.albertaElection !== 'regular-plus-day-off'
  ) {
    throw new TaxEngineError(`Unknown albertaElection "${input.albertaElection}"`);
  }

  return input.province === 'AB' ? calcAlberta(input, hoursWorked) : calcOntario(input, hoursWorked);
}

function calcAlberta(input: StatHolidayInput, hoursWorked: number): StatHolidayResult {
  const explanation: string[] = [];
  const warnings: string[] = [];

  let wages = input.wagesIn4WeeksBeforeHolidayWeek;
  if (wages === undefined) {
    warnings.push(
      'wagesIn4WeeksBeforeHolidayWeek was not supplied — the 4-week wage base was defaulted to 0, so the average daily wage is $0. Supply total wages (including general-holiday pay and vacation pay) earned in the 4 weeks immediately preceding the holiday week.',
    );
    wages = 0;
  }

  if (input.employed30WorkDaysInPast12Months === undefined) {
    warnings.push(
      'employed30WorkDaysInPast12Months was not supplied — Alberta eligibility was assumed. Confirm the employee worked at least 30 work days in the 12 months before the holiday.',
    );
  }

  // Alberta eligibility: 30 work days in the 12 months before the holiday.
  if (input.employed30WorkDaysInPast12Months === false) {
    explanation.push(
      'Alberta: employee is not eligible for general holiday pay — eligibility under the Employment Standards Code requires the employee to have worked 30 work days in the 12 months before the holiday, and that requirement was not met.',
    );
    explanation.push('No general holiday pay, premium pay, or substitute day is payable for this holiday.');
    return {
      eligible: false,
      holidayPay: 0,
      premiumPay: 0,
      regularPayForHolidayHours: 0,
      substituteDayOwed: false,
      explanation,
      warnings,
    };
  }

  const adw = albertaAverageDailyWage(wages);
  const worked = hoursWorked > 0;
  const rate = input.hourlyRate;

  if (!worked) {
    if (input.holidayOnRegularWorkDay) {
      explanation.push(
        `Alberta: average daily wage = 5% of $${wages.toFixed(2)} earned in the 4 weeks immediately preceding the holiday week = $${adw.toFixed(2)}.`,
      );
      explanation.push(
        'The employee did not work on the holiday and the holiday fell on a day that would normally be a regular work day, so the employee is entitled to the average daily wage as general holiday pay.',
      );
      return {
        eligible: true,
        holidayPay: adw,
        premiumPay: 0,
        regularPayForHolidayHours: 0,
        substituteDayOwed: false,
        explanation,
        warnings,
      };
    }
    explanation.push(
      'Alberta: the employee did not work on the holiday and the holiday did not fall on a regular work day for this employee, so no general holiday pay is payable.',
    );
    return {
      eligible: true,
      holidayPay: 0,
      premiumPay: 0,
      regularPayForHolidayHours: 0,
      substituteDayOwed: false,
      explanation,
      warnings,
    };
  }

  // Employee worked on the holiday.
  if (!input.holidayOnRegularWorkDay) {
    const premiumPay = roundCent(1.5 * rate * hoursWorked);
    explanation.push(
      `Alberta: the employee worked ${hoursWorked} hour(s) on the holiday, which was not a regular work day for this employee, so the employee is entitled to premium pay at 1.5 × the hourly rate: 1.5 × $${rate.toFixed(2)} × ${hoursWorked} = $${premiumPay.toFixed(2)}.`,
    );
    explanation.push('No average daily wage is payable for this holiday because it did not fall on a regular work day.');
    return {
      eligible: true,
      holidayPay: 0,
      premiumPay,
      regularPayForHolidayHours: 0,
      substituteDayOwed: false,
      explanation,
      warnings,
    };
  }

  const election = input.albertaElection ?? 'premium-plus-adw';

  if (election === 'regular-plus-day-off') {
    const regularPay = roundCent(rate * hoursWorked);
    explanation.push(
      `Alberta: the employee worked ${hoursWorked} hour(s) on the holiday, which fell on a regular work day. The employer elected the "regular pay plus a substitute day off" option, so the hours worked are paid at the regular rate: $${rate.toFixed(2)} × ${hoursWorked} = $${regularPay.toFixed(2)}.`,
    );
    explanation.push(
      `A substitute day off with pay is owed on a later date; the average daily wage of $${adw.toFixed(2)} (5% of $${wages.toFixed(2)} earned in the 4 weeks immediately preceding the holiday week) is paid on that substitute day, not for this holiday — holidayPay is therefore $0 here.`,
    );
    return {
      eligible: true,
      holidayPay: 0,
      premiumPay: 0,
      regularPayForHolidayHours: regularPay,
      substituteDayOwed: true,
      explanation,
      warnings,
    };
  }

  // Default election: premium-plus-adw.
  const premiumPay = roundCent(1.5 * rate * hoursWorked);
  explanation.push(
    `Alberta: average daily wage = 5% of $${wages.toFixed(2)} earned in the 4 weeks immediately preceding the holiday week = $${adw.toFixed(2)}.`,
  );
  explanation.push(
    `The employee worked ${hoursWorked} hour(s) on the holiday, which fell on a regular work day. Under the employer's "premium plus average daily wage" election, the employee is entitled to both the average daily wage and premium pay at 1.5 × the hourly rate for the hours worked: 1.5 × $${rate.toFixed(2)} × ${hoursWorked} = $${premiumPay.toFixed(2)}.`,
  );
  return {
    eligible: true,
    holidayPay: adw,
    premiumPay,
    regularPayForHolidayHours: 0,
    substituteDayOwed: false,
    explanation,
    warnings,
  };
}

function calcOntario(input: StatHolidayInput, hoursWorked: number): StatHolidayResult {
  const explanation: string[] = [];
  const warnings: string[] = [];

  let regularWages = input.regularWagesIn4WorkWeeksBefore;
  if (regularWages === undefined) {
    warnings.push(
      'regularWagesIn4WorkWeeksBefore was not supplied — the 4-work-week regular wage base was defaulted to 0, which reduces public holiday pay. Supply regular wages earned in the 4 work weeks before the holiday week.',
    );
    regularWages = 0;
  }
  let vacationPay = input.vacationPayPayableIn4WorkWeeksBefore;
  if (vacationPay === undefined) {
    warnings.push(
      'vacationPayPayableIn4WorkWeeksBefore was not supplied — vacation pay payable was defaulted to 0, which reduces public holiday pay. Supply vacation pay payable in the 4 work weeks before the holiday week.',
    );
    vacationPay = 0;
  }

  const php = ontarioPublicHolidayPay(regularWages, vacationPay);

  // Ontario "last and first" rule (ESA Part X).
  const failedBefore = input.workedLastScheduledDayBefore === false;
  const failedAfter = input.workedFirstScheduledDayAfter === false;
  if (failedBefore || failedAfter) {
    if (!input.failureHasReasonableCause) {
      const which: string[] = [];
      if (failedBefore) which.push('their last regularly scheduled day/shift before the holiday');
      if (failedAfter) which.push('their first regularly scheduled day/shift after the holiday');
      explanation.push(
        `Ontario: employee is not entitled to public holiday pay under the ESA "last and first" rule — the employee did not work ${which.join(' and ')} and the failure did not have reasonable cause.`,
      );
      explanation.push('No public holiday pay or premium pay is payable for this holiday.');
      return {
        eligible: false,
        holidayPay: 0,
        premiumPay: 0,
        regularPayForHolidayHours: 0,
        substituteDayOwed: false,
        explanation,
        warnings,
      };
    }
    explanation.push(
      'Ontario: the employee did not work a regularly scheduled day/shift required by the "last and first" rule, but the failure had reasonable cause, so the employee remains entitled to public holiday pay.',
    );
  }

  const worked = hoursWorked > 0;
  const rate = input.hourlyRate;

  if (!worked) {
    if (input.holidayOnRegularWorkDay) {
      explanation.push(
        `Ontario: public holiday pay = (regular wages of $${regularWages.toFixed(2)} + vacation pay payable of $${vacationPay.toFixed(2)} earned/payable in the 4 work weeks before the holiday week) / 20 = $${php.toFixed(2)}.`,
      );
      explanation.push(
        'The employee did not work on the holiday and the holiday fell on a day the employee would ordinarily work (or a vacation day), so the employee is entitled to public holiday pay.',
      );
      return {
        eligible: true,
        holidayPay: php,
        premiumPay: 0,
        regularPayForHolidayHours: 0,
        substituteDayOwed: false,
        explanation,
        warnings,
      };
    }
    if (input.ontarioPhpInLieuAgreed) {
      explanation.push(
        `Ontario: public holiday pay = (regular wages of $${regularWages.toFixed(2)} + vacation pay payable of $${vacationPay.toFixed(2)} earned/payable in the 4 work weeks before the holiday week) / 20 = $${php.toFixed(2)}.`,
      );
      explanation.push(
        'The holiday fell on a day the employee does not ordinarily work, but the employee agreed in writing to receive public holiday pay instead of a substitute day off, so public holiday pay is payable for this holiday and no substitute day is owed.',
      );
      return {
        eligible: true,
        holidayPay: php,
        premiumPay: 0,
        regularPayForHolidayHours: 0,
        substituteDayOwed: false,
        explanation,
        warnings,
      };
    }
    explanation.push(
      `Ontario: public holiday pay for this holiday would be (regular wages of $${regularWages.toFixed(2)} + vacation pay payable of $${vacationPay.toFixed(2)}) / 20 = $${php.toFixed(2)}, but the holiday fell on a day the employee does not ordinarily work and was not a vacation day.`,
    );
    explanation.push(
      'A substitute day off is owed on a later date, and public holiday pay is paid on that substitute day — holidayPay is therefore $0 for this holiday.',
    );
    return {
      eligible: true,
      holidayPay: 0,
      premiumPay: 0,
      regularPayForHolidayHours: 0,
      substituteDayOwed: true,
      explanation,
      warnings,
    };
  }

  // Employee worked on the holiday.
  if (input.substituteDayElected) {
    explanation.push(
      `Ontario: the employee worked ${hoursWorked} hour(s) on the holiday and agreed to take a substitute day off instead of public holiday pay plus premium pay. Public holiday pay of $${php.toFixed(2)} is payable on the substitute day, not for this holiday.`,
    );
    explanation.push(
      'No premium pay is payable for the hours worked on this holiday under the substitute-day election; the employee is paid their regular wages for hours actually worked as ordinary pay.',
    );
    return {
      eligible: true,
      holidayPay: 0,
      premiumPay: 0,
      regularPayForHolidayHours: 0,
      substituteDayOwed: true,
      explanation,
      warnings,
    };
  }

  const premiumPay = roundCent(1.5 * rate * hoursWorked);
  explanation.push(
    `Ontario: public holiday pay = (regular wages of $${regularWages.toFixed(2)} + vacation pay payable of $${vacationPay.toFixed(2)} earned/payable in the 4 work weeks before the holiday week) / 20 = $${php.toFixed(2)}.`,
  );
  explanation.push(
    `The employee worked ${hoursWorked} hour(s) on the holiday, so in addition to public holiday pay the employee is entitled to premium pay at 1.5 × the hourly rate for the hours worked: 1.5 × $${rate.toFixed(2)} × ${hoursWorked} = $${premiumPay.toFixed(2)}.`,
  );
  return {
    eligible: true,
    holidayPay: php,
    premiumPay,
    regularPayForHolidayHours: 0,
    substituteDayOwed: false,
    explanation,
    warnings,
  };
}
