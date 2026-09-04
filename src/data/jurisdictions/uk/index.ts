/**
 * United Kingdom rulesets, one per tax year.
 *
 * Defined as a table of years rather than a file per year: adding 2027/28 is a
 * single entry at the top of `UK_YEARS`, and a year-on-year diff shows exactly
 * which thresholds moved.
 *
 * Scotland is a separate ruleset rather than a flag, because Scottish income
 * tax has a different number of bands from the rest of the UK. National
 * Insurance is set UK-wide and is shared between the two.
 *
 * BANDS ARE EXPRESSED ON TAXABLE INCOME — income after the personal allowance —
 * because that is what the engine applies them to. So the basic-rate band runs
 * 0 to 37,700, not 12,571 to 50,270. The one exception is the additional-rate
 * threshold: by £125,140 the allowance has tapered to nothing, so taxable
 * income equals total income there and the published figure is used directly.
 *
 * PROVENANCE: unverified throughout. See ../_shared.ts.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { defineAwaitingSourceRuleset, unverifiedNote } from '../_shared.ts';
import { CONFIDENCE_NOTE, type YearConfidence } from '../_years.ts';

interface Band {
  label: string;
  from: number;
  to: number | null;
  ratePercent: number;
}

interface UkYear {
  readonly label: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly confidence: YearConfidence;
  readonly personalAllowance: number;
  readonly taperThreshold: number;
  /** Rest-of-UK bands, on taxable income. */
  readonly bands: readonly Band[];
  /** Scottish bands, on taxable income. */
  readonly scottishBands: readonly Band[];
  /** Employee Class 1 National Insurance, on gross pay. */
  readonly niBands: readonly Band[];
  readonly niThreshold: number;
  readonly note?: string;
}

/**
 * Newest first. The personal allowance and the rest-of-UK thresholds have been
 * frozen since 2021/22, which is why three consecutive years are identical —
 * that is the freeze, not a copy-paste error.
 */
const UK_YEARS: readonly UkYear[] = [
  {
    label: '2026/27',
    startDate: '2026-04-06',
    endDate: '2027-04-05',
    confidence: 'uncertain',
    personalAllowance: 12570,
    taperThreshold: 100000,
    bands: [
      { label: 'Basic rate', from: 0, to: 37700, ratePercent: 20 },
      { label: 'Higher rate', from: 37700, to: 125140, ratePercent: 40 },
      { label: 'Additional rate', from: 125140, to: null, ratePercent: 45 },
    ],
    scottishBands: [
      { label: 'Starter rate', from: 0, to: 2827, ratePercent: 19 },
      { label: 'Basic rate', from: 2827, to: 14921, ratePercent: 20 },
      { label: 'Intermediate rate', from: 14921, to: 31092, ratePercent: 21 },
      { label: 'Higher rate', from: 31092, to: 62430, ratePercent: 42 },
      { label: 'Advanced rate', from: 62430, to: 125140, ratePercent: 45 },
      { label: 'Top rate', from: 125140, to: null, ratePercent: 48 },
    ],
    niBands: [
      { label: 'Main rate', from: 12570, to: 50270, ratePercent: 8 },
      { label: 'Above the upper earnings limit', from: 50270, to: null, ratePercent: 2 },
    ],
    niThreshold: 12570,
    note: 'The Scottish bands here are carried forward unchanged from 2025/26 and should be checked first — Scotland uprates them more often than the rest of the UK.',
  },
  {
    label: '2025/26',
    startDate: '2025-04-06',
    endDate: '2026-04-05',
    confidence: 'likely',
    personalAllowance: 12570,
    taperThreshold: 100000,
    bands: [
      { label: 'Basic rate', from: 0, to: 37700, ratePercent: 20 },
      { label: 'Higher rate', from: 37700, to: 125140, ratePercent: 40 },
      { label: 'Additional rate', from: 125140, to: null, ratePercent: 45 },
    ],
    scottishBands: [
      { label: 'Starter rate', from: 0, to: 2827, ratePercent: 19 },
      { label: 'Basic rate', from: 2827, to: 14921, ratePercent: 20 },
      { label: 'Intermediate rate', from: 14921, to: 31092, ratePercent: 21 },
      { label: 'Higher rate', from: 31092, to: 62430, ratePercent: 42 },
      { label: 'Advanced rate', from: 62430, to: 125140, ratePercent: 45 },
      { label: 'Top rate', from: 125140, to: null, ratePercent: 48 },
    ],
    niBands: [
      { label: 'Main rate', from: 12570, to: 50270, ratePercent: 8 },
      { label: 'Above the upper earnings limit', from: 50270, to: null, ratePercent: 2 },
    ],
    niThreshold: 12570,
  },
  {
    label: '2024/25',
    startDate: '2024-04-06',
    endDate: '2025-04-05',
    confidence: 'settled',
    personalAllowance: 12570,
    taperThreshold: 100000,
    bands: [
      { label: 'Basic rate', from: 0, to: 37700, ratePercent: 20 },
      { label: 'Higher rate', from: 37700, to: 125140, ratePercent: 40 },
      { label: 'Additional rate', from: 125140, to: null, ratePercent: 45 },
    ],
    // 2024/25 is the year the advanced band was introduced, and the starter
    // and basic band edges were lower than in 2025/26.
    scottishBands: [
      { label: 'Starter rate', from: 0, to: 2306, ratePercent: 19 },
      { label: 'Basic rate', from: 2306, to: 13991, ratePercent: 20 },
      { label: 'Intermediate rate', from: 13991, to: 31092, ratePercent: 21 },
      { label: 'Higher rate', from: 31092, to: 62430, ratePercent: 42 },
      { label: 'Advanced rate', from: 62430, to: 125140, ratePercent: 45 },
      { label: 'Top rate', from: 125140, to: null, ratePercent: 48 },
    ],
    niBands: [
      { label: 'Main rate', from: 12570, to: 50270, ratePercent: 8 },
      { label: 'Above the upper earnings limit', from: 50270, to: null, ratePercent: 2 },
    ],
    niThreshold: 12570,
    note: 'The employee National Insurance main rate was cut to 8% at the start of this year, having been 10% for the last quarter of 2023/24.',
  },
];

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
] as const;

