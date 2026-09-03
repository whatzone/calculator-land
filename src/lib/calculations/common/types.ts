/**
 * The shared calculation contract.
 *
 * Principles this file exists to enforce:
 *  - every input is explicit; nothing is inferred silently from a default;
 *  - rates and thresholds arrive as data, never as magic numbers in formulas;
 *  - every result carries an itemised audit trail that maps back to sources;
 *  - an unsupported combination produces a visible warning, never a
 *    plausible-looking guess.
 */
import type { Money, Rate } from './money.ts';

export type PayFrequency = 'annual' | 'monthly' | 'fortnightly' | 'biweekly' | 'weekly' | 'hourly';

export const PAY_FREQUENCIES: readonly PayFrequency[] = [
  'annual',
  'monthly',
  'fortnightly',
  'biweekly',
  'weekly',
  'hourly',
];

/** ISO 4217 codes for the launch markets. */
export type CurrencyCode = 'GBP' | 'EUR' | 'AUD' | 'NZD' | 'CAD' | 'USD';

export type JurisdictionCode = 'uk' | 'ireland' | 'australia' | 'new-zealand' | 'canada';

export interface CalculationInput {
  readonly jurisdiction: JurisdictionCode;
  /** e.g. 'scotland', 'ontario', 'quebec'. Absent means the jurisdiction default. */
  readonly subJurisdiction?: string;
  /** Ruleset identifier, e.g. 'uk-2026-27'. */
  readonly taxPeriod: string;
  readonly grossAnnualIncome: Money;
  readonly payFrequency: PayFrequency;
  readonly hoursPerWeek?: number;
  readonly weeksPerYear?: number;
  /**
   * Jurisdiction-specific switches: pension percentage, student-loan plan,
   * civil status, KiwiSaver rate, and so on. Each engine validates the subset
   * it understands and warns about anything it cannot honour.
   */
  readonly profile: Readonly<Record<string, string | number | boolean>>;
}

/** One line of the deduction audit trail. */
export interface DeductionLine {
  readonly id: string;
  readonly label: string;
  readonly annualAmount: Money;
  /** Plain-English explanation of how this line was produced. */
  readonly explanation: string;
  /** IDs into the ruleset's source register. Never empty for a published line. */
  readonly sourceIds: readonly string[];
  /** Optional per-band workings, shown in the expandable breakdown. */
  readonly workings?: readonly DeductionWorking[];
  /** True where the line reduces taxable income rather than net pay directly. */
  readonly isPreTaxContribution?: boolean;
}

export interface DeductionWorking {
  readonly label: string;
  readonly amountTaxed: Money;
  readonly ratePercent: Rate;
  readonly tax: Money;
}

export type ResultSeverity = 'info' | 'warning' | 'unsupported';

export interface ResultNotice {
  readonly severity: ResultSeverity;
  readonly message: string;
}

/**
 * Which tax thresholds this income crosses. Powers the "what changes at the
 * next threshold" content that makes a curated salary page worth indexing.
 */
export interface ThresholdCrossing {
  readonly id: string;
  readonly label: string;
  readonly amount: Money;
  readonly crossed: boolean;
  readonly distanceToThreshold: Money;
}

export interface CalculationResult {
  readonly jurisdiction: JurisdictionCode;
  readonly subJurisdiction?: string;
  readonly currency: CurrencyCode;
  readonly taxPeriodLabel: string;
  readonly rulesetVersion: string;

  readonly grossAnnual: Money;
  readonly taxableIncome: Money;
  readonly deductions: readonly DeductionLine[];
  readonly totalDeductions: Money;
  readonly netAnnual: Money;
  readonly netMonthly: Money;
  readonly netFortnightly: Money;
  readonly netBiweekly: Money;
  readonly netWeekly: Money;
  /** Present only when hours and weeks were supplied. */
  readonly netHourly?: Money;

  readonly averageDeductionRate: Rate;
  readonly marginalDeductionRate: Rate;
  /** Take-home from the next locally sensible increment of gross pay. */
  readonly keptFromNextIncrement: {
    readonly increment: Money;
    readonly kept: Money;
    readonly kptRatePercent: Rate;
  };
  readonly thresholdsCrossed: readonly ThresholdCrossing[];

  readonly assumptions: readonly string[];
  readonly notices: readonly ResultNotice[];
  /**
   * False when any part of the calculation could not be performed faithfully.
   * The indexability gate refuses to publish a page whose result is unsupported.
   */
  readonly supported: boolean;
  /**
   * True where the annual figure is an annualised estimate rather than the exact
   * sum of period-by-period payroll withholding.
   */
  readonly isAnnualisedEstimate: boolean;
}

/** Context threaded through calculation and presentation. */
export interface CalculationContext {
  readonly locale: string;
  readonly currency: CurrencyCode;
  readonly taxPeriodLabel: string;
  readonly rulesetVersion: string;
}

export class UnsupportedCalculationError extends Error {
  public readonly reasons: readonly string[];
  constructor(reasons: readonly string[]) {
    super(`Calculation is not supported: ${reasons.join('; ')}`);
    this.name = 'UnsupportedCalculationError';
    this.reasons = reasons;
  }
}
