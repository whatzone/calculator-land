import { describe, expect, it } from 'vitest';
import { money } from '../../src/lib/calculations/common/money.ts';
import { convertHourly } from '../../src/lib/calculations/global/hourly.ts';

const BASE = { hoursPerWeek: 40, weeksPerYear: 52, currency: 'GBP' as const };

describe('convertHourly', () => {
  it('converts an hourly rate to an annual figure', () => {
    const result = convertHourly({ ...BASE, amount: money(20), inputFrequency: 'hourly' });
    // 20 * 40 * 52
    expect(result.annual.toString()).toBe('41600');
    expect(result.weekly.toString()).toBe('800');
    expect(result.monthly.toString()).toBe('3466.67');
  });

  it('converts an annual figure back to an hourly rate', () => {
    const result = convertHourly({ ...BASE, amount: money(41600), inputFrequency: 'annual' });
    expect(result.hourly.toString()).toBe('20');
  });

  it('round-trips hourly to annual and back', () => {
    const annual = convertHourly({
      ...BASE,
      amount: money('17.53'),
      inputFrequency: 'hourly',
    }).annual;
    const hourly = convertHourly({ ...BASE, amount: annual, inputFrequency: 'annual' }).hourly;
    expect(hourly.toString()).toBe('17.53');
  });

  it('derives a daily rate from a five-day week', () => {
    expect(
      convertHourly({ ...BASE, amount: money(20), inputFrequency: 'hourly' }).daily.toString(),
    ).toBe('160');
  });

  it('handles part-time hours', () => {
    const result = convertHourly({
      ...BASE,
      hoursPerWeek: 15,
      amount: money(12),
      inputFrequency: 'hourly',
    });
    expect(result.annual.toString()).toBe('9360');
  });

  it('asks for input rather than dividing by zero', () => {
    const result = convertHourly({
      ...BASE,
      hoursPerWeek: 0,
      amount: money(20),
      inputFrequency: 'hourly',
    });
    expect(result.annual.toString()).toBe('0');
    expect(result.warnings.join(' ')).toMatch(/above zero/);
  });

  it('warns about implausible inputs but still computes', () => {
    const result = convertHourly({
      ...BASE,
      weeksPerYear: 60,
      amount: money(20),
      inputFrequency: 'hourly',
    });
    expect(result.warnings.join(' ')).toMatch(/at most 52 weeks/);
    expect(result.annual.gt(0)).toBe(true);
  });

  it('states plainly that the figures are before tax', () => {
    const result = convertHourly({ ...BASE, amount: money(20), inputFrequency: 'hourly' });
    expect(result.assumptions.join(' ')).toMatch(/gross figures before any tax/);
  });
});
