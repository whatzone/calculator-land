/**
 * Engine arithmetic, proved against hand-calculated expectations.
 *
 * Every expected value below is worked out longhand in the comment beside it.
 * The rulesets are the synthetic fixtures, not any real tax system, so these
 * tests prove the *engine* is correct independently of whether real rate tables
 * have been sourced yet.
 */
import { describe, expect, it } from 'vitest';
import { money } from '../../src/lib/calculations/common/money.ts';
import {
  runSalaryCalculation,
  netAnnualAt,
  type EngineOptions,
} from '../../src/lib/calculations/common/engine.ts';
import type { CalculationInput } from '../../src/lib/calculations/common/types.ts';
import {
  syntheticSimple,
  syntheticTapered,
  syntheticWithContributions,
  syntheticWithCredits,
} from '../fixtures/synthetic-rulesets.ts';
import type { Ruleset } from '../../src/lib/validation/ruleset-schema.ts';

function input(gross: number, overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    jurisdiction: 'uk',
    taxPeriod: 'SYNTHETIC',
    grossAnnualIncome: money(gross),
    payFrequency: 'annual',
    profile: {},
    ...overrides,
  };
}

function run(ruleset: Ruleset, gross: number, overrides: Partial<EngineOptions> = {}) {
  return runSalaryCalculation({ ruleset, input: input(gross), ...overrides });
}

describe('progressive income tax', () => {
  it('applies allowance then bands (gross 60,000)', () => {
    // allowance 10,000 -> taxable 50,000
    // 20,000 @10% = 2,000; 30,000 @20% = 6,000; nothing in the 50% band
    // total tax 8,000 -> net 52,000
    const result = run(syntheticSimple, 60000);
    expect(result.supported).toBe(true);
    expect(result.taxableIncome.toString()).toBe('50000');
    expect(result.totalDeductions.toString()).toBe('8000');
    expect(result.netAnnual.toString()).toBe('52000');
  });

  it('reaches the top band (gross 100,000)', () => {
    // taxable 90,000 -> 2,000 + 6,000 + 40,000 @50% = 20,000 -> 28,000
    const result = run(syntheticSimple, 100000);
    expect(result.totalDeductions.toString()).toBe('28000');
    expect(result.netAnnual.toString()).toBe('72000');
  });

  it('deducts nothing at or below the allowance', () => {
    expect(run(syntheticSimple, 10000).totalDeductions.toString()).toBe('0');
    expect(run(syntheticSimple, 0).netAnnual.toString()).toBe('0');
  });

  it('measures the marginal rate rather than reading the band rate', () => {
    // At 60,000 the next 100 falls in the 50% band.
    expect(run(syntheticSimple, 60000).marginalDeductionRate.toString()).toBe('0.5');
  });

  it('reports the average rate separately from the marginal rate', () => {
    const result = run(syntheticSimple, 60000);
    // 8,000 / 60,000
    expect(result.averageDeductionRate.round(6).toString()).toBe('0.133333');
    expect(result.marginalDeductionRate.toString()).toBe('0.5');
  });
});

describe('allowance taper', () => {
  it('withdraws the allowance above the threshold (gross 110,000)', () => {
    // allowance 10,000 - (110,000-100,000)/2 = 5,000 -> taxable 105,000
    // 2,000 + 6,000 + 55,000 @50% = 27,500 -> 35,500
    const result = run(syntheticTapered, 110000);
    expect(result.taxableIncome.toString()).toBe('105000');
    expect(result.totalDeductions.toString()).toBe('35500');
  });

  it('produces a marginal rate above the headline band rate inside the taper', () => {
    // Each extra 100 is taxed at 50% AND removes 50 of allowance, itself taxed
    // at 50%. The true marginal rate is 75%, not the 50% headline.
    expect(run(syntheticTapered, 110000).marginalDeductionRate.toString()).toBe('0.75');
  });

  it('returns to the headline rate once the allowance is fully withdrawn', () => {
    expect(run(syntheticTapered, 200000).marginalDeductionRate.toString()).toBe('0.5');
  });
});

