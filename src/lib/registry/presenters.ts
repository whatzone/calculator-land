/**
 * Presentation shells. These turn calculation results into view models.
 *
 * Ordering matters and is fixed here rather than in templates: take-home pay,
 * then total deductions, then the itemised breakdown, then pay frequencies,
 * then assumptions and sources. Every chart segment has a matching breakdown
 * row, so nothing is available only visually.
 */
import { toNumber } from '../calculations/common/money.ts';
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatDuration,
  formatRate,
} from '../formatting/index.ts';
import type {
  CalculationContext,
  CalculationResult,
  CurrencyCode,
} from '../calculations/common/types.ts';
import type { ResultRow, ResultViewModel } from './types.ts';
import type {
  BonusResult,
  NetToGrossResult,
  PayRiseResult,
} from '../calculations/common/scenarios.ts';
import type { MortgageResult, OverpaymentResult } from '../calculations/global/mortgage.ts';
import type { HourlyResult } from '../calculations/global/hourly.ts';

function unsupportedView(
  result: {
    readonly notices: readonly { severity: string; message: string }[];
    readonly assumptions: readonly string[];
  },
  headlineLabel: string,
): ResultViewModel {
  return {
    headline: {
      label: headlineLabel,
      value: 'Not available',
      caption: 'This calculation cannot be shown yet.',
    },
    summaryRows: [],
    breakdownRows: [],
    frequencyRows: [],
    notices: result.notices.map((notice) => ({
      severity: notice.severity as 'info' | 'warning' | 'unsupported',
      message: notice.message,
    })),
    assumptions: result.assumptions,
    supported: false,
  };
}

export function presentSalary(
  result: CalculationResult,
  context: CalculationContext,
): ResultViewModel {
  if (!result.supported) return unsupportedView(result, 'Take-home pay');

  const currency = context.currency as CurrencyCode;
  const locale = context.locale;

  const breakdownRows: ResultRow[] = result.deductions.map((line) => ({
    label: line.label,
    value: formatCurrency(line.annualAmount, currency, locale),
    detail: line.explanation,
  }));

  const chartTotal = toNumber(result.grossAnnual);
  const chart =
    chartTotal > 0
      ? [
          ...result.deductions.map((line) => ({
            label: line.label,
            value: toNumber(line.annualAmount),
            percent: (toNumber(line.annualAmount) / chartTotal) * 100,
          })),
          {
            label: 'Take-home pay',
            value: toNumber(result.netAnnual),
            percent: (toNumber(result.netAnnual) / chartTotal) * 100,
          },
        ]
      : undefined;

  return {
    headline: {
      label: 'Take-home pay',
      value: formatCurrency(result.netAnnual, currency, locale),
      caption: `a year, or ${formatCurrency(result.netMonthly, currency, locale)} a month`,
    },
    summaryRows: [
      {
        label: 'Gross pay',
        value: formatCurrency(result.grossAnnual, currency, locale),
        emphasis: 'secondary',
      },
      {
        label: 'Total deductions',
        value: formatCurrency(result.totalDeductions, currency, locale),
        emphasis: 'secondary',
      },
      {
        label: 'Average deduction rate',
        value: formatRate(result.averageDeductionRate, locale),
        detail: 'The share of your whole salary that is deducted.',
      },
      {
        label: 'Marginal deduction rate',
        value: formatRate(result.marginalDeductionRate, locale),
        detail:
          'The share deducted from your next unit of pay. Measured, not read off a rate table.',
      },
      {
        label: `Kept from the next ${formatCurrency(result.keptFromNextIncrement.increment, currency, locale)}`,
        value: formatCurrency(result.keptFromNextIncrement.kept, currency, locale),
        detail: 'What a pay rise of that size would actually add to your take-home pay.',
      },
    ],
    breakdownRows,
    frequencyRows: [
      {
        label: 'Yearly',
        value: formatCurrency(result.netAnnual, currency, locale),
        emphasis: 'primary',
      },
      { label: 'Monthly', value: formatCurrencyPrecise(result.netMonthly, currency, locale) },
      {
        label: 'Fortnightly',
        value: formatCurrencyPrecise(result.netFortnightly, currency, locale),
      },
      { label: 'Weekly', value: formatCurrencyPrecise(result.netWeekly, currency, locale) },
      ...(result.netHourly
        ? [{ label: 'Hourly', value: formatCurrencyPrecise(result.netHourly, currency, locale) }]
        : []),
    ],
    notices: result.notices.map((notice) => ({
      severity: notice.severity,
      message: notice.message,
    })),
    assumptions: result.assumptions,
    supported: true,
    ...(chart ? { chart } : {}),
  };
}

