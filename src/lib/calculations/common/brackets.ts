/**
 * Progressive band arithmetic, shared by every jurisdiction.
 *
 * Bands are data supplied by a ruleset. Nothing in this file knows the value of
 * any rate or threshold, which is what allows a single tested implementation to
 * serve five tax systems.
 */
import { type Money, money, ZERO, clampAtZero, maxOf, minOf, percentOf, sum } from './money.ts';
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

export interface BandValidationOptions {
  /**
   * Whether the highest band must be unbounded above.
   *
   * True for income tax, where income has no ceiling. False for a contribution
   * that stops at a maximum earnings figure — CPP and Employment Insurance both
   * end at a bounded band, and that ceiling is the point of them.
   */
  readonly requireUnboundedTop?: boolean;
}

/**
 * Validate that bands are contiguous, ascending, and non-overlapping.
 * A ruleset that fails this cannot be published; the audit surfaces it.
 */
export function validateBands(
  bands: readonly Band[],
  options: BandValidationOptions = {},
): string[] {
  const requireUnboundedTop = options.requireUnboundedTop ?? true;
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
  if (requireUnboundedTop && last && last.to !== null) {
    problems.push(`highest band "${last.label}" must be unbounded above`);
  }

  return problems;
}

/**
 * Withdraw an allowance above a threshold, at `withdrawnPerUnit` of allowance
 * per unit of excess income. The UK personal-allowance taper is 1 per 2, i.e.
 * `withdrawnPerUnit` of 0.5.
 *
 * `floorAmount` is where the taper stops. The UK allowance tapers to nothing;
 * Canada's federal basic personal amount tapers down to a minimum and stays
 * there, so a taper that always ends at zero would overstate tax at high
 * Canadian incomes.
 */
export function taperAllowance(
  allowance: Money,
  income: Money,
  threshold: Money,
  withdrawnPerUnit: Money,
  floorAmount: Money = ZERO,
): Money {
  if (income.lte(threshold)) return allowance;
  const excess = income.minus(threshold);
  const withdrawn = excess.times(withdrawnPerUnit);
  return maxOf(clampAtZero(allowance.minus(withdrawn)), clampAtZero(floorAmount));
}

/**
 * A levy charged alongside income tax, in the shape real levies actually take.
 *
 * Three regimes, in order:
 *  - at or below `exemptBelow`, nothing is charged;
 *  - inside the shade-in band, a higher rate applies to the excess only;
 *  - above it, the ordinary rate applies to the basis, which for several
 *    systems is the whole of income rather than the part above a threshold.
 */
export function levyAmount(input: {
  readonly income: Money;
  readonly ratePercent: Money;
  readonly basis: 'above-floor' | 'whole-income';
  readonly floor: Money;
  readonly ceiling: Money | null;
  readonly exemptBelow: Money;
  readonly phaseInTo: Money | null;
  readonly phaseInRatePercent: Money | null;
}): Money {
  const { income, exemptBelow, phaseInTo, phaseInRatePercent } = input;

  if (income.lte(exemptBelow)) return ZERO;

  if (phaseInTo !== null && phaseInRatePercent !== null && income.lt(phaseInTo)) {
    return percentOf(income.minus(exemptBelow), phaseInRatePercent);
  }

  const capped = input.ceiling === null ? income : minOf(income, input.ceiling);
  const base = input.basis === 'whole-income' ? capped : clampAtZero(capped.minus(input.floor));

  return percentOf(base, input.ratePercent);
}

/**
 * Apply surtax bands to an amount of tax already due.
 *
 * The bands are measured in units of tax, not units of income, which is the
 * whole point: a surtax is a charge on a tax bill.
 */
export function applySurtax(taxDue: Money, bands: readonly Band[]): BandApplication {
  return applyBands(taxDue, bands);
}

/**
 * An income-contingent loan repayment.
 *
 * The three methods are different arithmetic and are not interchangeable.
 *
 * - `rate-above-threshold` charges one rate on the income above a threshold.
 *   UK student loans work this way, and the repayment never steps.
 * - `banded-rate-on-total` picks a rate from a band and applies it to the
 *   *whole* of income, so crossing a boundary steps the repayment up sharply.
 *   Australia's HELP worked this way until 30 June 2025.
 * - `marginal-bands` charges each band's rate on the slice of income inside
 *   it, above a threshold — the same shape as progressive income tax.
 *   Australia's HELP moved to this from 1 July 2025.
 *
 * The last two are the pair most easily confused, and confusing them is silent:
 * at A$100,000 the difference between them is thousands of dollars a year.
 */
export function loanRepaymentAmount(input: {
  readonly income: Money;
  readonly method: 'rate-above-threshold' | 'banded-rate-on-total' | 'marginal-bands';
  readonly threshold: Money;
  readonly ratePercent: Money;
  readonly bands: readonly Band[];
}): Money {
  if (input.method === 'rate-above-threshold') {
    return percentOf(clampAtZero(input.income.minus(input.threshold)), input.ratePercent);
  }

  if (input.method === 'marginal-bands') {
    // Bands are measured from the threshold, so a band running 0 to 58,000
    // means the first 58,000 of income *above* the threshold.
    return applyBands(clampAtZero(input.income.minus(input.threshold)), input.bands).total;
  }

  const rate = marginalBandRatePercent(input.income, input.bands);
  return percentOf(input.income, rate);
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
