/**
 * Australia ruleset for the 2026-27 income year (1 July to 30 June).
 *
 * Rate tables are empty. See ../_shared.ts for why.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { AWAITING_SOURCE_NOTE, defineAwaitingSourceRuleset } from '../_shared.ts';

export const australia2026_27: Ruleset = defineAwaitingSourceRuleset({
  id: 'australia-2026-27',
  jurisdiction: 'australia',
  subJurisdiction: null,
  subJurisdictionLabel: null,
  currency: 'AUD',
  locale: 'en-AU',
  status: 'draft',
  taxPeriod: { label: '2026-27', startDate: '2026-07-01', endDate: '2027-06-30' },
  expiresOn: '2027-06-30',
  provenance: {
    dataStatus: 'awaiting-official-source',
    checkedOn: null,
    checkedBy: null,
    note: AWAITING_SOURCE_NOTE,
  },
  sources: [
    {
      id: 'ato-individual-rates',
      title: 'Individual income tax rates',
      publisher: 'Australian Taxation Office',
      url: 'https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents',
      checkedOn: null,
    },
    {
      id: 'ato-medicare-levy',
      title: 'Medicare levy',
      publisher: 'Australian Taxation Office',
      url: 'https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy',
      checkedOn: null,
    },
    {
      id: 'ato-study-loan-repayment',
      title: 'Study and training loan repayment thresholds and rates',
      publisher: 'Australian Taxation Office',
      url: 'https://www.ato.gov.au/tax-rates-and-codes/study-and-training-support-loans-rates-and-repayment-thresholds',
      checkedOn: null,
    },
  ],
  supportedProfile: {
    description:
      'Australian tax resident for the full income year, single, employed, claiming the tax-free threshold, no private health insurance considerations.',
    residency: 'Australian resident for tax purposes, full income year',
    employmentType: 'Employee with PAYG withholding',
  },
  assumptions: [
    'The tax-free threshold is claimed from this employer.',
    'Residency is full-year Australian residency; working-holiday-maker and foreign-resident scales are different and are not modelled.',
    'Medicare levy is applied on the ordinary single rate. Reductions, exemptions, and the Medicare levy surcharge are not modelled.',
    'Superannuation guarantee is an employer cost on top of salary and is not deducted from the take-home figure shown.',
  ],
  exclusions: [
    'Medicare levy surcharge and private health insurance rebate',
    'Working holiday makers and foreign residents',
    'Salary sacrifice and reportable employer superannuation contributions',
    'Offsets beyond those explicitly listed in the populated ruleset',
    'Capital gains, investment, and business income',
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
      note: 'Rounding policy must be confirmed against ATO guidance before publication.',
    },
  },
});

export const australiaRulesets: readonly Ruleset[] = [australia2026_27];
