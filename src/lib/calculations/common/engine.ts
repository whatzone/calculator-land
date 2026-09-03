/**
 * The shared salary engine.
 *
 * Five tax systems, one implementation. Everything specific to a jurisdiction
 * arrives as ruleset data or as a small adapter that decides ordering and
 * profile handling; the arithmetic below is common and is tested once.
 *
 * The engine's most important behaviour is its refusal to guess. If the ruleset
 * is not populated, or the profile asks for something the ruleset cannot
 * express, the result comes back with `supported: false` and a notice that the
 * UI renders prominently — it does not come back with a plausible number.
 */
import {
  type Money,
  money,
  ZERO,
  clampAtZero,
  minOf,
  percentOf,
  roundToMinorUnit,
  roundToUnit,
  Rounding,
  sum,
} from './money.ts';
import { applyBands, taperAllowance, toBands, type Band } from './brackets.ts';
import { averageDeductionRate, measureMarginalRate, nextIncrementFor } from './marginal.ts';
import { perPeriod, perHour } from './frequency.ts';
import type {
  CalculationInput,
  CalculationResult,
  CurrencyCode,
  DeductionLine,
  JurisdictionCode,
  ResultNotice,
  ThresholdCrossing,
} from './types.ts';
import { isCalculable } from '../../validation/ruleset-helpers.ts';
import type { Ruleset } from '../../validation/ruleset-schema.ts';

/** A pre-tax contribution chosen by the user, e.g. a workplace pension. */
export interface PreTaxContribution {
  readonly id: string;
  readonly label: string;
  readonly annualAmount: Money;
  readonly explanation: string;
  readonly sourceIds: readonly string[];
  /** True where it also reduces the base for contributions, not just income tax. */
  readonly reducesContributionBase: boolean;
}

/** An extra deduction an adapter computes itself (student loan, KiwiSaver...). */
export interface ExtraDeduction {
  readonly line: DeductionLine;
  /** Whether this deduction should count toward the marginal-rate measurement. */
  readonly includeInMarginal: boolean;
}

export interface EngineOptions {
  readonly ruleset: Ruleset;
  /** Additional rulesets composed into this one, e.g. Canadian federal tax. */
  readonly composedRulesets?: readonly Ruleset[];
  readonly input: CalculationInput;
  readonly preTaxContributions?: readonly PreTaxContribution[];
  readonly extraDeductions?: readonly ExtraDeduction[];
  readonly extraNotices?: readonly ResultNotice[];
  readonly extraAssumptions?: readonly string[];
}

interface DeductionPass {
  readonly lines: readonly DeductionLine[];
  readonly total: Money;
  readonly taxableIncome: Money;
}

function bandsOf(ruleset: Ruleset): Band[] {
  return toBands(ruleset.rules.incomeTaxBands);
}

function roundTax(value: Money, ruleset: Ruleset): Money {
  switch (ruleset.rules.rounding.taxDue) {
    case 'down-to-unit':
      return roundToUnit(value, Rounding.DOWN);
    case 'half-up-to-unit':
      return roundToUnit(value, Rounding.HALF_UP);
    case 'none':
      return value;
    case 'half-up-to-minor':
    default:
      return roundToMinorUnit(value);
  }
}

function roundTaxable(value: Money, ruleset: Ruleset): Money {
  switch (ruleset.rules.rounding.taxableIncome) {
    case 'down-to-unit':
      return roundToUnit(value, Rounding.DOWN);
    case 'half-up-to-unit':
      return roundToUnit(value, Rounding.HALF_UP);
    case 'none':
    default:
      return value;
  }
}

/**
 * Income tax for one ruleset layer: allowances (with taper), bands, then
 * non-refundable credits floored at zero.
 */