describe('non-refundable credits', () => {
  it('reduces tax by the credit total (gross 50,000)', () => {
    // 40,000 @20% = 8,000; 10,000 @40% = 4,000 -> 12,000; credits 4,000 -> 8,000
    const result = run(syntheticWithCredits, 50000);
    expect(result.totalDeductions.toString()).toBe('8000');
  });

  it('never produces a refund from non-refundable credits', () => {
    // 10,000 @20% = 2,000 tax, credits 4,000 -> floored at zero, not -2,000
    const result = run(syntheticWithCredits, 10000);
    expect(result.totalDeductions.toString()).toBe('0');
    expect(result.netAnnual.toString()).toBe('10000');
  });
});

describe('levies and capped contributions', () => {
  it('itemises every charge separately (gross 50,000)', () => {
    // tax: taxable 40,000 -> 2,000 + 4,000 = 6,000
    // levy: 2% of (50,000 - 15,000) = 700
    // contribution: 28,000 @8% = 2,240 plus 10,000 @2% = 200 -> 2,440
    // total 9,140 -> net 40,860
    const result = run(syntheticWithContributions, 50000);
    expect(result.deductions.map((line) => line.id)).toEqual([
      'uk-income-tax',
      'uk-health-levy',
      'uk-social',
    ]);
    expect(result.totalDeductions.toString()).toBe('9140');
    expect(result.netAnnual.toString()).toBe('40860');
  });

  it('stops the contribution at its earnings ceiling (gross 70,000)', () => {
    // tax: taxable 60,000 -> 2,000 + 6,000 + 5,000 = 13,000
    // levy: 2% of 55,000 = 1,100
    // contribution capped at 60,000 earnings: 2,240 + 400 = 2,640
    // total 16,740 -> net 53,260
    const result = run(syntheticWithContributions, 70000);
    expect(result.totalDeductions.toString()).toBe('16740');
    expect(result.netAnnual.toString()).toBe('53260');
  });

  it('reflects the ceiling in the marginal rate', () => {
    // Above the ceiling the contribution stops, so marginal is 50% + 2% = 52%,
    // not 50% + 2% + 2%.
    expect(run(syntheticWithContributions, 70000).marginalDeductionRate.toString()).toBe('0.52');
  });

  it('exempts income below the contribution floor', () => {
    const result = run(syntheticWithContributions, 11000);
    expect(result.deductions.find((line) => line.id === 'uk-social')).toBeUndefined();
  });
});

describe('pay frequency presentation', () => {
  it('divides the annual net consistently', () => {
    const result = run(syntheticSimple, 52000);
    // taxable 42,000 -> 2,000 + 4,400 = 6,400 -> net 45,600
    expect(result.netAnnual.toString()).toBe('45600');
    expect(result.netMonthly.toString()).toBe('3800');
    expect(result.netWeekly.toString()).toBe('876.92');
    expect(result.netFortnightly.toString()).toBe('1753.85');
    expect(result.netBiweekly.toString()).toBe('1753.85');
  });

  it('labels every result as an annualised estimate', () => {
    expect(run(syntheticSimple, 50000).isAnnualisedEstimate).toBe(true);
  });

  it('produces an hourly figure only when hours and weeks are supplied', () => {
    expect(run(syntheticSimple, 52000).netHourly).toBeUndefined();
    const withHours = runSalaryCalculation({
      ruleset: syntheticSimple,
      input: input(52000, { hoursPerWeek: 40, weeksPerYear: 52 }),
    });
    // 45,600 / (40 * 52) = 21.923...
    expect(withHours.netHourly?.toString()).toBe('21.92');
  });
});

describe('pre-tax contributions', () => {
  it('reduces taxable income and appears as its own line', () => {
    const result = run(syntheticSimple, 60000, {
      preTaxContributions: [
        {
          id: 'pension',
          label: 'Pension (10%)',
          annualAmount: money(6000),
          explanation: 'test',
          sourceIds: ['synthetic-source'],
          reducesContributionBase: false,
        },
      ],
    });
    // income for tax 54,000 -> taxable 44,000 -> 2,000 + 4,800 = 6,800
    // deductions 6,800 tax + 6,000 pension = 12,800 -> net 47,200
    expect(result.taxableIncome.toString()).toBe('44000');
    expect(result.totalDeductions.toString()).toBe('12800');
    expect(result.netAnnual.toString()).toBe('47200');
    expect(result.deductions.find((line) => line.id === 'pension')?.isPreTaxContribution).toBe(
      true,
    );
  });

  it('only reduces the contribution base when the arrangement says so', () => {
    const notSacrificed = run(syntheticWithContributions, 50000, {
      preTaxContributions: [
        {
          id: 'pension',
          label: 'Pension',
          annualAmount: money(5000),
          explanation: 'test',
          sourceIds: [],
          reducesContributionBase: false,
        },
      ],
    });
    const sacrificed = run(syntheticWithContributions, 50000, {
      preTaxContributions: [
        {
          id: 'pension',
          label: 'Pension',
          annualAmount: money(5000),
          explanation: 'test',
          sourceIds: [],
          reducesContributionBase: true,
        },
      ],
    });
    const contributionOf = (r: ReturnType<typeof run>) =>
      r.deductions.find((line) => line.id === 'uk-social')?.annualAmount.toString();
    expect(contributionOf(notSacrificed)).toBe('2440');
    // Base drops to 45,000: 28,000 @8% = 2,240 plus 5,000 @2% = 100 -> 2,340
    expect(contributionOf(sacrificed)).toBe('2340');
  });
});

