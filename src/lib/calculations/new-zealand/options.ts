/** New Zealand profile handling. Registry-free; see ../uk/options.ts for why. */
import { money, percentOf, roundToMinorUnit } from '../common/money.ts';
import type { EngineOptions, ExtraDeduction } from '../common/engine.ts';
import { clampPercent, readBoolean, readNumber, resolveLoanScheme } from '../common/profile.ts';
import type { CalculationInput, ResultNotice } from '../common/types.ts';
import type { Ruleset } from '../../validation/ruleset-schema.ts';

export const NZ_KIWISAVER_RATES = [0, 3, 4, 6, 8, 10] as const;

export function buildNewZealandOptions(ruleset: Ruleset, input: CalculationInput): EngineOptions {
  const notices: ResultNotice[] = [];
  const extraDeductions: ExtraDeduction[] = [];

  const kiwiSaverPercent = clampPercent(readNumber(input, 'kiwiSaverPercent', 0), 10);
  if (kiwiSaverPercent > 0) {
    if (!NZ_KIWISAVER_RATES.includes(kiwiSaverPercent as (typeof NZ_KIWISAVER_RATES)[number])) {
      notices.push({
        severity: 'warning',
        message: `${kiwiSaverPercent}% is not one of the standard KiwiSaver employee contribution rates. The figure has still been applied as entered.`,
      });
    }
    extraDeductions.push({
      includeInMarginal: true,
      line: {
        id: 'nz-kiwisaver',
        label: `KiwiSaver employee contribution (${kiwiSaverPercent}%)`,
        annualAmount: roundToMinorUnit(percentOf(money(input.grossAnnualIncome), kiwiSaverPercent)),
        explanation:
          'KiwiSaver employee contributions are deducted from pay after PAYE has been calculated, so they reduce take-home pay without reducing tax.',
        sourceIds: ruleset.sources.map((source) => source.id),
      },
    });
  }

  const loanSelectors: string[] = [];
  if (readBoolean(input, 'hasStudentLoan', false)) {
    const scheme = resolveLoanScheme(ruleset, 'student-loan', 'A student loan');
    if (scheme.ok) loanSelectors.push(scheme.selector);
    else notices.push(scheme.notice);
  }

  return { ruleset, input, extraDeductions, loanSelectors, extraNotices: notices };
}
