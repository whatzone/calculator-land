/**
 * Profile option helpers.
 *
 * Adapters read user choices through these so that an option the ruleset cannot
 * honour becomes a visible notice rather than a silently ignored input.
 */
import { type Money, money, percentOf } from './money.ts';
import type { CalculationInput, ResultNotice } from './types.ts';
import type { Ruleset } from '../../validation/ruleset-schema.ts';

export function readNumber(input: CalculationInput, key: string, fallback = 0): number {
  const value = input.profile[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return fallback;
}

export function readString(input: CalculationInput, key: string, fallback = ''): string {
  const value = input.profile[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

export function readBoolean(input: CalculationInput, key: string, fallback = false): boolean {
  const value = input.profile[key];
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

/** A percentage-of-salary pension/retirement contribution. */
export function pensionContribution(
  gross: Money,
  percent: number,
  options: {
    readonly id: string;
    readonly label: string;
    readonly reducesContributionBase: boolean;
    readonly sourceIds: readonly string[];
    readonly explanation: string;
  },
): { readonly annualAmount: Money } & typeof options {
  return { ...options, annualAmount: percentOf(gross, money(percent)) };
}

/**
 * Look up an optional scheme (student loan, HELP, KiwiSaver) in the ruleset.
 * Returns a notice instead of a value when the scheme was requested but the
 * ruleset does not carry the data needed to compute it.
 */
export function requireScheme(
  ruleset: Ruleset,
  schemeKey: string,
  requestedLabel: string,
):
  | { readonly ok: true; readonly scheme: Record<string, unknown> }
  | { readonly ok: false; readonly notice: ResultNotice } {
  const scheme = ruleset.rules.optionalSchemes[schemeKey];
  if (scheme && typeof scheme === 'object') {
    return { ok: true, scheme: scheme as Record<string, unknown> };
  }
  return {
    ok: false,
    notice: {
      severity: 'unsupported',
      message: `${requestedLabel} was selected, but the ${ruleset.taxPeriod.label} ruleset does not yet carry verified rules for it, so it has been left out of this calculation rather than estimated.`,
    },
  };
}

/**
 * Resolve a selected loan repayment scheme against the ruleset.
 *
 * Returns the selector for the engine to compute, or a notice explaining that
 * the rules for it have not been sourced. The one outcome this must never
 * produce is a silent zero: a reader who ticks "I have a student loan" and sees
 * no deduction would reasonably conclude they owe nothing.
 */
export function resolveLoanScheme(
  ruleset: Ruleset,
  selector: string,
  requestedLabel: string,
):
  | { readonly ok: true; readonly selector: string }
  | { readonly ok: false; readonly notice: ResultNotice } {
  const found = ruleset.rules.loanRepayments.some((scheme) => scheme.selector === selector);
  if (found) return { ok: true, selector };

  return {
    ok: false,
    notice: {
      severity: 'unsupported',
      message: `${requestedLabel} was selected, but the ${ruleset.taxPeriod.label} ruleset does not yet carry verified repayment thresholds for it. It has been left out of this calculation rather than estimated, so your real take-home pay will be lower than shown.`,
    },
  };
}

export function clampPercent(value: number, max = 100): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value > max ? max : value;
}
