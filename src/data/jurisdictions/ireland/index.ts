/**
 * Ireland ruleset for the 2026 calendar tax year.
 *
 * Irish take-home pay is the sum of three separate charges with different bases
 * — income tax (reduced by credits, not by an allowance), USC (its own band
 * structure), and PRSI — so the engine treats them as three deduction lines
 * rather than folding them together.
 *
 * Rate tables are empty. See ../_shared.ts for why.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { AWAITING_SOURCE_NOTE, defineAwaitingSourceRuleset } from '../_shared.ts';

export const ireland2026: Ruleset = defineAwaitingSourceRuleset({
  id: 'ireland-2026',
  jurisdiction: 'ireland',
  subJurisdiction: null,
  subJurisdictionLabel: null,
  currency: 'EUR',
  locale: 'en-IE',
  status: 'draft',
  taxPeriod: { label: '2026', startDate: '2026-01-01', endDate: '2026-12-31' },
  expiresOn: '2026-12-31',
  provenance: {
    dataStatus: 'awaiting-official-source',
    checkedOn: null,
    checkedBy: null,
    note: AWAITING_SOURCE_NOTE,
  },
  sources: [
    {
      id: 'revenue-tax-rates-bands',
      title: 'Tax rates, bands and reliefs',
      publisher: 'Revenue (Irish Tax and Customs)',
      url: 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/index.aspx',
      checkedOn: null,
    },
    {
      id: 'revenue-usc',
      title: 'Universal Social Charge (USC)',
      publisher: 'Revenue (Irish Tax and Customs)',
      url: 'https://www.revenue.ie/en/jobs-and-pensions/usc/index.aspx',
      checkedOn: null,
    },
    {
      id: 'gov-ie-prsi',
      title: 'PRSI contribution rates and classes',
      publisher: 'Department of Social Protection (gov.ie)',
      url: 'https://www.gov.ie/en/publication/80e5ab-prsi-pay-related-social-insurance/',
      checkedOn: null,
    },
  ],
  supportedProfile: {
    description:
      'Single individual, PAYE employee, Class A PRSI, tax resident in Ireland for the whole year, no dependants claimed.',
    residency: 'Irish tax resident for the whole calendar year',
    employmentType: 'PAYE employee, PRSI Class A',
  },
  assumptions: [
    'Civil status is single with no dependants. Married or civil-partner band and credit transfers change the result materially and are not modelled.',
    'PRSI Class A is assumed; other classes have different rates and are not modelled.',
    'Only the ordinary personal and PAYE (employee) tax credits are applied.',
    'Figures are annualised. Irish payroll operates cumulatively, so a mid-year start produces a different actual total.',
  ],
  exclusions: [
    'Married, civil partnership, and single-parent band or credit changes',
    'Medical card and age-related USC reductions',
    'PRSI classes other than A',
    'Rent, health, tuition, and other relief claims made through a return',
    'Proprietary directors and self-employed Class S contributors',
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
      note: 'Rounding policy must be confirmed against Revenue guidance before publication.',
    },
  },
});

export const irelandRulesets: readonly Ruleset[] = [ireland2026];