export function presentBonus(result: BonusResult, context: CalculationContext): ResultViewModel {
  if (!result.supported) return unsupportedView(result.withBonus, 'Bonus after tax');

  const currency = context.currency as CurrencyCode;
  const locale = context.locale;

  return {
    headline: {
      label: 'Bonus after deductions',
      value: formatCurrency(result.bonusTakeHome, currency, locale),
      caption: `from a ${formatCurrency(result.bonusAmount, currency, locale)} bonus`,
    },
    summaryRows: [
      {
        label: 'Bonus before deductions',
        value: formatCurrency(result.bonusAmount, currency, locale),
      },
      {
        label: 'Deducted from the bonus',
        value: formatCurrency(result.deductionsOnBonus, currency, locale),
      },
      {
        label: 'Effective rate on the bonus',
        value: formatRate(result.effectiveBonusRate, locale),
        detail:
          'Calculated by working out the whole year with and without the bonus and taking the difference, not by applying a headline rate.',
      },
      {
        label: 'Take-home pay without the bonus',
        value: formatCurrency(result.withoutBonus.netAnnual, currency, locale),
        emphasis: 'secondary',
      },
      {
        label: 'Take-home pay with the bonus',
        value: formatCurrency(result.withBonus.netAnnual, currency, locale),
        emphasis: 'secondary',
      },
    ],
    breakdownRows: result.withBonus.deductions.map((line) => ({
      label: line.label,
      value: formatCurrency(line.annualAmount, currency, locale),
      detail: line.explanation,
    })),
    frequencyRows: [],
    notices: result.withBonus.notices.map((n) => ({ severity: n.severity, message: n.message })),
    assumptions: [
      ...result.withBonus.assumptions,
      'The bonus is treated as extra pay in the same tax year. Payroll may withhold a different amount in the month it is paid and correct it later.',
    ],
    supported: true,
  };
}

export function presentPayRise(
  result: PayRiseResult,
  context: CalculationContext,
): ResultViewModel {
  if (!result.supported) return unsupportedView(result.after, 'Pay rise after tax');

  const currency = context.currency as CurrencyCode;
  const locale = context.locale;

  return {
    headline: {
      label: 'Extra take-home pay',
      value: formatCurrency(result.netIncrease, currency, locale),
      caption: `a year, or ${formatCurrencyPrecise(result.netMonthlyIncrease, currency, locale)} a month`,
    },
    summaryRows: [
      { label: 'Gross pay rise', value: formatCurrency(result.grossIncrease, currency, locale) },
      {
        label: 'Share of the rise you keep',
        value: formatRate(result.retentionRate, locale),
        detail: 'The rest goes in tax and contributions on the additional pay.',
      },
      {
        label: 'Take-home pay before',
        value: formatCurrency(result.before.netAnnual, currency, locale),
        emphasis: 'secondary',
      },
      {
        label: 'Take-home pay after',
        value: formatCurrency(result.after.netAnnual, currency, locale),
        emphasis: 'secondary',
      },
    ],
    breakdownRows: result.after.deductions.map((line) => ({
      label: line.label,
      value: formatCurrency(line.annualAmount, currency, locale),
      detail: line.explanation,
    })),
    frequencyRows: [],
    notices: result.after.notices.map((n) => ({ severity: n.severity, message: n.message })),
    assumptions: result.after.assumptions,
    supported: true,
  };
}

export function presentNetToGross(
  result: NetToGrossResult,
  context: CalculationContext,
): ResultViewModel {
  const currency = context.currency as CurrencyCode;
  const locale = context.locale;

  if (!result.outcome.ok) {
    return {
      headline: { label: 'Gross salary needed', value: 'Not available' },
      summaryRows: [],
      breakdownRows: [],
      frequencyRows: [],
      notices: [{ severity: 'unsupported', message: result.outcome.reason }],
      assumptions: result.detail?.assumptions ?? [],
      supported: false,
    };
  }

  const detail = result.detail;
  return {
    headline: {
      label: 'Gross salary needed',
      value: formatCurrency(result.outcome.gross, currency, locale),
      caption: `to take home ${formatCurrency(result.targetNet, currency, locale)} a year`,
    },
    summaryRows: [
      { label: 'Target take-home pay', value: formatCurrency(result.targetNet, currency, locale) },
      {
        label: 'Gross salary required',
        value: formatCurrency(result.outcome.gross, currency, locale),
        emphasis: 'primary',
      },
      ...(detail
        ? [
            {
              label: 'Total deductions at that salary',
              value: formatCurrency(detail.totalDeductions, currency, locale),
            },
          ]
        : []),
    ],
    breakdownRows:
      detail?.deductions.map((line) => ({
        label: line.label,
        value: formatCurrency(line.annualAmount, currency, locale),
        detail: line.explanation,
      })) ?? [],
    frequencyRows: [],
    notices: detail?.notices.map((n) => ({ severity: n.severity, message: n.message })) ?? [],
    assumptions: detail?.assumptions ?? [],
    supported: true,
  };
}