function incomeTaxFor(
  ruleset: Ruleset,
  incomeAfterPreTax: Money,
  labelPrefix: string,
): { line: DeductionLine | null; taxableIncome: Money } {
  const bands = bandsOf(ruleset);
  if (bands.length === 0) {
    return { line: null, taxableIncome: ZERO };
  }

  let allowanceTotal = ZERO;
  const allowanceNotes: string[] = [];

  for (const allowance of ruleset.rules.allowances) {
    let amount = money(allowance.amount);
    if (allowance.taperThreshold !== null && allowance.taperWithdrawnPerUnit !== null) {
      const tapered = taperAllowance(
        amount,
        incomeAfterPreTax,
        money(allowance.taperThreshold),
        money(allowance.taperWithdrawnPerUnit),
      );
      if (!tapered.eq(amount)) {
        allowanceNotes.push(
          `${allowance.label} reduced from ${amount.toString()} to ${tapered.toString()} because income exceeds ${money(allowance.taperThreshold).toString()}.`,
        );
      }
      amount = tapered;
    }
    allowanceTotal = allowanceTotal.plus(amount);
  }

  const taxableIncome = roundTaxable(clampAtZero(incomeAfterPreTax.minus(allowanceTotal)), ruleset);
  const applied = applyBands(taxableIncome, bands);

  // Non-refundable credits reduce tax but never below zero.
  let creditTotal = ZERO;
  for (const credit of ruleset.rules.credits) {
    const base = money(credit.amount);
    const value = credit.ratePercent === null ? base : percentOf(base, money(credit.ratePercent));
    creditTotal = creditTotal.plus(value);
  }

  const nonRefundable = ruleset.rules.credits.every((credit) => credit.kind === 'non-refundable');
  const afterCredits = nonRefundable
    ? clampAtZero(applied.total.minus(creditTotal))
    : applied.total.minus(creditTotal);

  const sourceIds = [
    ...new Set([
      ...ruleset.rules.allowances.flatMap((allowance) => allowance.sourceIds),
      ...ruleset.rules.credits.flatMap((credit) => credit.sourceIds),
      ...ruleset.sources.map((source) => source.id),
    ]),
  ];

  const explanationParts = [
    allowanceTotal.gt(0)
      ? `Allowances of ${allowanceTotal.toString()} are deducted first, leaving ${taxableIncome.toString()} taxable.`
      : `All ${taxableIncome.toString()} of income is taxable; this system uses credits rather than an allowance.`,
    'Each band applies only to the slice of income that falls inside it.',
    creditTotal.gt(0)
      ? `Credits of ${creditTotal.toString()} are then subtracted from the tax due.`
      : '',
    ...allowanceNotes,
  ].filter((part) => part !== '');

  return {
    line: {
      id: `${labelPrefix}-income-tax`,
      label: ruleset.subJurisdictionLabel
        ? `${ruleset.subJurisdictionLabel} income tax`
        : 'Income tax',
      annualAmount: roundTax(clampAtZero(afterCredits), ruleset),
      explanation: explanationParts.join(' '),
      sourceIds,
      workings: applied.workings,
    },
    taxableIncome,
  };
}

function leviesFor(ruleset: Ruleset, income: Money, prefix: string): DeductionLine[] {
  return ruleset.rules.levies.map((levy) => {
    const upper = levy.ceiling === null ? income : minOf(income, money(levy.ceiling));
    const chargeable = clampAtZero(upper.minus(money(levy.floor)));
    const amount = percentOf(chargeable, money(levy.ratePercent));
    return {
      id: `${prefix}-${levy.id}`,
      label: levy.label,
      annualAmount: roundTax(amount, ruleset),
      explanation:
        `${levy.label} is charged at ${money(levy.ratePercent).toString()}% on income above ` +
        `${money(levy.floor).toString()}` +
        (levy.ceiling === null ? '.' : `, up to a ceiling of ${money(levy.ceiling).toString()}.`),
      sourceIds: levy.sourceIds.length > 0 ? levy.sourceIds : ruleset.sources.map((s) => s.id),
    };
  });
}

function contributionsFor(ruleset: Ruleset, income: Money, prefix: string): DeductionLine[] {
  return ruleset.rules.contributions.map((contribution) => {
    const capped =
      contribution.maximumEarnings === null
        ? income
        : minOf(income, money(contribution.maximumEarnings));

    let amount: Money;
    let workings;

    if (income.lte(money(contribution.exemptBelow))) {
      amount = ZERO;
      workings = [];
    } else {
      const applied = applyBands(capped, toBands(contribution.bands));
      amount = applied.total;
      workings = applied.workings;
    }

    if (contribution.maximumContribution !== null) {
      amount = minOf(amount, money(contribution.maximumContribution));
    }

    return {
      id: `${prefix}-${contribution.id}`,
      label: contribution.label,
      annualAmount: roundTax(amount, ruleset),
      explanation:
        `${contribution.label} is calculated on earnings` +
        (contribution.exemptBelow !== 0
          ? ` above ${money(contribution.exemptBelow).toString()}`
          : '') +
        (contribution.maximumEarnings !== null
          ? `, up to maximum earnings of ${money(contribution.maximumEarnings).toString()}`
          : '') +
        (contribution.maximumContribution !== null
          ? `, capped at a contribution of ${money(contribution.maximumContribution).toString()}`
          : '') +
        '.',
      sourceIds:
        contribution.sourceIds.length > 0
          ? contribution.sourceIds
          : ruleset.sources.map((s) => s.id),
      workings,
    };
  });
}

