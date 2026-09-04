/**
 * New Zealand rulesets, one per tax year (1 April to 31 March).
 *
 * 2024-25 IS DELIBERATELY ABSENT. New Zealand changed its thresholds part-way
 * through that year, on 31 July 2024, and Inland Revenue published composite
 * rates for the year as a whole. Those composite rates are not the same as
 * either the old or the new table, and entering an approximation of them would
 * be wrong for every income in the affected bands. Two honest years beat three
 * where one is guesswork.
 *
 * PROVENANCE: unverified throughout. See ../_shared.ts.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { defineAwaitingSourceRuleset, unverifiedNote } from '../_shared.ts';
import { CONFIDENCE_NOTE, type YearConfidence } from '../_years.ts';

interface NewZealandYear {
  readonly label: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly confidence: YearConfidence;
  readonly accRatePercent: number;
  readonly accMaximumEarnings: number;
  readonly studentLoanThreshold: number;
  readonly note?: string;
}

/**
 * The income tax thresholds took full effect from 2025-26 and are shared by
 * both years held here. The ACC figures are reset annually and are not.
 */
const INCOME_TAX_BANDS = [
  { label: 'First band', from: 0, to: 15600, ratePercent: 10.5 },
  { label: 'Second band', from: 15600, to: 53500, ratePercent: 17.5 },
  { label: 'Third band', from: 53500, to: 78100, ratePercent: 30 },
  { label: 'Fourth band', from: 78100, to: 180000, ratePercent: 33 },
  { label: 'Top band', from: 180000, to: null, ratePercent: 39 },
] as const;

const NEW_ZEALAND_YEARS: readonly NewZealandYear[] = [
  {
    label: '2026-27',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    confidence: 'uncertain',
    accRatePercent: 1.67,
    accMaximumEarnings: 152790,
    studentLoanThreshold: 24128,
    note: 'The ACC earners’ levy rate and its maximum liable earnings are carried forward from 2025-26. Both are reset every year, so they are the figures here most likely to be wrong.',
  },
  {
    label: '2025-26',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    confidence: 'likely',
    accRatePercent: 1.67,
    accMaximumEarnings: 152790,
    studentLoanThreshold: 24128,
    note: 'The first full year on the thresholds introduced part-way through 2024-25.',
  },
];

const SOURCES = [
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
] as const;

function buildNewZealandRuleset(year: NewZealandYear): Ruleset {
  return defineAwaitingSourceRuleset({
    id: `new-zealand-${year.label}`,
    jurisdiction: 'new-zealand',
    subJurisdiction: null,
    subJurisdictionLabel: null,
    incomeTaxLabel: 'Income Tax (PAYE)',
    currency: 'NZD',
    locale: 'en-NZ',
    status: 'published',
    taxPeriod: { label: year.label, startDate: year.startDate, endDate: year.endDate },
    expiresOn: year.endDate,
    sources: SOURCES.map((source) => ({ ...source })),
    provenance: {
      dataStatus: 'unverified',
      checkedOn: null,
      checkedBy: null,
      note: unverifiedNote(`${CONFIDENCE_NOTE[year.confidence]} ${year.note ?? ''}`),
    },
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
      'The 2024-25 tax year, whose composite rates could not be sourced',
    ],
    changeNotes: year.note ? [year.note] : [],
    rules: {
      incomeTaxBands: INCOME_TAX_BANDS.map((band) => ({ ...band })),
      allowances: [],
      credits: [],
      levies: [
        {
          id: 'acc-earners-levy',
          label: 'ACC earners’ levy',
          ratePercent: year.accRatePercent,
          basis: 'above-floor',
          floor: 0,
          ceiling: year.accMaximumEarnings,
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
          threshold: year.studentLoanThreshold,
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
}

export const newZealandRulesets: readonly Ruleset[] = NEW_ZEALAND_YEARS.map(buildNewZealandRuleset);
export const newZealand2026_27 = newZealandRulesets[0] as Ruleset;
