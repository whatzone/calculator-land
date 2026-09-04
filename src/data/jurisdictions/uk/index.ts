/**
 * United Kingdom rulesets for the 2026/27 tax year.
 *
 * Scotland is modelled as a separate ruleset rather than a flag, because
 * Scottish income tax has a different number of bands from the rest of the UK,
 * not merely different numbers in the same bands. National Insurance is set
 * UK-wide and is therefore identical in both.
 *
 * PROVENANCE: unverified. See `unverifiedNote` in ../_shared.ts.
 *
 * A note on how the bands are expressed. The engine applies bands to *taxable*
 * income — income after allowances — so the figures below are the published
 * thresholds minus the personal allowance. The additional-rate threshold is the
 * exception: by £125,140 the allowance has tapered to nothing, so taxable
 * income equals total income there and the band edge is the published figure.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { defineAwaitingSourceRuleset, unverifiedNote } from '../_shared.ts';

const TAX_PERIOD = {
  label: '2026/27',
  startDate: '2026-04-06',
  endDate: '2027-04-05',
} as const;

const PERSONAL_ALLOWANCE = 12570;

const SOURCES = [
  {
    id: 'hmrc-income-tax-rates',
    title: 'Income Tax rates and Personal Allowances',
    publisher: 'HM Revenue & Customs (GOV.UK)',
    url: 'https://www.gov.uk/income-tax-rates',
    checkedOn: null,
  },
  {
    id: 'hmrc-ni-rates',
    title: 'National Insurance rates and categories',
    publisher: 'HM Revenue & Customs (GOV.UK)',
    url: 'https://www.gov.uk/national-insurance-rates-letters',
    checkedOn: null,
  },
  {
    id: 'hmrc-student-loans',
    title: 'Repaying your student loan',
    publisher: 'GOV.UK',
    url: 'https://www.gov.uk/repaying-your-student-loan',
    checkedOn: null,
  },
] as const;

const SCOTLAND_SOURCES = [
  ...SOURCES,
  {
    id: 'scotgov-income-tax',
    title: 'Scottish Income Tax rates and bands',
    publisher: 'Scottish Government / HMRC',
    url: 'https://www.gov.scot/policies/taxes/income-tax/',
    checkedOn: null,
  },
] as const;

/**
 * Employee Class 1 National Insurance. Set UK-wide, so identical in both
 * rulesets. Thresholds are aligned with the personal allowance and the
 * higher-rate threshold, both of which are frozen.
 */
const NATIONAL_INSURANCE = {
  id: 'employee-ni',
  label: 'National Insurance',
  bands: [
    { label: 'Main rate', from: 12570, to: 50270, ratePercent: 8 },
    { label: 'Above the upper earnings limit', from: 50270, to: null, ratePercent: 2 },
  ],
  exemptBelow: 12570,
  maximumContribution: null,
  maximumEarnings: null,
  sourceIds: ['hmrc-ni-rates'],
} as const;

const COMMON = {
  jurisdiction: 'uk',
  currency: 'GBP',
  locale: 'en-GB',
  status: 'published',
  taxPeriod: TAX_PERIOD,
  expiresOn: '2027-04-05',
  supportedProfile: {
    description:
      'Employee under PAYE, single source of employment income, UK tax resident for the whole year, standard tax code.',
    residency: 'UK resident for the whole tax year',
    employmentType: 'Employed under PAYE',
  },
  assumptions: [
    'A standard tax code is assumed; the calculator does not model an individually issued code.',
    'Income is from a single employment held for the whole tax year.',
    'No taxable benefits in kind, dividends, savings income, or self-employment profits are included.',
    'National Insurance is shown annualised. Real payroll assesses it per pay period, so a mid-year change of salary produces a different actual total.',
    'Student loan repayments are not included, because their thresholds change every April and could not be sourced.',
  ],
  exclusions: [
    'Student loan and postgraduate loan repayments',
    'Marriage Allowance and Blind Person’s Allowance',
    'Multiple concurrent employments',
    'Salary sacrifice arrangements other than the simple pension option',
    'Class 1A/1B employer charges',
    'Anyone not resident in the UK for the full tax year',
  ],
  changeNotes: [],
} as const;

