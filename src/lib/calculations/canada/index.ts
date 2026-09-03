/**
 * Canada salary calculation.
 *
 * Federal and provincial tax are composed rather than merged: the federal
 * ruleset is passed to the engine as a composed layer alongside the province's
 * own ruleset, so each appears as its own deduction line and each can be
 * published independently once its tests pass.
 */
import { runSalaryCalculation, unsupportedResult } from '../common/engine.ts';
import { buildCanadaOptions } from './options.ts';
import { readString } from '../common/profile.ts';
import type { CalculationInput, CalculationResult } from '../common/types.ts';
import { findRuleset, getRulesetById } from '../../../data/jurisdictions/index.ts';

export function calculateCanadaSalary(input: CalculationInput): CalculationResult {
  const province = (input.subJurisdiction ?? readString(input, 'province', 'ontario')) as string;
  const provincialRuleset = findRuleset('canada', province);
  const federalRuleset = getRulesetById('canada-federal-2026');

  if (!federalRuleset) throw new Error('The Canadian federal ruleset is not registered.');

  if (!provincialRuleset) {
    return unsupportedResult(federalRuleset, input, [
      `No ruleset exists for the province or territory "${province}". Provincial tax varies enough that no other province's rules may be substituted.`,
    ]);
  }

  return runSalaryCalculation(
    buildCanadaOptions(provincialRuleset, federalRuleset, input, province),
  );
}

export { buildCanadaOptions, CA_LAUNCH_PROVINCES } from './options.ts';
export type { CaProvince } from './options.ts';
