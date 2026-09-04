/**
 * Pay-frequency conversion.
 *
 * These are presentational divisions of an annual figure. Real payroll withholds
 * period by period and can differ by small amounts, which is why any result
 * derived through this module is labelled an annualised estimate.
 */
import { type Money, money, roundToMinorUnit } from './money.ts';
import type { PayFrequency } from './types.ts';

/** Periods per year for each frequency. Fortnightly and biweekly are both 26. */
export const PERIODS_PER_YEAR: Record<Exclude<PayFrequency, 'hourly'>, number> = {
  annual: 1,
  monthly: 12,
  fortnightly: 26,
  biweekly: 26,
  weekly: 52,
};

export const DEFAULT_HOURS_PER_WEEK = 37.5;
export const DEFAULT_WEEKS_PER_YEAR = 52;

export function perPeriod(annual: Money, frequency: Exclude<PayFrequency, 'hourly'>): Money {
  return roundToMinorUnit(annual.div(PERIODS_PER_YEAR[frequency]));
}

export function perHour(annual: Money, hoursPerWeek: number, weeksPerYear: number): Money {
  const hours = money(hoursPerWeek).times(weeksPerYear);
  if (hours.lte(0)) return money(0);
  return roundToMinorUnit(annual.div(hours));
}

/**
 * Convert an amount stated at some frequency into an annual figure.
 * Hourly requires hours and weeks; the caller must supply them.
 */
export function annualiseFrom(
  amount: Money,
  frequency: PayFrequency,
  hoursPerWeek = DEFAULT_HOURS_PER_WEEK,
  weeksPerYear = DEFAULT_WEEKS_PER_YEAR,
): Money {
  if (frequency === 'hourly') {
    return amount.times(money(hoursPerWeek).times(weeksPerYear));
  }
  return amount.times(PERIODS_PER_YEAR[frequency]);
}

export const FREQUENCY_LABELS: Record<PayFrequency, string> = {
  annual: 'Yearly',
  monthly: 'Monthly',
  fortnightly: 'Fortnightly',
  biweekly: 'Bi-weekly',
  weekly: 'Weekly',
  hourly: 'Hourly',
};

/** Frequencies each market ordinarily displays, in the order they expect them. */
export const JURISDICTION_FREQUENCIES: Record<string, readonly PayFrequency[]> = {
  uk: ['annual', 'monthly', 'weekly'],
  ireland: ['annual', 'monthly', 'weekly'],
  australia: ['annual', 'monthly', 'fortnightly', 'weekly'],
  canada: ['annual', 'monthly', 'biweekly', 'weekly'],
};