const ROUNDING = {
  taxableIncome: 'none',
  taxDue: 'half-up-to-minor',
  note: 'Rounding policy not confirmed against HMRC guidance.',
} as const;

export const ukEnglandWalesNi: Ruleset = defineAwaitingSourceRuleset({
  ...COMMON,
  id: 'uk-england-wales-ni-2026-27',
  subJurisdiction: 'england-wales-ni',
  subJurisdictionLabel: 'England, Wales & Northern Ireland',
  incomeTaxLabel: 'Income Tax',
  sources: SOURCES.map((source) => ({ ...source })),
  provenance: {
    dataStatus: 'unverified',
    checkedOn: null,
    checkedBy: null,
    note: unverifiedNote(
      'The personal allowance and the basic and higher rate thresholds have been frozen for ' +
        'several years, so confidence in those is reasonably high. The National Insurance main ' +
        'rate of 8% has applied since April 2024.',
    ),
  },
  rules: {
    // Expressed on taxable income: published threshold minus the allowance.
    incomeTaxBands: [
      { label: 'Basic rate', from: 0, to: 37700, ratePercent: 20 },
      { label: 'Higher rate', from: 37700, to: 125140, ratePercent: 40 },
      { label: 'Additional rate', from: 125140, to: null, ratePercent: 45 },
    ],
    allowances: [
      {
        id: 'personal-allowance',
        label: 'Personal Allowance',
        amount: PERSONAL_ALLOWANCE,
        taperThreshold: 100000,
        taperWithdrawnPerUnit: 0.5,
        taperFloorAmount: 0,
        sourceIds: ['hmrc-income-tax-rates'],
      },
    ],
    credits: [],
    levies: [],
    contributions: [{ ...NATIONAL_INSURANCE, bands: [...NATIONAL_INSURANCE.bands] }],
    surtaxes: [],
    loanRepayments: [],
    optionalSchemes: {},
    rounding: ROUNDING,
  },
});

export const ukScotland: Ruleset = defineAwaitingSourceRuleset({
  ...COMMON,
  id: 'uk-scotland-2026-27',
  subJurisdiction: 'scotland',
  subJurisdictionLabel: 'Scotland',
  incomeTaxLabel: 'Scottish Income Tax',
  sources: SCOTLAND_SOURCES.map((source) => ({ ...source })),
  provenance: {
    dataStatus: 'unverified',
    checkedOn: null,
    checkedBy: null,
    note: unverifiedNote(
      'Scotland sets six income tax bands and changes them more often than the rest of the UK, ' +
        'so confidence here is lower than for the rest-of-UK ruleset. National Insurance is set ' +
        'UK-wide and is identical.',
    ),
  },
  assumptions: [
    ...COMMON.assumptions,
    'Scottish income tax rates apply to earnings only. National Insurance is set UK-wide and is identical to the rest of the UK.',
  ],
  rules: {
    // Expressed on taxable income. The top band edge is the published £125,140,
    // because the allowance has tapered to nothing by then.
    incomeTaxBands: [
      { label: 'Starter rate', from: 0, to: 2827, ratePercent: 19 },
      { label: 'Basic rate', from: 2827, to: 14921, ratePercent: 20 },
      { label: 'Intermediate rate', from: 14921, to: 31092, ratePercent: 21 },
      { label: 'Higher rate', from: 31092, to: 62430, ratePercent: 42 },
      { label: 'Advanced rate', from: 62430, to: 125140, ratePercent: 45 },
      { label: 'Top rate', from: 125140, to: null, ratePercent: 48 },
    ],
    allowances: [
      {
        id: 'personal-allowance',
        label: 'Personal Allowance',
        amount: PERSONAL_ALLOWANCE,
        taperThreshold: 100000,
        taperWithdrawnPerUnit: 0.5,
        taperFloorAmount: 0,
        sourceIds: ['hmrc-income-tax-rates'],
      },
    ],
    credits: [],
    levies: [],
    contributions: [{ ...NATIONAL_INSURANCE, bands: [...NATIONAL_INSURANCE.bands] }],
    surtaxes: [],
    loanRepayments: [],
    optionalSchemes: {},
    rounding: ROUNDING,
  },
});

export const ukRulesets: readonly Ruleset[] = [ukEnglandWalesNi, ukScotland];
