/**
 * Australia salary calculation.
 *
 * Superannuation is deliberately absent from the deduction list: the
 * superannuation guarantee is an employer cost paid on top of salary, so
 * subtracting it from take-home pay would understate every result.
 */
import { runSalaryCalculation } from '../common/engine.ts';
import { buildAustraliaOptions } from './options.ts';
import type { CalculationInput, CalculationResult } from '../common/types.ts';
import { findRuleset } from '../../../data/jurisdictions/index.ts';

export function calculateAustraliaSalary(input: CalculationInput): CalculationResult {
  const ruleset = findRuleset('australia');
  if (!ruleset) throw new Error('No Australia ruleset is registered.');
  return runSalaryCalculation(buildAustraliaOptions(ruleset, input));
}

export { buildAustraliaOptions } from './options.ts';
