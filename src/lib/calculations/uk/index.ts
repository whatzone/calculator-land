/**
 * United Kingdom salary calculation.
 *
 * Scotland is selected by choosing a different ruleset, not by branching in
 * code, because Scottish income tax has a different band *structure* rather
 * than different numbers in a shared structure.
 */
import { runSalaryCalculation, unsupportedResult } from '../common/engine.ts';
import { buildUkOptions, type UkRegion } from './options.ts';
import type { CalculationInput, CalculationResult } from '../common/types.ts';
import { findRuleset } from '../../../data/jurisdictions/index.ts';

export function calculateUkSalary(input: CalculationInput): CalculationResult {
  const region = (input.subJurisdiction ?? 'england-wales-ni') as UkRegion;
  const ruleset = findRuleset('uk', region, input.taxPeriod);

  if (!ruleset) {
    const fallback = findRuleset('uk', region) ?? findRuleset('uk');
    if (!fallback) throw new Error('No UK ruleset is registered.');
    return unsupportedResult(fallback, input, [
      `No rules are held for ${region === 'scotland' ? 'Scotland' : 'the UK'} for the ${input.taxPeriod} tax year. Scottish and rest-of-UK rules are held separately, and one tax year's rules may never stand in for another's.`,
    ]);
  }

  return runSalaryCalculation(buildUkOptions(ruleset, input));
}

export { buildUkOptions, UK_REGIONS, UK_STUDENT_LOAN_PLANS } from './options.ts';
export type { UkRegion } from './options.ts';
