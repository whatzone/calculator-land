/**
 * Marginal and average deduction rates.
 *
 * Marginal rate is measured, not looked up. Reading a headline band rate would
 * be wrong wherever an allowance taper, a levy floor, or a contribution cap
 * makes the true marginal rate diverge from the statutory band — which is
 * precisely where users are most confused and most in need of a correct answer.
 */
import { type Money, type Rate, money, safeRatio } from './money.ts';

/** The probe used to measure marginal rate. Small enough not to skip a band. */
export const MARGINAL_DELTA = money(100);

export interface MarginalMeasurement {
  readonly rate: Rate;
  readonly delta: Money;
  readonly extraDeductions: Money;
}

/**
 * Measure the marginal deduction rate by re-running the calculation at
 * `gross + delta` and comparing total deductions.
 */
export function measureMarginalRate(
  gross: Money,
  totalDeductionsAt: (gross: Money) => Money,
  delta: Money = MARGINAL_DELTA,
): MarginalMeasurement {
  const base = totalDeductionsAt(gross);
  const raised = totalDeductionsAt(gross.plus(delta));
  const extraDeductions = raised.minus(base);
  return { rate: safeRatio(extraDeductions, delta), delta, extraDeductions };
}

export function averageDeductionRate(totalDeductions: Money, gross: Money): Rate {
  return safeRatio(totalDeductions, gross);
}

/**
 * The locally sensible increment for "how much of a pay rise would you keep".
 * A round number in the local currency reads better than an arbitrary probe.
 */
export const NEXT_INCREMENT_BY_JURISDICTION: Record<string, number> = {
  uk: 1000,
  ireland: 1000,
  australia: 1000,
  'new-zealand': 1000,
  canada: 1000,
};

export function nextIncrementFor(jurisdiction: string): Money {
  return money(NEXT_INCREMENT_BY_JURISDICTION[jurisdiction] ?? 1000);
}
