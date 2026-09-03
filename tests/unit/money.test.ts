import { describe, expect, it } from 'vitest';
import {
  clamp,
  clampAtZero,
  floorToMultiple,
  money,
  percentOf,
  roundToMinorUnit,
  roundToUnit,
  Rounding,
  safeRatio,
  sum,
} from '../../src/lib/calculations/common/money.ts';

describe('money', () => {
  it('does not suffer binary floating-point drift', () => {
    expect(money('0.1').plus(money('0.2')).toString()).toBe('0.3');
    // The equivalent native expression does not hold, which is why this layer exists.
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('sums an empty list to zero rather than throwing', () => {
    expect(sum([]).toString()).toBe('0');
  });

  it('keeps a 52-way split accurate to far below a penny', () => {
    // 50000/52 is a repeating decimal, so a residue at the 20th decimal place is
    // expected and correct. What matters is that it is orders of magnitude
    // smaller than the smallest unit of currency anyone is ever shown.
    const weekly = money(50000).div(52);
    const residue = weekly.times(52).minus(money(50000)).abs();
    expect(residue.lt(money('0.0000000001'))).toBe(true);
    expect(roundToMinorUnit(weekly.times(52)).toString()).toBe('50000');
  });

  it('clamps at zero', () => {
    expect(clampAtZero(money(-5)).toString()).toBe('0');
    expect(clampAtZero(money(5)).toString()).toBe('5');
  });

  it('clamps to a range', () => {
    expect(clamp(money(15), money(0), money(10)).toString()).toBe('10');
    expect(clamp(money(-1), money(0), money(10)).toString()).toBe('0');
    expect(clamp(money(5), money(0), money(10)).toString()).toBe('5');
  });

  it('rounds half up by default and down when asked', () => {
    expect(roundToMinorUnit(money('1.005')).toString()).toBe('1.01');
    expect(roundToUnit(money('1.99'), Rounding.DOWN).toString()).toBe('1');
    expect(roundToUnit(money('1.5'), Rounding.HALF_UP).toString()).toBe('2');
  });

  it('floors to a multiple', () => {
    expect(floorToMultiple(money(1234), money(100)).toString()).toBe('1200');
    expect(() => floorToMultiple(money(10), money(0))).toThrow();
  });

  it('computes percentages exactly', () => {
    expect(percentOf(money(50000), 20).toString()).toBe('10000');
    expect(percentOf(money('1234.56'), '12.5').toString()).toBe('154.32');
  });

  it('returns zero for a ratio with a zero denominator', () => {
    expect(safeRatio(money(100), money(0)).toString()).toBe('0');
  });
});
