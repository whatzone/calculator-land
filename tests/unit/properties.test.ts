/**
 * Property tests.
 *
 * These assert invariants that genuinely hold for the synthetic fixtures, which
 * were deliberately built without cliffs or refundable credits. Real rulesets
 * may contain both, so any of these properties must be re-justified — not
 * assumed — when a real jurisdiction is populated. See
 * docs/CALCULATION-METHODOLOGY.md.
 */
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { money } from '../../src/lib/calculations/common/money.ts';
import { runSalaryCalculation } from '../../src/lib/calculations/common/engine.ts';
import type { CalculationInput } from '../../src/lib/calculations/common/types.ts';
import { syntheticSimple, syntheticWithContributions } from '../fixtures/synthetic-rulesets.ts';
import type { Ruleset } from '../../src/lib/validation/ruleset-schema.ts';

const grossArb = fc.integer({ min: 0, max: 1_000_000 });

function calc(ruleset: Ruleset, gross: number) {
  const input: CalculationInput = {
    jurisdiction: 'uk',
    taxPeriod: 'SYNTHETIC',
    grossAnnualIncome: money(gross),
    payFrequency: 'annual',
    profile: {},
  };
  return runSalaryCalculation({ ruleset, input });
}

const RULESETS: readonly [string, Ruleset][] = [
  ['simple bands', syntheticSimple],
  ['bands with levy and capped contribution', syntheticWithContributions],
];

describe.each(RULESETS)('invariants: %s', (_name, ruleset) => {
  it('net pay plus deductions always equals gross pay', () => {
    fc.assert(
      fc.property(grossArb, (gross) => {
        const result = calc(ruleset, gross);
        const reconstructed = result.netAnnual.plus(result.totalDeductions);
        return reconstructed.minus(money(gross)).abs().lte(money('0.01'));
      }),
      { numRuns: 300 },
    );
  });

  it('never deducts more than gross pay', () => {
    fc.assert(
      fc.property(grossArb, (gross) => calc(ruleset, gross).totalDeductions.lte(money(gross))),
      { numRuns: 300 },
    );
  });

  it('never produces negative net pay or negative deductions', () => {
    fc.assert(
      fc.property(grossArb, (gross) => {
        const result = calc(ruleset, gross);
        return result.netAnnual.gte(0) && result.totalDeductions.gte(0);
      }),
      { numRuns: 300 },
    );
  });

  it('never produces a marginal rate outside 0–100%', () => {
    fc.assert(
      fc.property(grossArb, (gross) => {
        const rate = calc(ruleset, gross).marginalDeductionRate;
        return rate.gte(0) && rate.lte(1);
      }),
      { numRuns: 300 },
    );
  });

  it('is monotonic: earning more never reduces take-home pay', () => {
    // Holds for these fixtures because they contain no cliff. It is NOT a
    // universal truth about tax systems and must not be assumed for real data.
    fc.assert(
      fc.property(grossArb, fc.integer({ min: 1, max: 50_000 }), (gross, raise) => {
        const before = calc(ruleset, gross).netAnnual;
        const after = calc(ruleset, gross + raise).netAnnual;
        return after.gte(before);
      }),
      { numRuns: 200 },
    );
  });

  it('is deterministic: the same input always gives the same result', () => {
    fc.assert(
      fc.property(grossArb, (gross) => {
        const a = calc(ruleset, gross);
        const b = calc(ruleset, gross);
        return a.netAnnual.eq(b.netAnnual) && a.totalDeductions.eq(b.totalDeductions);
      }),
      { numRuns: 200 },
    );
  });

  it('never reports an average rate above the marginal rate under progressive bands', () => {
    fc.assert(
      fc.property(grossArb, (gross) => {
        const result = calc(ruleset, gross);
        return result.averageDeductionRate.lte(result.marginalDeductionRate.plus(money('0.0001')));
      }),
      { numRuns: 300 },
    );
  });
});
