/**
 * New Zealand salary calculation.
 *
 * KiwiSaver employee contributions come out of pay after tax, so they are
 * modelled as a post-tax deduction line rather than as a pre-tax contribution.
 */
import { runSalaryCalculation } from '../common/engine.ts';
import { buildNewZealandOptions } from './options.ts';
import type { CalculationInput, CalculationResult } from '../common/types.ts';
import { findRuleset } from '../../../data/jurisdictions/index.ts';

export function calculateNewZealandSalary(input: CalculationInput): CalculationResult {
  const ruleset = findRuleset('new-zealand');
  if (!ruleset) throw new Error('No New Zealand ruleset is registered.');
  return runSalaryCalculation(buildNewZealandOptions(ruleset, input));
}

export { buildNewZealandOptions, NZ_KIWISAVER_RATES } from './options.ts';