/** Everything that is deducted at a given gross. Re-invoked to measure marginal rate. */
function deductionsAt(options: EngineOptions, gross: Money): DeductionPass {
  const {
    ruleset,
    composedRulesets = [],
    preTaxContributions = [],
    extraDeductions = [],
  } = options;

  const preTaxTotal = sum(preTaxContributions.map((item) => item.annualAmount));
  const incomeForTax = clampAtZero(gross.minus(preTaxTotal));
  const contributionBase = clampAtZero(
    gross.minus(
      sum(
        preTaxContributions
          .filter((item) => item.reducesContributionBase)
          .map((item) => item.annualAmount),
      ),
    ),
  );

  const lines: DeductionLine[] = [];

  // Composed layers first (e.g. Canadian federal tax before provincial).
  let taxableIncome = ZERO;
  for (const layer of composedRulesets) {
    const layerTax = incomeTaxFor(layer, incomeForTax, layer.subJurisdiction ?? 'federal');
    if (layerTax.line) lines.push(layerTax.line);
    taxableIncome = layerTax.taxableIncome;
    lines.push(...leviesFor(layer, incomeForTax, layer.subJurisdiction ?? 'federal'));
    lines.push(...contributionsFor(layer, contributionBase, layer.subJurisdiction ?? 'federal'));
  }

  const primary = incomeTaxFor(
    ruleset,
    incomeForTax,
    ruleset.subJurisdiction ?? ruleset.jurisdiction,
  );
  if (primary.line) lines.push(primary.line);
  if (composedRulesets.length === 0) taxableIncome = primary.taxableIncome;

  lines.push(...leviesFor(ruleset, incomeForTax, ruleset.subJurisdiction ?? ruleset.jurisdiction));
  lines.push(
    ...contributionsFor(ruleset, contributionBase, ruleset.subJurisdiction ?? ruleset.jurisdiction),
  );

  // Pre-tax contributions are shown as deduction lines because the user does
  // not receive them as take-home pay, even though they are not tax.
  for (const contribution of preTaxContributions) {
    lines.push({
      id: contribution.id,
      label: contribution.label,
      annualAmount: roundToMinorUnit(contribution.annualAmount),
      explanation: contribution.explanation,
      sourceIds: contribution.sourceIds,
      isPreTaxContribution: true,
    });
  }

  for (const extra of extraDeductions) {
    lines.push(extra.line);
  }

  const kept = lines.filter((line) => line.annualAmount.gt(0));
  return {
    lines: kept,
    total: sum(kept.map((line) => line.annualAmount)),
    taxableIncome,
  };
}

