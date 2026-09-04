/**
 * Ireland ruleset for the 2026 calendar tax year.
 *
 * Irish take-home pay is three separate charges on three different bases —
 * income tax reduced by credits rather than by an allowance, USC with its own
 * band structure, and PRSI — so they appear as three deduction lines.
 *
 * PROVENANCE: unverified. See `unverifiedNote` in ../_shared.ts.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { defineAwaitingSourceRuleset, unverifiedNote } from '../_shared.ts';

export const ireland2026: Ruleset = defineAwaitingSourceRuleset({
  id: 'ireland-2026',
  jurisdiction: 'ireland',
  subJurisdiction: null,
  subJurisdictionLabel: null,
  incomeTaxLabel: 'Income Tax',
  currency: 'EUR',
  locale: 'en-IE',
  status: 'published',
  taxPeriod: { label: '2026', startDate: '2026-01-01', endDate: '2026-12-31' },
  expiresOn: '2026-12-31',
  provenance: {
    dataStatus: 'unverified',
    checkedOn: null,
    checkedBy: null,
    note: unverifiedNote(
      'Ireland changes its bands, credits and USC thresholds in the Budget each October, so ' +
        'the 2026 figures here are the ones most likely to be out of date. The standard rate ' +
        'band and the PRSI rate in particular should be checked first.',
    ),
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
      'Single individual, PAYE employee, Class A PRSI, tax resident in Ireland for the whole year, no dependants.',
    residency: 'Irish tax resident for the whole calendar year',
    employmentType: 'PAYE employee, PRSI Class A',
  },
  assumptions: [
    'Civil status is single with no dependants. Married and civil-partner band and credit transfers change the result materially and are not modelled.',
    'PRSI Class A is assumed. Other classes have different rates.',
    'Only the personal and PAYE (employee) tax credits are applied.',
    'The tapered PRSI credit for weekly earnings just above the threshold is not modelled, so PRSI is slightly overstated for incomes near it.',
    'Figures are annualised. Irish payroll operates cumulatively, so a mid-year start produces a different actual total.',
  ],
  exclusions: [
    'The tapered PRSI credit for low weekly earnings',
    'Married, civil partnership, and single-parent band or credit changes',
    'Medical card and age-related USC reductions',
    'PRSI classes other than A',
    'Rent, health, tuition, and other reliefs claimed through a return',
    'Proprietary directors and self-employed Class S contributors',
  ],
  changeNotes: [],
  rules: {
    // Ireland has no personal allowance: all income is taxable and credits are
    // then deducted from the tax due.
    incomeTaxBands: [
      { label: 'Standard rate', from: 0, to: 44000, ratePercent: 20 },
      { label: 'Higher rate', from: 44000, to: null, ratePercent: 40 },
    ],
    allowances: [],
    credits: [
      {
        id: 'personal-credit',
        label: 'Personal Tax Credit',
        amount: 2000,
        kind: 'non-refundable',
        ratePercent: null,
        sourceIds: ['revenue-tax-rates-bands'],
      },
      {
        id: 'employee-credit',
        label: 'Employee (PAYE) Tax Credit',
        amount: 2000,
        kind: 'non-refundable',
        ratePercent: null,
        sourceIds: ['revenue-tax-rates-bands'],
      },
    ],
    levies: [],
    contributions: [
      {
        id: 'usc',
        label: 'Universal Social Charge',
        bands: [
          { label: 'First band', from: 0, to: 12012, ratePercent: 0.5 },
          { label: 'Second band', from: 12012, to: 27382, ratePercent: 2 },
          { label: 'Third band', from: 27382, to: 70044, ratePercent: 3 },
          { label: 'Top band', from: 70044, to: null, ratePercent: 8 },
        ],
        // Below the exemption limit no USC is due on any of the income.
        exemptBelow: 13000,
        maximumContribution: null,
        maximumEarnings: null,
        sourceIds: ['revenue-usc'],
      },
      {
        id: 'prsi',
        label: 'PRSI (Class A)',
        bands: [{ label: 'Class A', from: 0, to: null, ratePercent: 4.1 }],
        // Roughly €352 a week.
        exemptBelow: 18304,
        maximumContribution: null,
        maximumEarnings: null,
        sourceIds: ['gov-ie-prsi'],
      },
    ],
    surtaxes: [],
    loanRepayments: [],
    optionalSchemes: {},
    rounding: {
      taxableIncome: 'none',
      taxDue: 'half-up-to-minor',
      note: 'Rounding policy not confirmed against Revenue guidance.',
    },
  },
});

export const irelandRulesets: readonly Ruleset[] = [ireland2026];
