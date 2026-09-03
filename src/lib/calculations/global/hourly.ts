/**
 * Hourly-to-salary conversion.
 *
 * Deliberately tax-free: it converts a rate of pay between frequencies and says
 * so plainly. Mixing an untaxed conversion with a taxed one on the same page is
 * the single most common way these calculators mislead people, so this module
 * produces gross figures only and the page links to the country calculators for
 * take-home pay.
 */
import { type Money, money, ZERO, roundToMinorUnit } from '../common/money.ts';
import { PERIODS_PER_YEAR } from '../common/frequency.ts';
import type { CurrencyCode, PayFrequency } from '../common/types.ts';

export interface HourlyInput {
  readonly amount: Money;
  readonly inputFrequency: PayFrequency;
  readonly hoursPerWeek: number;
  readonly weeksPerYear: number;
  readonly currency: CurrencyCode;
  /** Paid holiday already included in the stated weeks, or taken unpaid. */
  readonly includesPaidHoliday?: boolean;
}

export interface HourlyResult {
  readonly hourly: Money;
  readonly daily: Money;
  readonly weekly: Money;
  readonly fortnightly: Money;
  readonly monthly: Money;
  readonly annual: Money;
  readonly totalHoursPerYear: Money;
  readonly currency: CurrencyCode;
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
}

export const HOURLY_ASSUMPTIONS: readonly string[] = [
  'These are gross figures before any tax, national insurance, or social contributions.',
  'Every week is assumed to have the same number of paid hours.',
  'Overtime, shift premiums, bonuses, and unsocial-hours rates are excluded.',
  'A working day is treated as the weekly hours divided by five.',
];

export function convertHourly(input: HourlyInput): HourlyResult {
  const warnings: string[] = [];

  const hoursPerWeek = Number.isFinite(input.hoursPerWeek) ? input.hoursPerWeek : 0;
  const weeksPerYear = Number.isFinite(input.weeksPerYear) ? input.weeksPerYear : 0;

  if (hoursPerWeek <= 0 || weeksPerYear <= 0) {
    return {
      hourly: ZERO,
      daily: ZERO,
      weekly: ZERO,
      fortnightly: ZERO,
      monthly: ZERO,
      annual: ZERO,
      totalHoursPerYear: ZERO,
      currency: input.currency,
      assumptions: HOURLY_ASSUMPTIONS,
      warnings: ['Enter hours per week and weeks per year above zero.'],
    };
  }

  if (hoursPerWeek > 80) {
    warnings.push('More than 80 hours a week is unusual and may exceed working-time limits.');
  }
  if (weeksPerYear > 52) {
    warnings.push(
      'A year has at most 52 weeks, so this figure has been used as entered but is unlikely to be right.',
    );
  }

  const totalHoursPerYear = money(hoursPerWeek).times(weeksPerYear);

  // Everything is derived from one annual figure so the conversions stay consistent.
  let annual: Money;
  switch (input.inputFrequency) {
    case 'hourly':
      annual = input.amount.times(totalHoursPerYear);
      break;
    case 'annual':
      annual = input.amount;
      break;
    default:
      annual = input.amount.times(PERIODS_PER_YEAR[input.inputFrequency]);
      break;
  }

  const weekly = annual.div(weeksPerYear);

  return {
    hourly: roundToMinorUnit(annual.div(totalHoursPerYear)),
    daily: roundToMinorUnit(weekly.div(5)),
    weekly: roundToMinorUnit(weekly),
    fortnightly: roundToMinorUnit(annual.div(PERIODS_PER_YEAR.fortnightly)),
    monthly: roundToMinorUnit(annual.div(PERIODS_PER_YEAR.monthly)),
    annual: roundToMinorUnit(annual),
    totalHoursPerYear,
    currency: input.currency,
    assumptions:
      input.includesPaidHoliday === false
        ? [
            ...HOURLY_ASSUMPTIONS,
            'Paid holiday is excluded, so the annual figure reflects worked weeks only.',
          ]
        : HOURLY_ASSUMPTIONS,
    warnings,
  };
}
