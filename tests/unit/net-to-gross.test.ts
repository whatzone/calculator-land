import { describe, expect, it } from 'vitest';
import { money } from '../../src/lib/calculations/common/money.ts';
import { solveGrossForNet } from '../../src/lib/calculations/common/net-to-gross.ts';
import { netAnnualAt } from '../../src/lib/calculations/common/engine.ts';
import type { CalculationInput } from '../../src/lib/calculations/common/types.ts';
import { syntheticSimple, syntheticWithContributions } from '../fixtures/synthetic-rulesets.ts';

const baseInput: CalculationInput = {
  jurisdiction: 'uk',
  taxPeriod: 'SYNTHETIC',
  grossAnnualIncome: money(0),
  payFrequency: 'annual',
  profile: {},
};

const netFor = (ruleset: typeof syntheticSimple) => (gross: ReturnType<typeof money>) =>
  netAnnualAt({ ruleset, input: baseInput }, gross);

describe('solveGrossForNet', () => {
  it('inverts the forward calculation exactly at a known point', () => {
    // Forward: 60,000 gross -> 52,000 net. The inverse must return 60,000.
    const outcome = solveGrossForNet(money(52000), netFor(syntheticSimple));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.gross.round(2).toString()).toBe('60000');
  });

  it('round-trips across a wide range of targets', () => {
    for (const gross of [5000, 12000, 25000, 45000, 80000, 250000]) {
      const targetNet = netFor(syntheticSimple)(money(gross));
      const outcome = solveGrossForNet(targetNet, netFor(syntheticSimple));
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.gross.minus(money(gross)).abs().lt(money('0.05'))).toBe(true);
      }
    }
  });

  it('inverts a system with levies and capped contributions', () => {
    const targetNet = netFor(syntheticWithContributions)(money(70000));
    const outcome = solveGrossForNet(targetNet, netFor(syntheticWithContributions));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.gross.minus(money(70000)).abs().lt(money('0.05'))).toBe(true);
  });

  it('returns zero gross for zero net without iterating', () => {
    const outcome = solveGrossForNet(money(0), netFor(syntheticSimple));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.gross.toString()).toBe('0');
      expect(outcome.iterations).toBe(0);
    }
  });

  it('refuses a negative target rather than returning a negative gross', () => {
    const outcome = solveGrossForNet(money(-100), netFor(syntheticSimple));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toMatch(/cannot be negative/);
  });

  it('reports rather than guesses when the target exceeds the searchable range', () => {
    // A system that never pays out more than 1,000 net cannot reach 5,000.
    const capped = () => money(1000);
    const outcome = solveGrossForNet(money(5000), capped);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toMatch(/outside the supported range/);
  });

  it('stays within its iteration budget', () => {
    const outcome = solveGrossForNet(money(43210.55), netFor(syntheticWithContributions));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.iterations).toBeLessThanOrEqual(200);
  });
});
