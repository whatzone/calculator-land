/**
 * Progressive band arithmetic, shared by every jurisdiction.
 *
 * Bands are data supplied by a ruleset. Nothing in this file knows the value of
 * any rate or threshold, which is what allows a single tested implementation to
 * serve five tax systems.
 */
import { type Money, money, ZERO, clampAtZero, minOf, percentOf, sum } from './money.ts';
import type { DeductionWorking } from './types.ts';

export interface Band {
  readonly label: string;
  /** Inclusive lower edge of the band, expressed in annual currency units. */
  readonly from: Money;
  /** Exclusive upper edge. `null` means the band is unbounded above. */
  readonly to: Money | null;
  readonly ratePercent: Money;
}

export interface BandInput {
  readonly label: string;
  readonly from: number | string;
  readonly to: number | string | null;
  readonly ratePercent: number | string;
}

export function toBands(inputs: readonly BandInput[]): Band[] {
  return inputs.map((input) => ({
    label: input.label,
    from: money(input.from),
    to: input.to === null ? null : money(input.to),
    ratePercent: money(input.ratePercent),
  }));
}

export interface BandApplication {
  readonly total: Money;
  readonly workings: readonly DeductionWorking[];
}

/**
 * Apply progressive bands to an amount.
 *
 * Only the slice of income that falls inside each band is taxed at that band's
 * rate — the common misunderstanding this whole product exists to correct.
 */
export function applyBands(amount: Money, bands: readonly Band[]): BandApplication {
  const workings: DeductionWorking[] = [];
  const taxable = clampAtZero(amount);

  for (const band of bands) {
    if (taxable.lte(band.from)) continue;

    const upperEdge = band.to === null ? taxable : minOf(taxable, band.to);
    const amountInBand = clampAtZero(upperEdge.minus(band.from));
    if (amountInBand.lte(0)) continue;

    const tax = percentOf(amountInBand, band.ratePercent);
    workings.push({
      label: band.label,
      amountTaxed: amountInBand,
      ratePercent: band.ratePercent,
      tax,
    });
  }

  return { total: sum(workings.map((working) => working.tax)), workings };
}

/** The marginal band rate that applies to the next unit of income. */
export function marginalBandRatePercent(amount: Money, bands: readonly Band[]): Money {
  let rate = ZERO;
  for (const band of bands) {
    if (amount.gte(band.from) && (band.to === null || amount.lt(band.to))) {
      rate = band.ratePercent;
    }
  }
  return rate;
}

/**
 * Validate that bands are contiguous, ascending, and non-overlapping.
 * A ruleset that fails this cannot be published; the audit surfaces it.
 */
export function validateBands(bands: readonly Band[]): string[] {
  const problems: string[] = [];
  if (bands.length === 0) return ['no bands defined'];

  const first = bands[0];
  if (first && first.from.lt(0)) problems.push('first band starts below zero');

  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    if (!band) continue;

    if (band.to !== null && band.to.lte(band.from)) {
      problems.push(`band "${band.label}" ends at or before it starts`);
    }
    if (band.ratePercent.lt(0) || band.ratePercent.gt(100)) {
      problems.push(`band "${band.label}" has an implausible rate ${band.ratePercent.toString()}%`);
    }

    const next = bands[index + 1];
    if (!next) continue;
    if (band.to === null) {
      problems.push(`band "${band.label}" is unbounded but is not the last band`);
      continue;
    }
    if (!band.to.eq(next.from)) {
      problems.push(`gap or overlap between "${band.label}" and "${next.label}"`);
    }
  }

  const last = bands[bands.length - 1];
  if (last && last.to !== null) {
    problems.push(`highest band "${last.label}" must be unbounded above`);
  }

  return problems;
}

/**
 * Withdraw an allowance above a threshold, at `withdrawnPerUnit` of allowance
 * per unit of excess income. The UK personal-allowance taper is 1 per 2, i.e.
 * `withdrawnPerUnit` of 0.5.
 */
export function taperAllowance(
  allowance: Money,
  income: Money,
  threshold: Money,
  withdrawnPerUnit: Money,
): Money {
  if (income.lte(threshold)) return allowance;
  const excess = income.minus(threshold);
  const withdrawn = excess.times(withdrawnPerUnit);
  return clampAtZero(allowance.minus(withdrawn));
}

/** Apply a flat rate above a floor, optionally capped at a ceiling of income. */
export function levyOnRange(
  income: Money,
  ratePercent: Money,
  floor: Money,
  ceiling: Money | null,
): Money {
  const upper = ceiling === null ? income : minOf(income, ceiling);
  const chargeable = clampAtZero(upper.minus(floor));
  return percentOf(chargeable, ratePercent);
}
