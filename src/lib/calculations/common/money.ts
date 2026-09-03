/**
 * Deterministic decimal money layer.
 *
 * Binary floating point is never used for a tax total anywhere in this codebase.
 * `0.1 + 0.2 !== 0.3` is a rounding curiosity in most software and a wrong
 * take-home figure here, so every monetary value is a decimal from the moment it
 * enters the system until it is formatted for display.
 */
import Big from 'big.js';

export type Money = Big;
export type Rate = Big;

/** Enough precision that repeated division (e.g. 52-week splits) never drifts. */
Big.DP = 20;
Big.RM = Big.roundHalfUp;

/** Rounding behaviour, named for the tax context that requires it. */
export const Rounding = {
  /** Round half up. The ordinary default for presenting money. */
  HALF_UP: 1,
  /** Round half to even (banker's rounding). */
  HALF_EVEN: 2,
  /** Truncate toward zero. Several authorities round tax *down* to the pound. */
  DOWN: 0,
  /** Round away from zero. */
  UP: 3,
} as const;

export type RoundingMode = (typeof Rounding)[keyof typeof Rounding];

export function money(value: Big.BigSource): Money {
  return new Big(value);
}

export const ZERO: Money = money(0);

export function isMoney(value: unknown): value is Money {
  return value instanceof Big;
}

/** Sum a list, returning zero for an empty list rather than throwing. */
export function sum(values: readonly Money[]): Money {
  return values.reduce<Money>((total, value) => total.plus(value), money(0));
}

/** Never below zero. Used wherever a deduction cannot create negative income. */
export function clampAtZero(value: Money): Money {
  return value.lt(0) ? money(0) : value;
}

/** Constrain to [min, max]. */
export function clamp(value: Money, min: Money, max: Money): Money {
  if (value.lt(min)) return min;
  if (value.gt(max)) return max;
  return value;
}

export function minOf(a: Money, b: Money): Money {
  return a.lt(b) ? a : b;
}

export function maxOf(a: Money, b: Money): Money {
  return a.gt(b) ? a : b;
}

/**
 * Round to whole currency units (pounds/euros/dollars).
 * Several authorities round particular steps down; pass `Rounding.DOWN` there.
 */
export function roundToUnit(value: Money, mode: RoundingMode = Rounding.HALF_UP): Money {
  return value.round(0, mode);
}

/** Round to minor units (pence/cents). The default for anything displayed. */
export function roundToMinorUnit(value: Money, mode: RoundingMode = Rounding.HALF_UP): Money {
  return value.round(2, mode);
}

/**
 * Round down to a whole multiple of `step`.
 * Used for contribution schemes assessed in fixed bands rather than exactly.
 */
export function floorToMultiple(value: Money, step: Money): Money {
  if (step.lte(0)) throw new Error('floorToMultiple: step must be positive');
  return value.div(step).round(0, Rounding.DOWN).times(step);
}

/** Percentage helper: `percentOf(50000, 20)` is 10000. */
export function percentOf(value: Money, percent: Big.BigSource): Money {
  return value.times(money(percent)).div(100);
}

/** Convert a percentage (e.g. 20) into a rate fraction (0.2). */
export function percentToRate(percent: Big.BigSource): Rate {
  return money(percent).div(100);
}

/** Convert a rate fraction (0.2) into a percentage (20). */
export function rateToPercent(rate: Rate): Big {
  return rate.times(100);
}

/**
 * Safe ratio. Returns zero when the denominator is zero, because an average
 * deduction rate on zero income is meaningfully "no deductions", not an error.
 */
export function safeRatio(numerator: Money, denominator: Money): Rate {
  if (denominator.eq(0)) return money(0);
  return numerator.div(denominator);
}

/** Plain-number escape hatch. Only for display, charting, and JSON payloads. */
export function toNumber(value: Money): number {
  return Number(value.toString());
}

/** Fixed-precision string, for serialising into static HTML without drift. */
export function toFixed(value: Money, dp = 2): string {
  return value.toFixed(dp);
}

export { Big };
