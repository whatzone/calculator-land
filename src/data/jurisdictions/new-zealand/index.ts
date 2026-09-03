/**
 * New Zealand ruleset for the 2026-27 tax year (1 April to 31 March).
 *
 * Rate tables are empty. See ../_shared.ts for why.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { AWAITING_SOURCE_NOTE, defineAwaitingSourceRuleset } from '../_shared.ts';

export const newZealand2026_27: Ruleset = defineAwaitingSourceRuleset({
  id: 'new-zealand-2026-27',
  jurisdiction: 'new-zealand',
  subJurisdiction: null,
  subJurisdictionLabel: null,
  currency: 'NZD',
  locale: 'en-NZ',
  status: 'draft',
  taxPeriod: { label: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31' },
  expiresOn: '2027-03-31',
  provenance: {
    dataStatus: 'awaiting-official-source',
    checkedOn: null,
    checkedBy: null,
    note: AWAITING_SOURCE_NOTE,
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
    'The ordinary primary-employment tax code is assumed; secondary and special codes are not modelled.',
    'The ACC earners’ levy is applied up to the maximum liable earnings cap.',
    'KiwiSaver, where selected, is treated as an employee contribution deducted from after-tax pay.',
    'Independent Earner Tax Credit and Working for Families entitlements are not modelled.',
  ],
  exclusions: [
    'Secondary tax codes and multiple jobs',
    'Working for Families tax credits',
    'Student loan special deduction rates',
    'Schedular payments and contractors',
    'Non-residents and transitional residents',
  ],
  changeNotes: [],
  rules: {
    incomeTaxBands: [],
    allowances: [],
    credits: [],
    levies: [],
    contributions: [],
    optionalSchemes: {},
    rounding: {
      taxableIncome: 'none',
      taxDue: 'half-up-to-minor',
      note: 'Rounding policy must be confirmed against Inland Revenue guidance before publication.',
    },
  },
});

export const newZealandRulesets: readonly Ruleset[] = [newZealand2026_27];