const SCOTLAND_SOURCE = {
  id: 'scotgov-income-tax',
  title: 'Scottish Income Tax rates and bands',
  publisher: 'Scottish Government / HMRC',
  url: 'https://www.gov.scot/policies/taxes/income-tax/',
  checkedOn: null,
} as const;

const ASSUMPTIONS = [
  'A standard tax code is assumed; the calculator does not model an individually issued code.',
  'Income is from a single employment held for the whole tax year.',
  'No taxable benefits in kind, dividends, savings income, or self-employment profits are included.',
  'National Insurance is shown annualised. Real payroll assesses it per pay period, so a mid-year change of salary produces a different actual total.',
  'Student loan repayments are not included, because their thresholds change every April and could not be sourced.',
];

const EXCLUSIONS = [
  'Student loan and postgraduate loan repayments',
  'Marriage Allowance and Blind Person’s Allowance',
  'Multiple concurrent employments',
  'Salary sacrifice arrangements other than the simple pension option',
  'Class 1A/1B employer charges',
  'Anyone not resident in the UK for the full tax year',
];

const ROUNDING = {
  taxableIncome: 'none',
  taxDue: 'half-up-to-minor',
  note: 'Rounding policy not confirmed against HMRC guidance.',
} as const;

type Region = 'england-wales-ni' | 'scotland';

function buildUkRuleset(year: UkYear, region: Region): Ruleset {
  const isScotland = region === 'scotland';
  const slug = year.label.replace('/', '-');

  return defineAwaitingSourceRuleset({
    id: `uk-${region}-${slug}`,
    jurisdiction: 'uk',
    subJurisdiction: region,
    subJurisdictionLabel: isScotland ? 'Scotland' : 'England, Wales & Northern Ireland',
    incomeTaxLabel: isScotland ? 'Scottish Income Tax' : 'Income Tax',
    currency: 'GBP',
    locale: 'en-GB',
    status: 'published',
    taxPeriod: { label: year.label, startDate: year.startDate, endDate: year.endDate },
    expiresOn: year.endDate,
    sources: [
      ...SOURCES.map((source) => ({ ...source })),
      ...(isScotland ? [{ ...SCOTLAND_SOURCE }] : []),
    ],
    provenance: {
      dataStatus: 'unverified',
      checkedOn: null,
      checkedBy: null,
      note: unverifiedNote(
        `${CONFIDENCE_NOTE[year.confidence]} ${year.note ?? ''} ` +
          'The personal allowance and the rest-of-UK thresholds have been frozen for several ' +
          'years, so those carry more confidence than most figures on this site.',
      ),
    },
    supportedProfile: {
      description:
        'Employee under PAYE, single source of employment income, UK tax resident for the whole year, standard tax code.',
      residency: 'UK resident for the whole tax year',
      employmentType: 'Employed under PAYE',
    },
    assumptions: isScotland
      ? [
          ...ASSUMPTIONS,
          'Scottish income tax rates apply to earnings only. National Insurance is set UK-wide and is identical to the rest of the UK.',
        ]
      : ASSUMPTIONS,
    exclusions: EXCLUSIONS,
    changeNotes: year.note ? [year.note] : [],
    rules: {
      incomeTaxBands: (isScotland ? year.scottishBands : year.bands).map((band) => ({ ...band })),
      allowances: [
        {
          id: 'personal-allowance',
          label: 'Personal Allowance',
          amount: year.personalAllowance,
          taperThreshold: year.taperThreshold,
          taperWithdrawnPerUnit: 0.5,
          taperFloorAmount: 0,
          sourceIds: ['hmrc-income-tax-rates'],
        },
      ],
      credits: [],
      levies: [],
      contributions: [
        {
          id: 'employee-ni',
          label: 'National Insurance',
          bands: year.niBands.map((band) => ({ ...band })),
          exemptBelow: year.niThreshold,
          maximumContribution: null,
          maximumEarnings: null,
          sourceIds: ['hmrc-ni-rates'],
        },
      ],
      surtaxes: [],
      loanRepayments: [],
      optionalSchemes: {},
      rounding: ROUNDING,
    },
  });
}

export const ukRulesets: readonly Ruleset[] = UK_YEARS.flatMap((year) => [
  buildUkRuleset(year, 'england-wales-ni'),
  buildUkRuleset(year, 'scotland'),
]);

/** Kept for callers that want the live year without doing a lookup. */
export const ukEnglandWalesNi = ukRulesets[0] as Ruleset;
export const ukScotland = ukRulesets[1] as Ruleset;