/** Thresholds this income sits near or has crossed, for result-specific content. */
function thresholdCrossings(rulesets: readonly Ruleset[], gross: Money): ThresholdCrossing[] {
  const crossings: ThresholdCrossing[] = [];

  for (const ruleset of rulesets) {
    for (const band of ruleset.rules.incomeTaxBands) {
      const amount = money(band.from);
      if (amount.lte(0)) continue;
      crossings.push({
        id: `${ruleset.id}-band-${band.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: `${band.label} starts`,
        amount,
        crossed: gross.gte(amount),
        distanceToThreshold: amount.minus(gross).abs(),
      });
    }
    for (const allowance of ruleset.rules.allowances) {
      if (allowance.taperThreshold === null) continue;
      const amount = money(allowance.taperThreshold);
      crossings.push({
        id: `${ruleset.id}-taper-${allowance.id}`,
        label: `${allowance.label} starts to be withdrawn`,
        amount,
        crossed: gross.gt(amount),
        distanceToThreshold: amount.minus(gross).abs(),
      });
    }
    for (const contribution of ruleset.rules.contributions) {
      if (contribution.maximumEarnings === null) continue;
      const amount = money(contribution.maximumEarnings);
      crossings.push({
        id: `${ruleset.id}-cap-${contribution.id}`,
        label: `${contribution.label} reaches its earnings ceiling`,
        amount,
        crossed: gross.gte(amount),
        distanceToThreshold: amount.minus(gross).abs(),
      });
    }
  }

  return crossings.sort((a, b) => (a.amount.lt(b.amount) ? -1 : 1));
}

/** Result returned when the rules needed to answer honestly are not available. */
export function unsupportedResult(
  ruleset: Ruleset,
  input: CalculationInput,
  reasons: readonly string[],
): CalculationResult {
  const base = {
    jurisdiction: input.jurisdiction,
    currency: ruleset.currency as CurrencyCode,
    taxPeriodLabel: ruleset.taxPeriod.label,
    rulesetVersion: ruleset.id,
    grossAnnual: input.grossAnnualIncome,
    taxableIncome: ZERO,
    deductions: [] as readonly DeductionLine[],
    totalDeductions: ZERO,
    netAnnual: ZERO,
    netMonthly: ZERO,
    netFortnightly: ZERO,
    netBiweekly: ZERO,
    netWeekly: ZERO,
    averageDeductionRate: ZERO,
    marginalDeductionRate: ZERO,
    keptFromNextIncrement: {
      increment: nextIncrementFor(input.jurisdiction),
      kept: ZERO,
      kptRatePercent: ZERO,
    },
    thresholdsCrossed: [] as readonly ThresholdCrossing[],
    assumptions: ruleset.assumptions,
    notices: reasons.map((reason) => ({ severity: 'unsupported' as const, message: reason })),
    supported: false,
    isAnnualisedEstimate: true,
  };
  return input.subJurisdiction ? { ...base, subJurisdiction: input.subJurisdiction } : base;
}

/**
 * Run a full salary calculation.
 *
 * Adapters call this after translating their profile options into pre-tax
 * contributions, extra deductions, and notices.
 */
export function runSalaryCalculation(options: EngineOptions): CalculationResult {
  const { ruleset, composedRulesets = [], input } = options;

  const blocking: string[] = [];
  if (!isCalculable(ruleset)) {
    blocking.push(
      `The ${ruleset.taxPeriod.label} rules for this location have not yet been verified against the official source, so no figure can be shown. ${ruleset.provenance.note}`,
    );
  }
  for (const layer of composedRulesets) {
    if (!isCalculable(layer)) {
      blocking.push(
        `The composed ruleset "${layer.id}" has not yet been verified against the official source.`,
      );
    }
  }
  if (input.grossAnnualIncome.lt(0)) {
    blocking.push('Gross pay cannot be negative.');
  }
  if (blocking.length > 0) {
    return unsupportedResult(ruleset, input, blocking);
  }

  const gross = input.grossAnnualIncome;
  const pass = deductionsAt(options, gross);
  const netAnnual = clampAtZero(gross.minus(pass.total));

  const marginal = measureMarginalRate(gross, (probe) => deductionsAt(options, probe).total);

  const increment = nextIncrementFor(input.jurisdiction);
  const netAtIncrement = clampAtZero(
    gross.plus(increment).minus(deductionsAt(options, gross.plus(increment)).total),
  );
  const kept = netAtIncrement.minus(netAnnual);

  const hoursPerWeek = input.hoursPerWeek;
  const weeksPerYear = input.weeksPerYear;

  const result: CalculationResult = {
    jurisdiction: input.jurisdiction,
    ...(input.subJurisdiction ? { subJurisdiction: input.subJurisdiction } : {}),
    currency: ruleset.currency as CurrencyCode,
    taxPeriodLabel: ruleset.taxPeriod.label,
    rulesetVersion: ruleset.id,

    grossAnnual: gross,
    taxableIncome: pass.taxableIncome,
    deductions: pass.lines,
    totalDeductions: pass.total,
    netAnnual: roundToMinorUnit(netAnnual),
    netMonthly: perPeriod(netAnnual, 'monthly'),
    netFortnightly: perPeriod(netAnnual, 'fortnightly'),
    netBiweekly: perPeriod(netAnnual, 'biweekly'),
    netWeekly: perPeriod(netAnnual, 'weekly'),
    ...(hoursPerWeek && weeksPerYear
      ? { netHourly: perHour(netAnnual, hoursPerWeek, weeksPerYear) }
      : {}),

    averageDeductionRate: averageDeductionRate(pass.total, gross),
    marginalDeductionRate: marginal.rate,
    keptFromNextIncrement: {
      increment,
      kept: roundToMinorUnit(kept),
      kptRatePercent: increment.eq(0) ? ZERO : kept.div(increment).times(100),
    },
    thresholdsCrossed: thresholdCrossings([ruleset, ...composedRulesets], gross),

    assumptions: [...ruleset.assumptions, ...(options.extraAssumptions ?? [])],
    notices: options.extraNotices ?? [],
    supported: true,
    isAnnualisedEstimate: true,
  };

  return result;
}

/** Net annual pay at a given gross — the forward function for net-to-gross. */
export function netAnnualAt(options: EngineOptions, gross: Money): Money {
  const probeOptions: EngineOptions = {
    ...options,
    input: { ...options.input, grossAnnualIncome: gross },
  };
  return clampAtZero(gross.minus(deductionsAt(probeOptions, gross).total));
}

export type { JurisdictionCode };
