/**
 * Ireland salary calculation.
 *
 * Income tax, USC, and PRSI are three separate charges on three different bases
 * and are shown as three separate deduction lines.
 */
import { runSalaryCalculation, unsupportedResult } from '../common/engine.ts';
import { buildIrelandOptions, irelandUnsupportedReasons } from './options.ts';
import type { CalculationInput, CalculationResult } from '../common/types.ts';
import { findRuleset } from '../../../data/jurisdictions/index.ts';

export function calculateIrelandSalary(input: CalculationInput): CalculationResult {
  const ruleset = findRuleset('ireland', null, input.taxPeriod);
  if (!ruleset) {
    const fallback = findRuleset('ireland');
    if (!fallback) throw new Error('No Ireland ruleset is registered.');
    return unsupportedResult(fallback, input, [
      `No rules are held for Ireland for the ${input.taxPeriod} tax year. One tax year's rules may never stand in for another's.`,
    ]);
  }

  const unsupported = irelandUnsupportedReasons(input);
  if (unsupported.length > 0) return unsupportedResult(ruleset, input, unsupported);

  return runSalaryCalculation(buildIrelandOptions(ruleset, input));
}

export { buildIrelandOptions, irelandUnsupportedReasons, IE_CIVIL_STATUSES } from './options.ts';
