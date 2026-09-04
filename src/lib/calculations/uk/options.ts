/**
 * UK profile handling, with no dependency on the ruleset registry.
 *
 * This file is imported by the browser bundle. It must stay free of anything
 * that reaches the registry, because that would pull Zod and every ruleset
 * module into the client — measured at 42 KB gzipped, most of the JS budget for
 * a page, spent on validation the build has already done.
 */
import { money } from '../common/money.ts';
import type { EngineOptions, PreTaxContribution } from '../common/engine.ts';
import {
  clampPercent,
  readBoolean,
  readNumber,
  readString,
  resolveLoanScheme,
} from '../common/profile.ts';
import type { CalculationInput, ResultNotice } from '../common/types.ts';
import type { Ruleset } from '../../validation/ruleset-schema.ts';

export const UK_REGIONS = ['england-wales-ni', 'scotland'] as const;
export type UkRegion = (typeof UK_REGIONS)[number];

export const UK_STUDENT_LOAN_PLANS = ['none', 'plan-1', 'plan-2', 'plan-4', 'plan-5'] as const;

const PLAN_LABELS: Record<string, string> = {
  'plan-1': 'Plan 1 student loan',
  'plan-2': 'Plan 2 student loan',
  'plan-4': 'Plan 4 student loan',
  'plan-5': 'Plan 5 student loan',
};

/** Translate the user's profile choices into engine options. */
export function buildUkOptions(ruleset: Ruleset, input: CalculationInput): EngineOptions {
  const region = (input.subJurisdiction ?? 'england-wales-ni') as UkRegion;
  const notices: ResultNotice[] = [];
  const preTaxContributions: PreTaxContribution[] = [];

  const pensionPercent = clampPercent(readNumber(input, 'pensionPercent', 0));
  if (pensionPercent > 0) {
    const treatment = readString(input, 'pensionTreatment', 'net-pay');
    preTaxContributions.push({
      id: 'uk-pension',
      label: `Pension contribution (${pensionPercent}%)`,
      annualAmount: money(input.grossAnnualIncome).times(pensionPercent).div(100),
      explanation:
        treatment === 'salary-sacrifice'
          ? 'Treated as salary sacrifice: the contribution reduces gross pay before both Income Tax and National Insurance are calculated.'
          : 'Treated as a net-pay arrangement: the contribution reduces pay before Income Tax, but National Insurance is still charged on the full amount.',
      sourceIds: ruleset.sources.map((source) => source.id),
      reducesContributionBase: treatment === 'salary-sacrifice',
    });
    if (treatment !== 'salary-sacrifice' && treatment !== 'net-pay') {
      notices.push({
        severity: 'warning',
        message: `Unrecognised pension treatment "${treatment}"; a net-pay arrangement has been assumed.`,
      });
    }
  }

  // An undergraduate plan and a postgraduate loan are repaid concurrently, each
  // against its own threshold, so both selectors can be active at once.
  const loanSelectors: string[] = [];
  const studentLoanPlan = readString(input, 'studentLoanPlan', 'none');
  if (studentLoanPlan !== 'none') {
    const scheme = resolveLoanScheme(
      ruleset,
      studentLoanPlan,
      PLAN_LABELS[studentLoanPlan] ?? `Student loan ${studentLoanPlan.replace('-', ' ')}`,
    );
    if (scheme.ok) loanSelectors.push(scheme.selector);
    else notices.push(scheme.notice);
  }
  if (readBoolean(input, 'hasPostgraduateLoan', false)) {
    const scheme = resolveLoanScheme(ruleset, 'postgraduate', 'Postgraduate loan');
    if (scheme.ok) loanSelectors.push(scheme.selector);
    else notices.push(scheme.notice);
  }

  return {
    ruleset,
    input: { ...input, subJurisdiction: region },
    preTaxContributions,
    loanSelectors,
    extraNotices: notices,
  };
}