export function presentMortgage(
  result: MortgageResult,
  context: CalculationContext,
): ResultViewModel {
  const currency = context.currency as CurrencyCode;
  const locale = context.locale;

  if (result.warnings.length > 0 && result.numberOfPayments === 0) {
    return {
      headline: { label: 'Monthly payment', value: 'Not available' },
      summaryRows: [],
      breakdownRows: [],
      frequencyRows: [],
      notices: result.warnings.map((message) => ({ severity: 'unsupported' as const, message })),
      assumptions: result.assumptions,
      supported: false,
    };
  }

  const totalPaid = toNumber(result.totalPaid);
  const interest = toNumber(result.totalInterest);
  const capital = totalPaid - interest;

  return {
    headline: {
      label: 'Monthly payment',
      value: formatCurrencyPrecise(result.monthlyPayment, currency, locale),
      caption: `over ${result.numberOfPayments} payments`,
    },
    summaryRows: [
      { label: 'Total interest', value: formatCurrency(result.totalInterest, currency, locale) },
      { label: 'Total repaid', value: formatCurrency(result.totalPaid, currency, locale) },
      { label: 'Number of payments', value: String(result.numberOfPayments) },
    ],
    breakdownRows: [
      {
        label: 'Capital repaid',
        value: formatCurrency(result.totalPaid.minus(result.totalInterest), currency, locale),
      },
      { label: 'Interest paid', value: formatCurrency(result.totalInterest, currency, locale) },
    ],
    breakdownHeadings: { item: 'Component', value: 'Over the full term' },
    frequencyRows: [],
    notices: result.warnings.map((message) => ({ severity: 'warning' as const, message })),
    assumptions: result.assumptions,
    supported: true,
    chart:
      totalPaid > 0
        ? [
            { label: 'Capital repaid', value: capital, percent: (capital / totalPaid) * 100 },
            { label: 'Interest paid', value: interest, percent: (interest / totalPaid) * 100 },
          ]
        : undefined,
  };
}

export function presentOverpayment(
  result: OverpaymentResult,
  context: CalculationContext,
): ResultViewModel {
  const currency = context.currency as CurrencyCode;
  const locale = context.locale;

  if (result.baseline.numberOfPayments === 0) {
    return {
      headline: { label: 'Interest saved', value: 'Not available' },
      summaryRows: [],
      breakdownRows: [],
      frequencyRows: [],
      notices: result.warnings.map((message) => ({ severity: 'unsupported' as const, message })),
      assumptions: result.assumptions,
      supported: false,
    };
  }

  return {
    headline: {
      label: 'Interest saved',
      value: formatCurrency(result.interestSaved, currency, locale),
      caption: `and ${formatDuration(result.yearsSaved, result.monthsSaved)} off the term`,
    },
    summaryRows: [
      { label: 'Term without overpaying', value: `${result.baseline.numberOfPayments} payments` },
      {
        label: 'Term with overpaying',
        value: `${result.withOverpayment.numberOfPayments} payments`,
      },
      {
        label: 'Interest without overpaying',
        value: formatCurrency(result.baseline.totalInterest, currency, locale),
      },
      {
        label: 'Interest with overpaying',
        value: formatCurrency(result.withOverpayment.totalInterest, currency, locale),
      },
    ],
    breakdownRows: [
      {
        label: 'Total repaid without overpaying',
        value: formatCurrency(result.baseline.totalPaid, currency, locale),
      },
      {
        label: 'Total repaid with overpaying',
        value: formatCurrency(result.withOverpayment.totalPaid, currency, locale),
      },
    ],
    breakdownHeadings: { item: 'Scenario', value: 'Over the full term' },
    frequencyRows: [],
    notices: result.warnings.map((message) => ({ severity: 'warning' as const, message })),
    assumptions: result.assumptions,
    supported: true,
  };
}

export function presentHourly(result: HourlyResult, context: CalculationContext): ResultViewModel {
  const currency = result.currency;
  const locale = context.locale;

  if (result.annual.eq(0) && result.warnings.length > 0) {
    return {
      headline: { label: 'Annual pay', value: 'Not available' },
      summaryRows: [],
      breakdownRows: [],
      frequencyRows: [],
      notices: result.warnings.map((message) => ({ severity: 'unsupported' as const, message })),
      assumptions: result.assumptions,
      supported: false,
    };
  }

  return {
    headline: {
      label: 'Annual pay before tax',
      value: formatCurrency(result.annual, currency, locale),
      caption: `based on ${result.totalHoursPerYear.toString()} paid hours a year`,
    },
    summaryRows: [
      { label: 'Hourly', value: formatCurrencyPrecise(result.hourly, currency, locale) },
      { label: 'Daily', value: formatCurrencyPrecise(result.daily, currency, locale) },
    ],
    breakdownRows: [],
    frequencyRows: [
      {
        label: 'Yearly',
        value: formatCurrency(result.annual, currency, locale),
        emphasis: 'primary',
      },
      { label: 'Monthly', value: formatCurrencyPrecise(result.monthly, currency, locale) },
      { label: 'Fortnightly', value: formatCurrencyPrecise(result.fortnightly, currency, locale) },
      { label: 'Weekly', value: formatCurrencyPrecise(result.weekly, currency, locale) },
      { label: 'Hourly', value: formatCurrencyPrecise(result.hourly, currency, locale) },
    ],
    notices: result.warnings.map((message) => ({ severity: 'warning' as const, message })),
    assumptions: result.assumptions,
    supported: true,
  };
}
