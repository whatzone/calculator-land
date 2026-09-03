/**
 * SYNTHETIC TEST DATA — NOT TAX ADVICE, NOT ANY REAL TAX SYSTEM.
 *
 * Every figure below is invented for the purpose of testing arithmetic. The
 * numbers are chosen to be obviously artificial (round bands, 10%/20%/50%
 * rates) so that they can never be mistaken for a real jurisdiction's rules and
 * can never be copied into `src/data/jurisdictions/` by accident.
 *
 * These fixtures exist because engine correctness must be provable independently
 * of whether real rate tables have been sourced yet. They are imported only by
 * tests; nothing under `src/` may import this file.
 */
import { parseRuleset, type Ruleset } from '../../src/lib/validation/ruleset-schema.ts';

const BASE = {
  jurisdiction: 'uk' as const,
  currency: 'GBP' as const,
  locale: 'en-GB',
  status: 'published' as const,
  taxPeriod: { label: 'SYNTHETIC', startDate: '2026-01-01', endDate: '2026-12-31' },
  expiresOn: '2099-12-31',
  provenance: {
    dataStatus: 'populated' as const,
    checkedOn: '2026-01-01',
    checkedBy: 'synthetic test fixture',
    note: 'Invented data for arithmetic tests only.',
  },
  sources: [
    {
      id: 'synthetic-source',
      title: 'Synthetic test source',
      publisher: 'Test fixture',
      url: 'https://example.invalid/synthetic',
      checkedOn: '2026-01-01',
    },
  ],
  supportedProfile: {
    description: 'Synthetic test profile',
    residency: 'Synthetic',
    employmentType: 'Synthetic',
  },
  assumptions: ['Synthetic assumption.'],
  exclusions: ['Everything real.'],
  changeNotes: [],
};

/**
 * Simple three-band system with a flat allowance.
 *   allowance 10,000
 *   0–20,000 taxed at 10%
 *   20,000–50,000 taxed at 20%
 *   above 50,000 taxed at 50%
 */
export const syntheticSimple: Ruleset = parseRuleset({
  ...BASE,
  id: 'synthetic-simple',
  subJurisdiction: null,
  subJurisdictionLabel: null,
  rules: {
    incomeTaxBands: [
      { label: 'Lower', from: 0, to: 20000, ratePercent: 10 },
      { label: 'Middle', from: 20000, to: 50000, ratePercent: 20 },
      { label: 'Upper', from: 50000, to: null, ratePercent: 50 },
    ],
    allowances: [
      {
        id: 'basic',
        label: 'Basic allowance',
        amount: 10000,
        taperThreshold: null,
        taperWithdrawnPerUnit: null,
        sourceIds: ['synthetic-source'],
      },
    ],
    credits: [],
    levies: [],
    contributions: [],
    optionalSchemes: {},
    rounding: { taxableIncome: 'none', taxDue: 'half-up-to-minor', note: 'synthetic' },
  },
});

/** Same bands, plus an allowance tapered away at 1 per 2 above 100,000. */
export const syntheticTapered: Ruleset = parseRuleset({
  ...BASE,
  id: 'synthetic-tapered',
  subJurisdiction: null,
  subJurisdictionLabel: null,
  rules: {
    ...syntheticSimple.rules,
    allowances: [
      {
        id: 'basic',
        label: 'Basic allowance',
        amount: 10000,
        taperThreshold: 100000,
        taperWithdrawnPerUnit: 0.5,
        sourceIds: ['synthetic-source'],
      },
    ],
  },
});

/**
 * Bands plus a capped contribution and a levy with a floor — the shape that
 * exercises marginal-rate divergence from the headline band rate.
 */
export const syntheticWithContributions: Ruleset = parseRuleset({
  ...BASE,
  id: 'synthetic-contributions',
  subJurisdiction: null,
  subJurisdictionLabel: null,
  rules: {
    ...syntheticSimple.rules,
    levies: [
      {
        id: 'health-levy',
        label: 'Health levy',
        ratePercent: 2,
        floor: 15000,
        ceiling: null,
        sourceIds: ['synthetic-source'],
      },
    ],
    contributions: [
      {
        id: 'social',
        label: 'Social contribution',
        bands: [
          { label: 'Main', from: 12000, to: 40000, ratePercent: 8 },
          { label: 'Upper', from: 40000, to: null, ratePercent: 2 },
        ],
        exemptBelow: 12000,
        maximumContribution: null,
        maximumEarnings: 60000,
        sourceIds: ['synthetic-source'],
      },
    ],
  },
});

/** A ruleset with credits instead of an allowance (the Irish shape). */
export const syntheticWithCredits: Ruleset = parseRuleset({
  ...BASE,
  id: 'synthetic-credits',
  subJurisdiction: null,
  subJurisdictionLabel: null,
  rules: {
    incomeTaxBands: [
      { label: 'Standard', from: 0, to: 40000, ratePercent: 20 },
      { label: 'Higher', from: 40000, to: null, ratePercent: 40 },
    ],
    allowances: [],
    credits: [
      {
        id: 'personal',
        label: 'Personal credit',
        amount: 2000,
        kind: 'non-refundable',
        ratePercent: null,
        sourceIds: ['synthetic-source'],
      },
      {
        id: 'employee',
        label: 'Employee credit',
        amount: 2000,
        kind: 'non-refundable',
        ratePercent: null,
        sourceIds: ['synthetic-source'],
      },
    ],
    levies: [],
    contributions: [],
    optionalSchemes: {},
    rounding: { taxableIncome: 'none', taxDue: 'half-up-to-minor', note: 'synthetic' },
  },
});
