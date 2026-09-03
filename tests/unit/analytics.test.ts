/**
 * These tests exist because the promise "we never send your salary to
 * analytics" is only worth making if something enforces it.
 */
import { describe, expect, it } from 'vitest';
import { sanitiseProperties } from '../../src/lib/analytics/track.ts';

describe('sanitiseProperties', () => {
  it('keeps allow-listed identifiers', () => {
    expect(
      sanitiseProperties({ tool_id: 'uk-salary', jurisdiction: 'uk', tax_period: '2026/27' }),
    ).toEqual({ tool_id: 'uk-salary', jurisdiction: 'uk', tax_period: '2026/27' });
  });

  it('strips any property not on the allow-list', () => {
    // Cast through unknown: the type system already forbids these keys, and the
    // point of the test is that the runtime refuses them too, for the case where
    // a value arrives from somewhere the compiler cannot see.
    const forbidden = {
      tool_id: 'uk-salary',
      salary: '52000',
      postcode: 'SW1A 1AA',
      bonusAmount: '10000',
    } as unknown as Parameters<typeof sanitiseProperties>[0];

    expect(sanitiseProperties(forbidden)).toEqual({ tool_id: 'uk-salary' });
  });

  it('replaces a money-shaped value with "other" on a closed-set property', () => {
    // tool_id and jurisdiction are closed sets generated from our own
    // registries, so a salary passed in by mistake can never be forwarded.
    expect(sanitiseProperties({ tool_id: '52000' })).toEqual({ tool_id: 'other' });
    expect(sanitiseProperties({ tool_id: '£52,000' })).toEqual({ tool_id: 'other' });
    expect(sanitiseProperties({ jurisdiction: '1234567' })).toEqual({ jurisdiction: 'other' });
  });

  it('drops a money-shaped value on an open property', () => {
    expect(sanitiseProperties({ page_template: '52000' })).toEqual({});
    expect(sanitiseProperties({ page_template: '£52,000' })).toEqual({});
  });

  it('accepts a real tax period label, which contains a four-digit year', () => {
    expect(sanitiseProperties({ tax_period: '2026/27' })).toEqual({ tax_period: '2026/27' });
    expect(sanitiseProperties({ tax_period: 'not-a-period' })).toEqual({ tax_period: 'other' });
  });

  it('replaces an unexpected value in a closed set rather than passing it through', () => {
    expect(sanitiseProperties({ validation_state: 'valid' })).toEqual({
      validation_state: 'valid',
    });
    expect(sanitiseProperties({ validation_state: 'my-secret-note' })).toEqual({
      validation_state: 'other',
    });
  });

  it('drops over-long values', () => {
    expect(sanitiseProperties({ tool_id: 'a'.repeat(200) })).toEqual({});
  });

  it('drops empty values', () => {
    expect(sanitiseProperties({ tool_id: '' })).toEqual({});
  });

  it('coerces booleans to the closed string set', () => {
    expect(sanitiseProperties({ is_prefilled_page: true })).toEqual({ is_prefilled_page: 'true' });
  });
});
