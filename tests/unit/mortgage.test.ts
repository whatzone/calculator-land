import { describe, expect, it } from 'vitest';
import { money } from '../../src/lib/calculations/common/money.ts';
import {
  amortise,
  annualSummary,
  compareOverpayment,
  monthlyPayment,
} from '../../src/lib/calculations/global/mortgage.ts';

const LOAN = {
  principal: money(200000),
  annualRatePercent: money(5),
  termYears: 25,
};

describe('monthlyPayment', () => {
  it('matches the standard amortisation formula', () => {
    // r = 0.05/12 = 0.00416666...; n = 300
    // payment = 200000 * r / (1 - (1+r)^-300) = 1169.18 (2dp)
    expect(monthlyPayment(LOAN).toString()).toBe('1169.18');
  });

  it('handles zero interest as principal divided by term', () => {
    const payment = monthlyPayment({ ...LOAN, annualRatePercent: money(0) });
    // 200000 / 300
    expect(payment.toString()).toBe('666.67');
  });

  it('returns zero for a zero principal or zero term', () => {
    expect(monthlyPayment({ ...LOAN, principal: money(0) }).toString()).toBe('0');
    expect(monthlyPayment({ ...LOAN, termYears: 0 }).toString()).toBe('0');
  });
});

describe('amortise', () => {
  it('clears the balance to exactly zero on the final payment', () => {
    const result = amortise(LOAN);
    expect(result.schedule[result.schedule.length - 1]?.balance.toString()).toBe('0');
  });

  it('produces one row per scheduled payment', () => {
    expect(amortise(LOAN).numberOfPayments).toBe(300);
  });

  it('splits every payment into interest plus principal exactly', () => {
    for (const row of amortise(LOAN).schedule) {
      expect(row.interest.plus(row.principal).minus(row.payment).abs().lte(money('0.01'))).toBe(
        true,
      );
    }
  });

  it('charges more interest at the start than at the end', () => {
    const schedule = amortise(LOAN).schedule;
    const first = schedule[0];
    const last = schedule[schedule.length - 1];
    expect(first && last && first.interest.gt(last.interest)).toBe(true);
  });

  it('totals interest plus principal to the total paid', () => {
    const result = amortise(LOAN);
    expect(
      result.totalInterest.plus(money(200000)).minus(result.totalPaid).abs().lte(money('0.05')),
    ).toBe(true);
  });

  it('charges no interest at all at a zero rate', () => {
    const result = amortise({ ...LOAN, annualRatePercent: money(0) });
    expect(result.totalInterest.toString()).toBe('0');
    expect(result.totalPaid.toString()).toBe('200000');
  });

  it('warns instead of looping when the payment cannot cover the interest', () => {
    const result = amortise(LOAN, money(100));
    expect(result.numberOfPayments).toBe(0);
    expect(result.warnings.join(' ')).toMatch(/not large enough to cover the interest/);
  });

  it('rejects a negative rate rather than producing nonsense', () => {
    const result = amortise({ ...LOAN, annualRatePercent: money(-1) });
    expect(result.warnings.join(' ')).toMatch(/negative interest rate is not supported/);
  });

  it('asks for input rather than computing on an empty loan', () => {
    expect(amortise({ ...LOAN, principal: money(0) }).warnings.join(' ')).toMatch(/above zero/);
    expect(amortise({ ...LOAN, termYears: 0 }).warnings.join(' ')).toMatch(/at least one year/);
  });
});

describe('annualSummary', () => {
  it('condenses the schedule to one row per year', () => {
    const result = amortise(LOAN);
    const years = annualSummary(result);
    expect(years).toHaveLength(25);
    expect(years[24]?.balance.toString()).toBe('0');
  });
});

describe('compareOverpayment', () => {
  it('shortens the term and saves interest', () => {
    const result = compareOverpayment({ ...LOAN, monthlyOverpayment: money(200) });
    expect(result.withOverpayment.numberOfPayments).toBeLessThan(result.baseline.numberOfPayments);
    expect(result.interestSaved.gt(0)).toBe(true);
    expect(result.periodsSaved).toBe(
      result.baseline.numberOfPayments - result.withOverpayment.numberOfPayments,
    );
  });

  it('expresses the saving in years and months', () => {
    const result = compareOverpayment({ ...LOAN, monthlyOverpayment: money(200) });
    expect(result.yearsSaved * 12 + result.monthsSaved).toBe(result.periodsSaved);
  });

  it('applies a lump sum before the schedule starts', () => {
    const result = compareOverpayment({ ...LOAN, lumpSum: money(20000) });
    expect(result.withOverpayment.numberOfPayments).toBeLessThan(result.baseline.numberOfPayments);
  });

  it('changes nothing when there is no overpayment', () => {
    const result = compareOverpayment(LOAN);
    expect(result.periodsSaved).toBe(0);
    expect(result.interestSaved.toString()).toBe('0');
  });

  it('warns when a lump sum clears the whole balance', () => {
    const result = compareOverpayment({ ...LOAN, lumpSum: money(200000) });
    expect(result.warnings.join(' ')).toMatch(/covers the whole balance/);
  });

  it('never claims a negative saving', () => {
    expect(compareOverpayment(LOAN).interestSaved.gte(0)).toBe(true);
  });
});
