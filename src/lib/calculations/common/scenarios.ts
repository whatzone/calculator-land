/**
 * Derived scenarios built on top of a jurisdiction's salary calculation.
 *
 * Each of these is a real comparison rather than a shortcut. A bonus is taxed by
 * calculating the year with and without it and taking the difference — never by
 * multiplying the bonus by a headline rate, which is wrong whenever the bonus
 * pushes income across a band, a taper, or a contribution ceiling.
 */
import { type Money, ZERO, clampAtZero, roundToMinorUnit, safeRatio } from './money.ts';
import { solveGrossForNet, type NetToGrossOutcome } from './net-to-gross.ts';
import type { CalculationInput, CalculationResult } from './types.ts';

export type SalaryCalculator = (input: CalculationInput) => CalculationResult;

export interface BonusResult {
  readonly withoutBonus: CalculationResult;
  readonly withBonus: CalculationResult;
  readonly bonusAmount: Money;
  /** Extra deducted purely because of the bonus. */
  readonly deductionsOnBonus: Money;
  /** Take-home increase from the bonus. */
  readonly bonusTakeHome: Money;
  /** Effective rate on the bonus alone, which usually exceeds the average rate. */
  readonly effectiveBonusRate: Money;
  readonly supported: boolean;
}

export function calculateBonus(
  calculate: SalaryCalculator,
  input: CalculationInput,
  bonusAmount: Money,
): BonusResult {
  const withoutBonus = calculate(input);
  const withBonus = calculate({
    ...input,
    grossAnnualIncome: input.grossAnnualIncome.plus(bonusAmount),
  });

  const supported = withoutBonus.supported && withBonus.supported;

  const bonusTakeHome = supported
    ? clampAtZero(withBonus.netAnnual.minus(withoutBonus.netAnnual))
    : ZERO;
  const deductionsOnBonus = supported
    ? clampAtZero(withBonus.totalDeductions.minus(withoutBonus.totalDeductions))
    : ZERO;

  return {
    withoutBonus,
    withBonus,
    bonusAmount,
    deductionsOnBonus: roundToMinorUnit(deductionsOnBonus),
    bonusTakeHome: roundToMinorUnit(bonusTakeHome),
    effectiveBonusRate: bonusAmount.eq(0) ? ZERO : safeRatio(deductionsOnBonus, bonusAmount),
    supported,
  };
}

export interface PayRiseResult {
  readonly before: CalculationResult;
  readonly after: CalculationResult;
  readonly grossIncrease: Money;
  readonly netIncrease: Money;
  /** Share of the gross rise that actually reaches the bank account. */
  readonly retentionRate: Money;
  readonly netMonthlyIncrease: Money;
  readonly supported: boolean;
}

export function calculatePayRise(
  calculate: SalaryCalculator,
  input: CalculationInput,
  newGrossAnnual: Money,
): PayRiseResult {
  const before = calculate(input);
  const after = calculate({ ...input, grossAnnualIncome: newGrossAnnual });

  const supported = before.supported && after.supported;
  const grossIncrease = newGrossAnnual.minus(input.grossAnnualIncome);
  const netIncrease = supported ? after.netAnnual.minus(before.netAnnual) : ZERO;

  return {
    before,
    after,
    grossIncrease: roundToMinorUnit(grossIncrease),
    netIncrease: roundToMinorUnit(netIncrease),
    retentionRate: grossIncrease.eq(0) ? ZERO : safeRatio(netIncrease, grossIncrease),
    netMonthlyIncrease: roundToMinorUnit(netIncrease.div(12)),
    supported,
  };
}

export interface NetToGrossResult {
  readonly outcome: NetToGrossOutcome;
  readonly targetNet: Money;
  /** Full breakdown at the solved gross, so the user can check the working. */
  readonly detail: CalculationResult | null;
  readonly supported: boolean;
}

export function calculateNetToGross(
  calculate: SalaryCalculator,
  input: CalculationInput,
  targetNetAnnual: Money,
): NetToGrossResult {
  // Probe once to establish whether the ruleset can answer at all, so that an
  // unpopulated ruleset reports its real reason instead of "did not converge".
  const probe = calculate({ ...input, grossAnnualIncome: targetNetAnnual });
  if (!probe.supported) {
    return {
      outcome: {
        ok: false,
        reason: probe.notices[0]?.message ?? 'This calculation is not supported.',
      },
      targetNet: targetNetAnnual,
      detail: probe,
      supported: false,
    };
  }

  const outcome = solveGrossForNet(
    targetNetAnnual,
    (gross) => calculate({ ...input, grossAnnualIncome: gross }).netAnnual,
  );

  return {
    outcome,
    targetNet: targetNetAnnual,
    detail: outcome.ok ? calculate({ ...input, grossAnnualIncome: outcome.gross }) : null,
    supported: outcome.ok,
  };
}
