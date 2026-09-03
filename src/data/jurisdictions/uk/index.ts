/**
 * United Kingdom rulesets for the 2026/27 tax year.
 *
 * Scotland is modelled as a separate ruleset rather than a flag, because Scottish
 * income tax has a different number of bands from the rest of the UK, not merely
 * different numbers in the same bands. National Insurance is UK-wide and is
 * therefore duplicated across both rulesets from a single shared definition.
 *
 * Rate tables are empty. See ../_shared.ts for why.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { AWAITING_SOURCE_NOTE, defineAwaitingSourceRuleset } from '../_shared.ts';

/**
 * UK tax year boundaries are a fixed feature of the system (6 April to
 * 5 April), unlike rates. They are safe to encode without a rate source.
 */
const TAX_PERIOD = {
  label: '2026/27',
  startDate: '2026-04-06',
  endDate: '2027-04-05',
} as const;

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

const COMMON = {
  jurisdiction: 'uk',
  currency: 'GBP',
  locale: 'en-GB',
  status: 'draft',
  taxPeriod: TAX_PERIOD,
  expiresOn: '2027-04-05',
  provenance: {
    dataStatus: 'awaiting-official-source',
    checkedOn: null,
    checkedBy: null,
    note: AWAITING_SOURCE_NOTE,
  },
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
  ],
  exclusions: [
    'Marriage Allowance and Blind Person’s Allowance',
    'Multiple concurrent employments',
    'Salary sacrifice arrangements other than the simple pension option',
    'Class 1A/1B employer charges',
    'Anyone not resident in the UK for the full tax year',
  ],
  changeNotes: [],
  rules: {
    // Empty by design. Populating this requires the runbook, not a code change.
    incomeTaxBands: [],
    allowances: [],
    credits: [],
    levies: [],
    contributions: [],
    optionalSchemes: {},
    rounding: {
      taxableIncome: 'none',
      taxDue: 'half-up-to-minor',
      note: 'Rounding policy must be confirmed against HMRC guidance before publication.',
    },
  },
} as const;

export const ukEnglandWalesNi: Ruleset = defineAwaitingSourceRuleset({
  ...COMMON,
  id: 'uk-england-wales-ni-2026-27',
  subJurisdiction: 'england-wales-ni',
  subJurisdictionLabel: 'England, Wales & Northern Ireland',
  sources: SOURCES.map((source) => ({ ...source })),
});

export const ukScotland: Ruleset = defineAwaitingSourceRuleset({
  ...COMMON,
  id: 'uk-scotland-2026-27',
  subJurisdiction: 'scotland',
  subJurisdictionLabel: 'Scotland',
  sources: SCOTLAND_SOURCES.map((source) => ({ ...source })),
  assumptions: [
    ...COMMON.assumptions,
    'Scottish income tax rates apply to non-savings, non-dividend income only. National Insurance is set UK-wide and is identical to the rest of the UK.',
  ],
});

export const ukRulesets: readonly Ruleset[] = [ukEnglandWalesNi, ukScotland];
