/**
 * Income-contingent loan repayments, against the real rate tables.
 *
 * Every figure asserted here is worked out longhand in a comment above it, so
 * a reviewer can check the arithmetic rather than trust the total. The
 * thresholds themselves are unverified against the authority — see
 * docs/RATE-AMBIGUITIES.md — but the arithmetic applied to them is not.
 */
import { describe, expect, it } from 'vitest';
import { money } from '../../src/lib/calculations/common/money.ts';
import { calculateUkSalary } from '../../src/lib/calculations/uk/index.ts';
import { calculateAustraliaSalary } from '../../src/lib/calculations/australia/index.ts';
import { loanRepaymentAmount, toBands } from '../../src/lib/calculations/common/brackets.ts';
import { contextFor } from '../../src/lib/registry/index.ts';
import type {
  CalculationInput,
  CalculationResult,
} from '../../src/lib/calculations/common/types.ts';

function uk(
  grossAnnualIncome: number,
  profile: Record<string, unknown>,
  taxPeriod = '2025/26',
  subJurisdiction: string | null = 'england-wales-ni',
): CalculationResult {
  const context = contextFor('uk');
  return calculateUkSalary({
    grossAnnualIncome: money(grossAnnualIncome),
    jurisdiction: 'uk',
    subJurisdiction,
    taxPeriod,
    frequency: 'annual',
    locale: context.locale,
    currency: context.currency,
    profile,
  } as unknown as CalculationInput);
}

function au(grossAnnualIncome: number, taxPeriod: string, hasHelpDebt = true): CalculationResult {
  const context = contextFor('australia');
  return calculateAustraliaSalary({
    grossAnnualIncome: money(grossAnnualIncome),
    jurisdiction: 'australia',
    subJurisdiction: null,
    taxPeriod,
    frequency: 'annual',
    locale: context.locale,
    currency: context.currency,
    profile: { hasHelpDebt },
  } as unknown as CalculationInput);
}

const loanLines = (result: CalculationResult) =>
  result.deductions.filter((line) => /student-loan|postgraduate|help/.test(line.id));

const loanTotal = (result: CalculationResult) =>
  loanLines(result).reduce((sum, line) => sum.plus(line.annualAmount), money(0));

describe('UK student loan plans', () => {
  it('repays 9% of income above each plan threshold', () => {
    // 2025/26 thresholds. At £50,000:
    //   Plan 1: (50,000 - 26,065) x 9% = 2,154.15
    //   Plan 2: (50,000 - 28,470) x 9% = 1,937.70
    //   Plan 4: (50,000 - 32,745) x 9% = 1,552.95
    //   Plan 5: (50,000 - 25,000) x 9% = 2,250.00
    const expected: Record<string, string> = {
      'plan-1': '2154.15',
      'plan-2': '1937.7',
      'plan-4': '1552.95',
      'plan-5': '2250',
    };
    for (const [plan, amount] of Object.entries(expected)) {
      expect(loanTotal(uk(50000, { studentLoanPlan: plan })).toString(), plan).toBe(amount);
    }
  });

  it('repays nothing below the threshold, and one pound above it repays 9p', () => {
    expect(loanTotal(uk(28470, { studentLoanPlan: 'plan-2' })).toString()).toBe('0');
    expect(loanTotal(uk(28471, { studentLoanPlan: 'plan-2' })).toString()).toBe('0.09');
  });

  it('charges a postgraduate loan on top of an undergraduate plan, not instead of it', () => {
    // Plan 2 at £50,000 is £1,937.70; the postgraduate loan is
    // (50,000 - 21,000) x 6% = 1,740. Someone with both repays both.
    const both = uk(50000, { studentLoanPlan: 'plan-2', hasPostgraduateLoan: true });
    expect(loanLines(both)).toHaveLength(2);
    expect(loanTotal(both).toString()).toBe('3677.7');

    const postgraduateOnly = uk(50000, { studentLoanPlan: 'none', hasPostgraduateLoan: true });
    expect(loanTotal(postgraduateOnly).toString()).toBe('1740');
  });

  it('reduces take-home pay by exactly the repayment', () => {
    // £50,000 with no loan nets £39,519.60. Plan 2 takes £1,937.70 of that.
    const without = uk(50000, { studentLoanPlan: 'none' });
    const with2 = uk(50000, { studentLoanPlan: 'plan-2' });
    expect(without.netAnnual.minus(with2.netAnnual).toString()).toBe('1937.7');
  });

  it('uses the threshold for the year being asked about', () => {
    // Plan 1 rose from £24,990 in 2024/25 to £26,065 in 2025/26, so the same
    // salary repays £96.75 less in the later year:
    //   (26,065 - 24,990) x 9% = 96.75
    const older = loanTotal(uk(50000, { studentLoanPlan: 'plan-1' }, '2024/25'));
    const newer = loanTotal(uk(50000, { studentLoanPlan: 'plan-1' }, '2025/26'));
    expect(older.minus(newer).toString()).toBe('96.75');
  });

  it('offers every plan in Scotland too, because the plan follows the borrower', () => {
    // Plan 4 is the Scottish student loan, but someone who studied in Scotland
    // and now lives in England still repays Plan 4 — and vice versa.
    const scotland = loanTotal(uk(50000, { studentLoanPlan: 'plan-4' }, '2025/26', 'scotland'));
    const england = loanTotal(uk(50000, { studentLoanPlan: 'plan-4' }, '2025/26'));
    expect(scotland.toString()).toBe('1552.95');
    expect(england.toString()).toBe('1552.95');
  });

  it('never repays anything when no loan is selected', () => {
    expect(loanLines(uk(200000, { studentLoanPlan: 'none' }))).toEqual([]);
  });

  it('warns rather than silently ignoring a plan the year does not carry', () => {
    const result = uk(50000, { studentLoanPlan: 'plan-9' });
    expect(loanLines(result)).toEqual([]);
    expect(result.notices.some((notice) => notice.severity === 'unsupported')).toBe(true);
  });
});

