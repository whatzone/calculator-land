/**
 * The rule shapes added so that real tax systems can be expressed faithfully.
 *
 * Each of these exists because a real jurisdiction needs it and the engine
 * previously could not express it, which would have forced an approximation at
 * data-entry time. All figures below are synthetic; the point is the arithmetic.
 */
import { describe, expect, it } from 'vitest';
import { money } from '../../src/lib/calculations/common/money.ts';
import { runSalaryCalculation } from '../../src/lib/calculations/common/engine.ts';
import { syntheticFullFeatured } from '../fixtures/synthetic-rulesets.ts';
import {
  applySurtax,
  levyAmount,
  loanRepaymentAmount,
  taperAllowance,
  toBands,
} from '../../src/lib/calculations/common/brackets.ts';

describe('taperAllowance with a floor', () => {
  // Canada's federal basic personal amount tapers down to a minimum and stops.
  const taperToFloor = (income: number) =>
    taperAllowance(money(16000), money(income), money(170000), money('0.05'), money(14000));

  it('leaves the allowance intact below the threshold', () => {
    expect(taperToFloor(150000).toString()).toBe('16000');
  });

  it('tapers between the threshold and the floor', () => {
    // 20,000 above the threshold at 0.05 removes 1,000.
    expect(taperToFloor(190000).toString()).toBe('15000');
  });

  it('stops at the floor rather than continuing to zero', () => {
    expect(taperToFloor(250000).toString()).toBe('14000');
    expect(taperToFloor(10_000_000).toString()).toBe('14000');
  });

  it('still tapers to zero when no floor is given', () => {
    expect(
      taperAllowance(money(10000), money(500000), money(100000), money('0.5')).toString(),
    ).toBe('0');
  });
});

describe('levyAmount', () => {
  // The shape of Australia's Medicare levy: exempt, then a shade-in band, then
  // a rate on the whole of income rather than on the part above a threshold.
  const medicareShaped = (income: number) =>
    levyAmount({
      income: money(income),
      ratePercent: money(2),
      basis: 'whole-income',
      floor: money(0),
      ceiling: null,
      exemptBelow: money(27000),
      phaseInTo: money(33750),
      phaseInRatePercent: money(10),
    });

  it('charges nothing at or below the exemption', () => {
    expect(medicareShaped(20000).toString()).toBe('0');
    expect(medicareShaped(27000).toString()).toBe('0');
  });

  it('charges the shade-in rate on the excess inside the phase-in band', () => {
    // (30,000 - 27,000) at 10% = 300.
    expect(medicareShaped(30000).toString()).toBe('300');
  });

  it('charges the full rate on the whole of income above the phase-in', () => {
    // 2% of 40,000, not 2% of (40,000 - 27,000).
    expect(medicareShaped(40000).toString()).toBe('800');
  });

  it('meets the phase-in and full rates at the crossover', () => {
    // At the top of the shade-in the two methods must agree, or the levy would
    // jump or drop at that income.
    const justBelow = medicareShaped(33749);
    const atTop = medicareShaped(33750);
    expect(atTop.minus(justBelow).abs().lte(money(1))).toBe(true);
  });

  it('still supports the simpler above-floor basis', () => {
    const amount = levyAmount({
      income: money(20000),
      ratePercent: money(2),
      basis: 'above-floor',
      floor: money(15000),
      ceiling: null,
      exemptBelow: money(0),
      phaseInTo: null,
      phaseInRatePercent: null,
    });
    expect(amount.toString()).toBe('100');
  });

  it('respects a ceiling', () => {
    const amount = levyAmount({
      income: money(100000),
      ratePercent: money(2),
      basis: 'whole-income',
      floor: money(0),
      ceiling: money(50000),
      exemptBelow: money(0),
      phaseInTo: null,
      phaseInRatePercent: null,
    });
    expect(amount.toString()).toBe('1000');
  });
});

describe('applySurtax', () => {
  // Ontario's shape: a percentage of provincial tax above set amounts of tax.
  const bands = toBands([
    { label: 'None', from: 0, to: 5500, ratePercent: 0 },
    { label: 'First surtax', from: 5500, to: 7000, ratePercent: 20 },
    { label: 'Second surtax', from: 7000, to: null, ratePercent: 56 },
  ]);

  it('charges nothing below the first threshold', () => {
    expect(applySurtax(money(4000), bands).total.toString()).toBe('0');
  });

  it('charges on the tax, not on income', () => {
    // (6,000 - 5,500) at 20% = 100.
    expect(applySurtax(money(6000), bands).total.toString()).toBe('100');
  });

  it('stacks both surtax bands', () => {
    // 1,500 at 20% = 300, plus 3,000 at 56% = 1,680.
    expect(applySurtax(money(10000), bands).total.toString()).toBe('1980');
  });

  it('shows its working per band, including the band that charges nothing', () => {
    // The nil band is kept deliberately: on a page whose whole purpose is
    // showing the working, "the first 5,500 of tax attracts no surtax" is the
    // line that explains the result, not noise.
    const workings = applySurtax(money(10000), bands).workings;
    expect(workings.map((w) => `${w.label}: ${w.tax.toString()}`)).toEqual([
      'None: 0',
      'First surtax: 300',
      'Second surtax: 1680',
    ]);
  });
});

