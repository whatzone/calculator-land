import { describe, expect, it } from 'vitest';
import { money } from '../../src/lib/calculations/common/money.ts';
import {
  applyBands,
  levyOnRange,
  marginalBandRatePercent,
  taperAllowance,
  toBands,
  validateBands,
} from '../../src/lib/calculations/common/brackets.ts';

const BANDS = toBands([
  { label: 'Lower', from: 0, to: 20000, ratePercent: 10 },
  { label: 'Middle', from: 20000, to: 50000, ratePercent: 20 },
  { label: 'Upper', from: 50000, to: null, ratePercent: 50 },
]);

describe('applyBands', () => {
  it('taxes only the slice inside each band', () => {
    // 20,000 @10% = 2,000; 30,000 @20% = 6,000; 10,000 @50% = 5,000
    expect(applyBands(money(60000), BANDS).total.toString()).toBe('13000');
  });

  it('returns zero for zero income', () => {
    expect(applyBands(money(0), BANDS).total.toString()).toBe('0');
  });

  it('treats negative income as zero rather than producing negative tax', () => {
    expect(applyBands(money(-5000), BANDS).total.toString()).toBe('0');
  });

  it.each([
    [19999, '1999.9'],
    [20000, '2000'],
    [20001, '2000.2'],
    [49999, '7999.8'],
    [50000, '8000'],
    [50001, '8000.5'],
  ])('is exact immediately below, at, and above a boundary (%i)', (income, expected) => {
    expect(applyBands(money(income), BANDS).total.toString()).toBe(expected);
  });

  it('produces one working per band actually used', () => {
    expect(applyBands(money(15000), BANDS).workings).toHaveLength(1);
    expect(applyBands(money(35000), BANDS).workings).toHaveLength(2);
    expect(applyBands(money(60000), BANDS).workings).toHaveLength(3);
  });
});

describe('marginalBandRatePercent', () => {
  it.each([
    [0, '10'],
    [19999, '10'],
    [20000, '20'],
    [49999, '20'],
    [50000, '50'],
    [1000000, '50'],
  ])('reports the band containing %i', (income, expected) => {
    expect(marginalBandRatePercent(money(income), BANDS).toString()).toBe(expected);
  });
});

describe('validateBands', () => {
  it('accepts contiguous ascending bands ending unbounded', () => {
    expect(validateBands(BANDS)).toEqual([]);
  });

  it('rejects an empty band list', () => {
    expect(validateBands([])).toContain('no bands defined');
  });

  it('detects a gap between bands', () => {
    const broken = toBands([
      { label: 'A', from: 0, to: 10000, ratePercent: 10 },
      { label: 'B', from: 20000, to: null, ratePercent: 20 },
    ]);
    expect(validateBands(broken).join(' ')).toMatch(/gap or overlap/);
  });

  it('detects a bounded final band', () => {
    const broken = toBands([{ label: 'A', from: 0, to: 10000, ratePercent: 10 }]);
    expect(validateBands(broken).join(' ')).toMatch(/must be unbounded above/);
  });

  it('detects an implausible rate', () => {
    const broken = toBands([{ label: 'A', from: 0, to: null, ratePercent: 250 }]);
    expect(validateBands(broken).join(' ')).toMatch(/implausible rate/);
  });
});

describe('taperAllowance', () => {
  it('leaves the allowance intact below the threshold', () => {
    expect(taperAllowance(money(10000), money(90000), money(100000), money('0.5')).toString()).toBe(
      '10000',
    );
  });

  it('withdraws one unit for every two above the threshold', () => {
    expect(
      taperAllowance(money(10000), money(110000), money(100000), money('0.5')).toString(),
    ).toBe('5000');
  });

  it('never goes below zero', () => {
    expect(
      taperAllowance(money(10000), money(500000), money(100000), money('0.5')).toString(),
    ).toBe('0');
  });

  it('is exactly zero at full withdrawal', () => {
    expect(
      taperAllowance(money(10000), money(120000), money(100000), money('0.5')).toString(),
    ).toBe('0');
  });
});

describe('levyOnRange', () => {
  it('charges only above the floor', () => {
    expect(levyOnRange(money(20000), money(2), money(15000), null).toString()).toBe('100');
  });

  it('stops at the ceiling', () => {
    expect(levyOnRange(money(100000), money(2), money(0), money(50000)).toString()).toBe('1000');
  });

  it('is zero below the floor', () => {
    expect(levyOnRange(money(10000), money(2), money(15000), null).toString()).toBe('0');
  });
});