describe('Australian HELP repayments', () => {
  it('applies the band rate to the whole of income before July 2025', () => {
    // 2024-25 is the old scale. £70,000 falls in the 66,621-70,619 band at
    // 2.5%, and that rate applies to all of it: 70,000 x 2.5% = 1,750.
    expect(loanTotal(au(70000, '2024-25')).toString()).toBe('1750');
  });

  it('steps sharply at a band edge under the old scale', () => {
    // The defining flaw of the whole-income method: at 62,851 the rate moves
    // from 1% to 2%, and the new rate applies to everything.
    //   62,850 x 1% =   628.50
    //   62,851 x 2% = 1,257.02
    // So one extra dollar of income costs 628.52 more in repayment.
    const below = loanTotal(au(62850, '2024-25'));
    const above = loanTotal(au(62851, '2024-25'));
    expect(above.minus(below).toString()).toBe('628.52');
  });

  it('charges only on income above the threshold from 2025-26', () => {
    // The marginal scale: nothing below 67,000, then 15% of the next 58,000
    // and 17% beyond that.
    expect(loanTotal(au(67000, '2025-26')).toString()).toBe('0');
    // (70,000 - 67,000) x 15% = 450
    expect(loanTotal(au(70000, '2025-26')).toString()).toBe('450');
    // 58,000 x 15% + (130,000 - 67,000 - 58,000) x 17% = 8,700 + 850 = 9,550
    expect(loanTotal(au(130000, '2025-26')).toString()).toBe('9550');
  });

  it('never steps under the marginal scale', () => {
    // The whole reason the system changed: one more dollar can never cost more
    // than the top rate on that dollar.
    for (const edge of [67000, 125000]) {
      const step = loanTotal(au(edge + 1, '2025-26')).minus(loanTotal(au(edge, '2025-26')));
      expect(step.lte(money(1)), `no cliff at ${edge}`).toBe(true);
    }
  });

  it('repays nothing when there is no debt to repay', () => {
    expect(loanLines(au(130000, '2025-26', false))).toEqual([]);
  });
});

describe('the three loan methods are not interchangeable', () => {
  // Same income, same threshold, same headline rates — three different answers.
  // This is why the method is stored per scheme rather than assumed.
  const income = money(100000);
  const bands = toBands([
    { label: 'First', from: 0, to: 50000, ratePercent: 5 },
    { label: 'Top', from: 50000, to: null, ratePercent: 10 },
  ]);

  it('rate-above-threshold charges one rate on the excess', () => {
    // (100,000 - 40,000) x 10% = 6,000
    const amount = loanRepaymentAmount({
      income,
      method: 'rate-above-threshold',
      threshold: money(40000),
      ratePercent: money(10),
      bands: [],
    });
    expect(amount.toString()).toBe('6000');
  });

  it('banded-rate-on-total charges the band rate on everything', () => {
    // 100,000 is in the top band, so 10% of all of it = 10,000.
    const amount = loanRepaymentAmount({
      income,
      method: 'banded-rate-on-total',
      threshold: money(40000),
      ratePercent: money(0),
      bands,
    });
    expect(amount.toString()).toBe('10000');
  });

  it('marginal-bands charges each rate on its own slice above the threshold', () => {
    // 60,000 above the threshold: 50,000 x 5% + 10,000 x 10% = 2,500 + 1,000.
    const amount = loanRepaymentAmount({
      income,
      method: 'marginal-bands',
      threshold: money(40000),
      ratePercent: money(0),
      bands,
    });
    expect(amount.toString()).toBe('3500');
  });
});
