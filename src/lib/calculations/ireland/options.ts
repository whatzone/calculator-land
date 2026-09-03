/** Irish profile handling. Registry-free; see ../uk/options.ts for why. */
import { money } from '../common/money.ts';
import type { EngineOptions, PreTaxContribution } from '../common/engine.ts';
import { clampPercent, readNumber, readString } from '../common/profile.ts';
import type { CalculationInput, ResultNotice } from '../common/types.ts';
import type { Ruleset } from '../../validation/ruleset-schema.ts';

export const IE_CIVIL_STATUSES = ['single', 'married-one-income', 'married-two-incomes'] as const;

/**
 * Married and civil-partnership treatment changes both the standard-rate band
 * and the available credits. Showing a single person's figures for a couple
 * would be materially wrong, so it is refused rather than approximated.
 */
export function irelandUnsupportedReasons(input: CalculationInput): string[] {
  return readString(input, 'civilStatus', 'single') === 'single'
    ? []
    : [
        'Only the single, no-dependants profile is supported. Married and civil-partnership treatment changes both the standard-rate band and the available credits, and showing a single person’s figures for a couple would be materially wrong.',
      ];
}

export function buildIrelandOptions(ruleset: Ruleset, input: CalculationInput): EngineOptions {
  const notices: ResultNotice[] = [];
  const preTaxContributions: PreTaxContribution[] = [];

  const pensionPercent = clampPercent(readNumber(input, 'pensionPercent', 0));
  if (pensionPercent > 0) {
    preTaxContributions.push({
      id: 'ie-pension',
      label: `Pension contribution (${pensionPercent}%)`,
      annualAmount: money(input.grossAnnualIncome).times(pensionPercent).div(100),
      explanation:
        'Contributions attract Income Tax relief at the marginal rate but do not reduce USC or PRSI, both of which are charged on gross pay.',
      sourceIds: ruleset.sources.map((source) => source.id),
      reducesContributionBase: false,
    });
  }

  return { ruleset, input, preTaxContributions, extraNotices: notices };
}