describe('audit trail', () => {
  it('gives every deduction line a source and an explanation', () => {
    const result = run(syntheticWithContributions, 60000);
    expect(result.deductions.length).toBeGreaterThan(0);
    for (const line of result.deductions) {
      expect(line.sourceIds.length).toBeGreaterThan(0);
      expect(line.explanation.length).toBeGreaterThan(10);
    }
  });

  it('shows per-band workings for the income tax line', () => {
    const workings = run(syntheticSimple, 60000).deductions[0]?.workings ?? [];
    expect(workings.map((w) => w.tax.toString())).toEqual(['2000', '6000']);
  });

  it('reports which thresholds the income has crossed', () => {
    const result = run(syntheticSimple, 30000);
    const crossed = result.thresholdsCrossed.filter((t) => t.crossed).map((t) => t.label);
    expect(crossed).toContain('Middle starts');
    expect(result.thresholdsCrossed.some((t) => t.label === 'Upper starts' && !t.crossed)).toBe(
      true,
    );
  });

  it('reports how much of the next increment is kept', () => {
    const result = run(syntheticSimple, 60000);
    expect(result.keptFromNextIncrement.increment.toString()).toBe('1000');
    // 50% band -> keeps 500 of the next 1,000
    expect(result.keptFromNextIncrement.kept.toString()).toBe('500');
    expect(result.keptFromNextIncrement.kptRatePercent.toString()).toBe('50');
  });
});

describe('refusal to guess', () => {
  it('returns unsupported for a ruleset that carries no figures', async () => {
    // Quebec: registered so its sources and reasoning are visible, but not
    // publishable, because its rules cannot yet be modelled correctly.
    const { canadaQuebec2026 } = await import('../../src/data/jurisdictions/canada/index.ts');
    const result = runSalaryCalculation({ ruleset: canadaQuebec2026, input: input(50000) });
    expect(result.supported).toBe(false);
    expect(result.netAnnual.toString()).toBe('0');
    expect(result.notices[0]?.severity).toBe('unsupported');
    expect(result.notices[0]?.message).toMatch(/not yet been verified against the official source/);
  });

  it('does calculate from an unverified ruleset, which is the published state', async () => {
    // Unverified figures are published deliberately, with a visible warning on
    // every page. The engine must produce a figure; the honesty is the UI's job
    // and is enforced separately against the built HTML.
    const { ukEnglandWalesNi } = await import('../../src/data/jurisdictions/uk/index.ts');
    const result = runSalaryCalculation({ ruleset: ukEnglandWalesNi, input: input(50000) });
    expect(result.supported).toBe(true);
    // £50,000: allowance £12,570, so £37,430 taxable at 20% = £7,486 tax,
    // plus National Insurance of 8% on the same £37,430 = £2,994.40.
    expect(result.netAnnual.toString()).toBe('39519.6');
  });

  it('rejects negative gross pay', () => {
    const result = runSalaryCalculation({ ruleset: syntheticSimple, input: input(-1) });
    expect(result.supported).toBe(false);
    expect(result.notices.some((n) => /cannot be negative/.test(n.message))).toBe(true);
  });
});

describe('netAnnualAt', () => {
  it('is the forward function used by the net-to-gross solver', () => {
    expect(
      netAnnualAt({ ruleset: syntheticSimple, input: input(0) }, money(60000)).toString(),
    ).toBe('52000');
  });
});
