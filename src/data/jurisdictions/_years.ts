/**
 * Tax-year helpers.
 *
 * A jurisdiction is defined once as a table of years rather than as one file
 * per year. Adding next year's rates is then a single reviewed entry at the top
 * of a list, which is exactly the shape the annual update needs — and it makes
 * a year-on-year diff readable, so a threshold that moved is obvious.
 */
import type { Ruleset } from '../../lib/validation/ruleset-schema.ts';

/** Which tax year is the live one, derived from the dates rather than a flag. */
export function isCurrentPeriod(ruleset: Ruleset, asOf: Date = new Date()): boolean {
  const start = new Date(`${ruleset.taxPeriod.startDate}T00:00:00Z`);
  const end = new Date(`${ruleset.taxPeriod.endDate}T23:59:59Z`);
  return asOf >= start && asOf <= end;
}

/** Newest first, which is the order a reader expects in a year selector. */
export function byPeriodDescending(a: Ruleset, b: Ruleset): number {
  return b.taxPeriod.startDate.localeCompare(a.taxPeriod.startDate);
}

/**
 * The year a calculator should open on.
 *
 * The current one where it exists, otherwise the most recent — a reader landing
 * mid-way through an unmodelled year should get the latest rules we have, not
 * an empty selector.
 */
export function defaultPeriod(
  rulesets: readonly Ruleset[],
  asOf: Date = new Date(),
): string | null {
  if (rulesets.length === 0) return null;
  const current = rulesets.find((ruleset) => isCurrentPeriod(ruleset, asOf));
  const sorted = [...rulesets].sort(byPeriodDescending);
  return (current ?? sorted[0])?.taxPeriod.label ?? null;
}

/** How confident we are in a year's figures, recorded per year rather than per market. */
export type YearConfidence = 'settled' | 'likely' | 'uncertain';

export const CONFIDENCE_NOTE: Record<YearConfidence, string> = {
  settled:
    'A completed tax year, so the rules are fixed and no longer subject to change. Still not ' +
    'checked against the official source.',
  likely:
    'A recent year whose rules are unlikely to have moved since, but which has not been checked ' +
    'against the official source.',
  uncertain:
    'The figures here are the least certain on the site. Thresholds are usually indexed at the ' +
    'start of a tax year and this one may already have moved.',
};
