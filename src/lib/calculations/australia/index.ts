/**
 * Australia salary calculation.
 *
 * Superannuation is deliberately absent from the deduction list: the
 * superannuation guarantee is an employer cost paid on top of salary, so
 * subtracting it from take-home pay would understate every result.
 */
import { runSalaryCalculation, unsupportedResult } from '../common/engine.ts';
import { buildAustraliaOptions } from './options.ts';
import type { CalculationInput, CalculationResult } from '../common/types.ts';
import { findRuleset } from '../../../data/jurisdictions/index.ts';

export function calculateAustraliaSalary(input: CalculationInput): CalculationResult {
  const ruleset = findRuleset('australia', null, input.taxPeriod);
  if (!ruleset) {
    const fallback = findRuleset('australia');
    if (!fallback) throw new Error('No Australia ruleset is registered.');
    return unsupportedResult(fallback, input, [
      `No rules are held for Australia for the ${input.taxPeriod} tax year. One tax year's rules may never stand in for another's.`,
    ]);
  }
  return runSalaryCalculation(buildAustraliaOptions(ruleset, input));
}

export { buildAustraliaOptions } from './options.ts';