describe('loanRepaymentAmount', () => {
  it('charges a rate on income above the threshold', () => {
    // The UK and New Zealand shape: 9% of the excess only.
    const amount = loanRepaymentAmount({
      income: money(30000),
      method: 'rate-above-threshold',
      threshold: money(25000),
      ratePercent: money(9),
      bands: [],
    });
    expect(amount.toString()).toBe('450');
  });

  it('repays nothing below the threshold', () => {
    const amount = loanRepaymentAmount({
      income: money(20000),
      method: 'rate-above-threshold',
      threshold: money(25000),
      ratePercent: money(9),
      bands: [],
    });
    expect(amount.toString()).toBe('0');
  });

  it('applies a banded rate to the whole of income', () => {
    // The Australian shape. At 60,000 the 2% band applies to all 60,000,
    // not to the part above the band's lower edge.
    const bands = toBands([
      { label: 'Nil', from: 0, to: 50000, ratePercent: 0 },
      { label: 'First', from: 50000, to: 70000, ratePercent: 2 },
      { label: 'Second', from: 70000, to: null, ratePercent: 5 },
    ]);
    const at = (income: number) =>
      loanRepaymentAmount({
        income: money(income),
        method: 'banded-rate-on-total',
        threshold: money(0),
        ratePercent: money(0),
        bands,
      });

    expect(at(40000).toString()).toBe('0');
    expect(at(60000).toString()).toBe('1200');
    expect(at(80000).toString()).toBe('4000');
  });

  it('steps sharply at a band boundary, which the threshold method never does', () => {
    // This is the behaviour that makes the two methods non-interchangeable:
    // one more pound of income can cost hundreds. Modelling one as the other
    // would understate the repayment for everyone just above a boundary.
    const bands = toBands([
      { label: 'Nil', from: 0, to: 50000, ratePercent: 0 },
      { label: 'First', from: 50000, to: null, ratePercent: 2 },
    ]);
    const at = (income: number) =>
      loanRepaymentAmount({
        income: money(income),
        method: 'banded-rate-on-total',
        threshold: money(0),
        ratePercent: money(0),
        bands,
      });

    expect(at(49999).toString()).toBe('0');
    expect(at(50000).toString()).toBe('1000');
  });
});

describe('a fully populated ruleset, end to end', () => {
  // Every expected figure is worked out longhand in the comments, so a reviewer
  // can check the arithmetic rather than trust the total.
  const run = (gross: number, loanSelectors: readonly string[] = []) =>
    runSalaryCalculation({
      ruleset: syntheticFullFeatured,
      loanSelectors,
      input: {
        jurisdiction: 'uk',
        taxPeriod: 'SYNTHETIC',
        grossAnnualIncome: money(gross),
        payFrequency: 'annual',
        profile: {},
      },
    });

  it('combines every rule shape at a middling income', () => {
    // gross 40,000
    //   allowance 10,000 (below the taper) -> taxable 30,000
    //   tax 20,000 @10% = 2,000, plus 10,000 @20% = 2,000 -> 4,000
    //   surtax: 4,000 is below the 6,000 nil band -> 0
    //   levy: above the phase-in, 2% of the whole 40,000 -> 800
    //   contribution: 28,000 @8% -> 2,240
    //   total 7,040 -> net 32,960
    const result = run(40000);
    expect(result.supported).toBe(true);
    expect(result.totalDeductions.toString()).toBe('7040');
    expect(result.netAnnual.toString()).toBe('32960');
  });

  it('charges the surtax once tax passes its threshold', () => {
    // gross 70,000
    //   allowance 10,000 -> taxable 60,000
    //   tax 2,000 + 6,000 + 10,000 @40% = 4,000 -> 12,000
    //   surtax: (12,000 - 6,000) @25% -> 1,500
    //   levy: 2% of 70,000 -> 1,400
    //   contribution: capped at 60,000 earnings, 48,000 @8% -> 3,840
    //   total 18,740 -> net 51,260
    const result = run(70000);
    expect(result.deductions.map((line) => line.label)).toContain('Surtax');
    expect(result.totalDeductions.toString()).toBe('18740');
    expect(result.netAnnual.toString()).toBe('51260');
  });

  it('holds the allowance at its floor for very high earners', () => {
    // gross 200,000: taper would remove 60,000 of a 10,000 allowance, so the
    // floor of 4,000 holds -> taxable 196,000.
    expect(run(200000).taxableIncome.toString()).toBe('196000');
  });

  it('applies the shade-in rate inside the phase-in band', () => {
    // gross 28,000: (28,000 - 25,000) @10% -> 300, not 2% of 28,000.
    const levy = run(28000).deductions.find((line) => line.label === 'Health levy');
    expect(levy?.annualAmount.toString()).toBe('300');
  });

  it('deducts a loan repayment only when the reader selected it', () => {
    const without = run(40000);
    const with_ = run(40000, ['plan-a']);
    // (40,000 - 25,000) @9% -> 1,350
    expect(with_.totalDeductions.minus(without.totalDeductions).toString()).toBe('1350');
    expect(with_.deductions.map((line) => line.label)).toContain('Study loan repayment');
  });

  it('ignores a selector the ruleset does not carry', () => {
    // The adapter raises the notice; the engine must not invent a deduction.
    const result = run(40000, ['plan-that-does-not-exist']);
    expect(result.totalDeductions.toString()).toBe('7040');
  });

  it('reports a marginal rate that reflects every charge at once', () => {
    // At 70,000: 40% tax, plus 25% surtax on that 40% (10 points), plus 2% levy
    // on the whole increment, with the contribution already capped.
    expect(run(70000).marginalDeductionRate.toString()).toBe('0.52');
  });
});
