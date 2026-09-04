/**
 * New Zealand ruleset for the 2026-27 tax year (1 April to 31 March).
 *
 * PROVENANCE: unverified. See `unverifiedNote` in ../_shared.ts.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { defineAwaitingSourceRuleset, unverifiedNote } from '../_shared.ts';

export const newZealand2026_27: Ruleset = defineAwaitingSourceRuleset({
  id: 'new-zealand-2026-27',
  jurisdiction: 'new-zealand',
  subJurisdiction: null,
  subJurisdictionLabel: null,
  incomeTaxLabel: 'Income Tax (PAYE)',
  currency: 'NZD',
  locale: 'en-NZ',
  status: 'published',
  taxPeriod: { label: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31' },
  expiresOn: '2027-03-31',
  provenance: {
    dataStatus: 'unverified',
    checkedOn: null,
    checkedBy: null,
    note: unverifiedNote(
      'The income tax thresholds are those that took full effect from the 2025-26 year and are ' +
        'reasonably stable. The ACC earners’ levy rate and its maximum liable earnings are reset ' +
        'every year and are the figures here most likely to be wrong.',
    ),
  },
  sources: [
    {
      id: 'ird-individual-rates',
      title: 'Tax rates for individuals',
      publisher: 'Inland Revenue (Te Tari Taake)',
      url: 'https://www.ird.govt.nz/income-tax/income-tax-for-individuals/tax-codes-and-tax-rates-for-individuals/tax-rates-for-individuals',
      checkedOn: null,
    },
    {
      id: 'acc-earners-levy',
      title: 'ACC earners’ levy rate and maximum liable earnings',
      publisher: 'Inland Revenue / ACC',
      url: 'https://www.ird.govt.nz/employing-staff/deductions-from-income/acc-levies',
      checkedOn: null,
    },
    {
      id: 'ird-student-loans',
      title: 'Student loan repayments',
      publisher: 'Inland Revenue (Te Tari Taake)',
      url: 'https://www.ird.govt.nz/student-loans',
      checkedOn: null,
    },
    {
      id: 'ird-kiwisaver',
      title: 'KiwiSaver contribution rates',
      publisher: 'Inland Revenue (Te Tari Taake)',
      url: 'https://www.ird.govt.nz/kiwisaver/kiwisaver-individuals',
      checkedOn: null,
    },
  ],
  supportedProfile: {
    description:
      'New Zealand tax resident, employed, main job on the ordinary M tax code, no secondary income.',
    residency: 'New Zealand tax resident for the whole tax year',
    employmentType: 'Employee on PAYE, primary employment',
  },
  assumptions: [
    'The ordinary primary-employment tax code is assumed. Secondary and special codes are not modelled.',
    'The ACC earners’ levy is applied up to the maximum liable earnings cap.',
    'KiwiSaver, where selected, is deducted from pay after tax, which is how employee contributions work.',
    'The Independent Earner Tax Credit and Working for Families entitlements are not modelled.',
  ],
  exclusions: [
    'Independent Earner Tax Credit',
    'Working for Families tax credits',
    'Secondary tax codes and multiple jobs',
    'Student loan special deduction rates',
    'Schedular payments and contractors',
    'Non-residents and transitional residents',
  ],
  changeNotes: [],
  rules: {
    incomeTaxBands: [
      { label: 'First band', from: 0, to: 15600, ratePercent: 10.5 },
      { label: 'Second band', from: 15600, to: 53500, ratePercent: 17.5 },
      { label: 'Third band', from: 53500, to: 78100, ratePercent: 30 },
      { label: 'Fourth band', from: 78100, to: 180000, ratePercent: 33 },
      { label: 'Top band', from: 180000, to: null, ratePercent: 39 },
    ],
    allowances: [],
    credits: [],
    levies: [
      {
        id: 'acc-earners-levy',
        label: 'ACC earners’ levy',
        ratePercent: 1.67,
        basis: 'above-floor',
        floor: 0,
        ceiling: 152790,
        exemptBelow: 0,
        phaseInTo: null,
        phaseInRatePercent: null,
        sourceIds: ['acc-earners-levy'],
      },
    ],
    contributions: [],
    surtaxes: [],
    loanRepayments: [
      {
        id: 'student-loan',
        label: 'Student loan repayment',
        selector: 'student-loan',
        method: 'rate-above-threshold',
        threshold: 24128,
        ratePercent: 12,
        bands: [],
        sourceIds: ['ird-student-loans'],
      },
    ],
    optionalSchemes: {},
    rounding: {
      taxableIncome: 'none',
      taxDue: 'half-up-to-minor',
      note: 'Rounding policy not confirmed against Inland Revenue guidance.',
    },
  },
});

export const newZealandRulesets: readonly Ruleset[] = [newZealand2026_27];
