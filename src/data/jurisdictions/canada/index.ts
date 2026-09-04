/**
 * Canada rulesets, one per calendar tax year.
 *
 * Composed: a federal ruleset carrying federal tax and the federal payroll
 * contributions, plus one ruleset per province carrying only that province's
 * own tax, credit and surtax. Federal figures live in one place, each layer is
 * its own deduction line, and a province publishes independently.
 *
 * QUEBEC IS NOT PUBLISHED. See the note beside its ruleset.
 *
 * PROVENANCE: unverified throughout. Canadian brackets, personal amounts and
 * contribution maximums are all indexed annually, so the structure carries more
 * confidence than the amounts. See ../_shared.ts.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { AWAITING_SOURCE_NOTE, defineAwaitingSourceRuleset, unverifiedNote } from '../_shared.ts';
import { CONFIDENCE_NOTE, type YearConfidence } from '../_years.ts';

interface Band {
  label: string;
  from: number;
  to: number | null;
  ratePercent: number;
}

interface FederalYear {
  readonly label: string;
  readonly confidence: YearConfidence;
  readonly bands: readonly Band[];
  readonly basicPersonalAmount: number;
  readonly basicPersonalAmountFloor: number;
  readonly bpaTaperThreshold: number;
  readonly bpaTaperEnd: number;
  /** The rate personal amounts are credited at — the lowest bracket rate. */
  readonly creditRatePercent: number;
  readonly cppRatePercent: number;
  readonly cppExemption: number;
  readonly cppMaximumEarnings: number;
  readonly cpp2RatePercent: number;
  readonly cpp2MaximumEarnings: number;
  readonly eiRatePercent: number;
  readonly eiMaximumEarnings: number;
  readonly note?: string;
}

const FEDERAL_YEARS: readonly FederalYear[] = [
  {
    label: '2026',
    confidence: 'uncertain',
    bands: [
      { label: 'First bracket', from: 0, to: 57375, ratePercent: 14 },
      { label: 'Second bracket', from: 57375, to: 114750, ratePercent: 20.5 },
      { label: 'Third bracket', from: 114750, to: 177882, ratePercent: 26 },
      { label: 'Fourth bracket', from: 177882, to: 253414, ratePercent: 29 },
      { label: 'Top bracket', from: 253414, to: null, ratePercent: 33 },
    ],
    basicPersonalAmount: 16129,
    basicPersonalAmountFloor: 14538,
    bpaTaperThreshold: 177882,
    bpaTaperEnd: 253414,
    creditRatePercent: 14,
    cppRatePercent: 5.95,
    cppExemption: 3500,
    cppMaximumEarnings: 71300,
    cpp2RatePercent: 4,
    cpp2MaximumEarnings: 81200,
    eiRatePercent: 1.64,
    eiMaximumEarnings: 65700,
    note: 'Brackets, the basic personal amount and the CPP and EI maximums are carried forward from 2025 and are indexed every year, so they are almost certainly slightly out.',
  },
  {
    label: '2025',
    confidence: 'likely',
    bands: [
      { label: 'First bracket', from: 0, to: 57375, ratePercent: 14.5 },
      { label: 'Second bracket', from: 57375, to: 114750, ratePercent: 20.5 },
      { label: 'Third bracket', from: 114750, to: 177882, ratePercent: 26 },
      { label: 'Fourth bracket', from: 177882, to: 253414, ratePercent: 29 },
      { label: 'Top bracket', from: 253414, to: null, ratePercent: 33 },
    ],
    basicPersonalAmount: 16129,
    basicPersonalAmountFloor: 14538,
    bpaTaperThreshold: 177882,
    bpaTaperEnd: 253414,
    creditRatePercent: 14.5,
    cppRatePercent: 5.95,
    cppExemption: 3500,
    cppMaximumEarnings: 71300,
    cpp2RatePercent: 4,
    cpp2MaximumEarnings: 81200,
    eiRatePercent: 1.64,
    eiMaximumEarnings: 65700,
    note: 'The lowest federal rate was cut from 15% to 14% part-way through this year, giving a 14.5% effective rate for the year as a whole. That blended rate is used here, which is right for a full-year salary and wrong for anyone whose income fell entirely in one half of the year.',
  },
  {
    label: '2024',
    confidence: 'settled',
    bands: [
      { label: 'First bracket', from: 0, to: 55867, ratePercent: 15 },
      { label: 'Second bracket', from: 55867, to: 111733, ratePercent: 20.5 },
      { label: 'Third bracket', from: 111733, to: 173205, ratePercent: 26 },
      { label: 'Fourth bracket', from: 173205, to: 246752, ratePercent: 29 },
      { label: 'Top bracket', from: 246752, to: null, ratePercent: 33 },
    ],
    basicPersonalAmount: 15705,
    basicPersonalAmountFloor: 14156,
    bpaTaperThreshold: 173205,
    bpaTaperEnd: 246752,
    creditRatePercent: 15,
    cppRatePercent: 5.95,
    cppExemption: 3500,
    cppMaximumEarnings: 68500,
    cpp2RatePercent: 4,
    cpp2MaximumEarnings: 73200,
    eiRatePercent: 1.66,
    eiMaximumEarnings: 63200,
    note: 'The first year of the second CPP earnings ceiling.',
  },
];

interface ProvinceYear {
  readonly bands: readonly Band[];
  readonly basicPersonalAmount: number;
  readonly surtaxBands?: readonly Band[];
}

interface ProvinceSpec {
  readonly code: string;
  readonly label: string;
  readonly years: Readonly<Record<string, ProvinceYear>>;
  readonly extraAssumptions?: readonly string[];
}

const ONTARIO_SURTAX: readonly Band[] = [
  { label: 'Below the first threshold', from: 0, to: 5554, ratePercent: 0 },
  { label: 'First surtax', from: 5554, to: 7108, ratePercent: 20 },
  // 20% + 36% once both thresholds are passed.
  { label: 'Second surtax', from: 7108, to: null, ratePercent: 56 },
];

const PROVINCES: readonly ProvinceSpec[] = [
  {
    code: 'ontario',
    label: 'Ontario',
    extraAssumptions: [
      'The Ontario Health Premium is not included. It is charged through the tax return and would add up to a few hundred dollars a year.',
    ],
    years: {
      '2026': {
        bands: [
          { label: 'First bracket', from: 0, to: 52886, ratePercent: 5.05 },
          { label: 'Second bracket', from: 52886, to: 105775, ratePercent: 9.15 },
          { label: 'Third bracket', from: 105775, to: 150000, ratePercent: 11.16 },
          { label: 'Fourth bracket', from: 150000, to: 220000, ratePercent: 12.16 },
          { label: 'Top bracket', from: 220000, to: null, ratePercent: 13.16 },
        ],
        basicPersonalAmount: 12747,
        surtaxBands: ONTARIO_SURTAX,
      },
      '2025': {
        bands: [
          { label: 'First bracket', from: 0, to: 52886, ratePercent: 5.05 },
          { label: 'Second bracket', from: 52886, to: 105775, ratePercent: 9.15 },
          { label: 'Third bracket', from: 105775, to: 150000, ratePercent: 11.16 },
          { label: 'Fourth bracket', from: 150000, to: 220000, ratePercent: 12.16 },
          { label: 'Top bracket', from: 220000, to: null, ratePercent: 13.16 },
        ],
        basicPersonalAmount: 12747,
        surtaxBands: ONTARIO_SURTAX,
      },
      '2024': {
        bands: [
          { label: 'First bracket', from: 0, to: 51446, ratePercent: 5.05 },
          { label: 'Second bracket', from: 51446, to: 102894, ratePercent: 9.15 },
          { label: 'Third bracket', from: 102894, to: 150000, ratePercent: 11.16 },
          { label: 'Fourth bracket', from: 150000, to: 220000, ratePercent: 12.16 },
          { label: 'Top bracket', from: 220000, to: null, ratePercent: 13.16 },
        ],
        basicPersonalAmount: 12399,
        surtaxBands: ONTARIO_SURTAX,
      },
    },
  },
  {
    code: 'british-columbia',
    label: 'British Columbia',
    years: {
      '2026': {
        bands: [
          { label: 'First bracket', from: 0, to: 49279, ratePercent: 5.06 },
          { label: 'Second bracket', from: 49279, to: 98560, ratePercent: 7.7 },
          { label: 'Third bracket', from: 98560, to: 113158, ratePercent: 10.5 },
          { label: 'Fourth bracket', from: 113158, to: 137407, ratePercent: 12.29 },
          { label: 'Fifth bracket', from: 137407, to: 186306, ratePercent: 14.7 },
          { label: 'Sixth bracket', from: 186306, to: 259829, ratePercent: 16.8 },
          { label: 'Top bracket', from: 259829, to: null, ratePercent: 20.5 },
        ],
        basicPersonalAmount: 12932,
      },
      '2025': {
        bands: [
          { label: 'First bracket', from: 0, to: 49279, ratePercent: 5.06 },
          { label: 'Second bracket', from: 49279, to: 98560, ratePercent: 7.7 },
          { label: 'Third bracket', from: 98560, to: 113158, ratePercent: 10.5 },
          { label: 'Fourth bracket', from: 113158, to: 137407, ratePercent: 12.29 },
          { label: 'Fifth bracket', from: 137407, to: 186306, ratePercent: 14.7 },
          { label: 'Sixth bracket', from: 186306, to: 259829, ratePercent: 16.8 },
          { label: 'Top bracket', from: 259829, to: null, ratePercent: 20.5 },
        ],
        basicPersonalAmount: 12932,
      },
      '2024': {
        bands: [
          { label: 'First bracket', from: 0, to: 47937, ratePercent: 5.06 },
          { label: 'Second bracket', from: 47937, to: 95875, ratePercent: 7.7 },
          { label: 'Third bracket', from: 95875, to: 110076, ratePercent: 10.5 },
          { label: 'Fourth bracket', from: 110076, to: 133664, ratePercent: 12.29 },
          { label: 'Fifth bracket', from: 133664, to: 181232, ratePercent: 14.7 },
          { label: 'Sixth bracket', from: 181232, to: 252752, ratePercent: 16.8 },
          { label: 'Top bracket', from: 252752, to: null, ratePercent: 20.5 },
        ],
        basicPersonalAmount: 12580,
      },
    },
  },
  {
    code: 'alberta',
    label: 'Alberta',
    years: {
      '2026': {
        bands: [
          { label: 'First bracket', from: 0, to: 60000, ratePercent: 8 },
          { label: 'Second bracket', from: 60000, to: 151234, ratePercent: 10 },
          { label: 'Third bracket', from: 151234, to: 181481, ratePercent: 12 },
          { label: 'Fourth bracket', from: 181481, to: 241974, ratePercent: 13 },
          { label: 'Fifth bracket', from: 241974, to: 362961, ratePercent: 14 },
          { label: 'Top bracket', from: 362961, to: null, ratePercent: 15 },
        ],
        basicPersonalAmount: 22323,
      },
      '2025': {
        bands: [
          { label: 'First bracket', from: 0, to: 60000, ratePercent: 8 },
          { label: 'Second bracket', from: 60000, to: 151234, ratePercent: 10 },
          { label: 'Third bracket', from: 151234, to: 181481, ratePercent: 12 },
          { label: 'Fourth bracket', from: 181481, to: 241974, ratePercent: 13 },
          { label: 'Fifth bracket', from: 241974, to: 362961, ratePercent: 14 },
          { label: 'Top bracket', from: 362961, to: null, ratePercent: 15 },
        ],
        basicPersonalAmount: 22323,
      },
      '2024': {
        // The 8% bracket on the first $60,000 was introduced in 2025.
        bands: [
          { label: 'First bracket', from: 0, to: 148269, ratePercent: 10 },
          { label: 'Second bracket', from: 148269, to: 177922, ratePercent: 12 },
          { label: 'Third bracket', from: 177922, to: 237230, ratePercent: 13 },
          { label: 'Fourth bracket', from: 237230, to: 355845, ratePercent: 14 },
          { label: 'Top bracket', from: 355845, to: null, ratePercent: 15 },
        ],
        basicPersonalAmount: 21885,
      },
    },
  },
];

const FEDERAL_SOURCES = [
  {
    id: 'cra-tax-rates',
    title: 'Canadian income tax rates for individuals',
    publisher: 'Canada Revenue Agency',
    url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/canadian-income-tax-rates-individuals-current-previous-years.html',
    checkedOn: null,
  },
  {
    id: 'cra-payroll-deductions',
    title: 'Payroll deductions formulas (T4127)',
    publisher: 'Canada Revenue Agency',
    url: 'https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas.html',
    checkedOn: null,
  },
  {
    id: 'cra-cpp-ei',
    title: 'CPP contribution rates, maximums and exemptions / EI premium rates',
    publisher: 'Canada Revenue Agency',
    url: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions.html',
    checkedOn: null,
  },
] as const;

const PROVINCIAL_SOURCE_URL =
  'https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables.html';

const ASSUMPTIONS = [
  'Only the federal and provincial basic personal amounts are claimed.',
  'The province of residence on 31 December determines provincial tax, regardless of where the income was earned.',
  'Contributions are annualised. Real payroll stops CPP and EI mid-year once the annual maximum is reached, so individual pay periods differ.',
  'Employer-paid contributions are not deducted from the take-home figure.',
];

const EXCLUSIONS = [
  'Spousal, dependant, age, disability, and tuition credits',
  'RRSP deductions and pension adjustments',
  'Provincial health premiums and low-income reductions',
  'Self-employment income and self-employed CPP rates',
  'Residents of more than one province during the year',
];

const ROUNDING = {
  taxableIncome: 'none',
  taxDue: 'half-up-to-minor',
  note: 'Rounding policy not confirmed against CRA publication T4127.',
} as const;

function periodFor(label: string) {
  return { label, startDate: `${label}-01-01`, endDate: `${label}-12-31` };
}

function buildFederal(year: FederalYear): Ruleset {
  // The enhanced basic personal amount withdraws across the second-highest
  // bracket down to a floor rather than disappearing.
  const taperPerUnit =
    (year.basicPersonalAmount - year.basicPersonalAmountFloor) /
    (year.bpaTaperEnd - year.bpaTaperThreshold);

  return defineAwaitingSourceRuleset({
    id: `canada-federal-${year.label}`,
    jurisdiction: 'canada',
    subJurisdiction: null,
    subJurisdictionLabel: 'Federal',
    incomeTaxLabel: 'Federal income tax',
    currency: 'CAD',
    locale: 'en-CA',
    status: 'published',
    taxPeriod: periodFor(year.label),
    expiresOn: `${year.label}-12-31`,
    sources: FEDERAL_SOURCES.map((source) => ({ ...source })),
    provenance: {
      dataStatus: 'unverified',
      checkedOn: null,
      checkedBy: null,
      note: unverifiedNote(`${CONFIDENCE_NOTE[year.confidence]} ${year.note ?? ''}`),
    },
    supportedProfile: {
      description:
        'Canadian resident for the whole calendar year, employed, claiming only the basic personal amounts, no dependants.',
      residency: 'Canadian resident for the whole calendar year',
      employmentType: 'Employee with T4 employment income',
    },
    assumptions: ASSUMPTIONS,
    exclusions: EXCLUSIONS,
    changeNotes: year.note ? [year.note] : [],
    rules: {
      incomeTaxBands: year.bands.map((band) => ({ ...band })),
      allowances: [],
      credits: [
        {
          // Canadian personal amounts are credits at the lowest rate, not
          // allowances — an allowance would save tax at the marginal rate and
          // understate tax for every higher-rate earner.
          id: 'federal-bpa',
          label: 'Federal basic personal amount',
          amount: year.basicPersonalAmount,
          kind: 'non-refundable',
          ratePercent: year.creditRatePercent,
          taperThreshold: year.bpaTaperThreshold,
          taperWithdrawnPerUnit: Number(taperPerUnit.toFixed(6)),
          taperFloorAmount: year.basicPersonalAmountFloor,
          sourceIds: ['cra-tax-rates'],
        },
      ],
      levies: [],
      contributions: [
        {
          id: 'cpp',
          label: 'Canada Pension Plan',
          bands: [
            {
              label: 'Base contribution',
              from: year.cppExemption,
              to: year.cppMaximumEarnings,
              ratePercent: year.cppRatePercent,
            },
          ],
          exemptBelow: year.cppExemption,
          maximumContribution: null,
          maximumEarnings: year.cppMaximumEarnings,
          sourceIds: ['cra-cpp-ei'],
        },
        {
          id: 'cpp2',
          label: 'CPP second additional contribution',
          bands: [
            {
              label: 'Second earnings ceiling',
              from: year.cppMaximumEarnings,
              to: year.cpp2MaximumEarnings,
              ratePercent: year.cpp2RatePercent,
            },
          ],
          exemptBelow: year.cppMaximumEarnings,
          maximumContribution: null,
          maximumEarnings: year.cpp2MaximumEarnings,
          sourceIds: ['cra-cpp-ei'],
        },
        {
          id: 'ei',
          label: 'Employment Insurance',
          bands: [
            {
              label: 'Premium',
              from: 0,
              to: year.eiMaximumEarnings,
              ratePercent: year.eiRatePercent,
            },
          ],
          exemptBelow: 0,
          maximumContribution: null,
          maximumEarnings: year.eiMaximumEarnings,
          sourceIds: ['cra-cpp-ei'],
        },
      ],
      surtaxes: [],
      loanRepayments: [],
      optionalSchemes: {},
      rounding: ROUNDING,
    },
  });
}

function buildProvince(spec: ProvinceSpec, yearLabel: string, confidence: YearConfidence): Ruleset {
  const year = spec.years[yearLabel];
  if (!year) throw new Error(`No ${spec.label} rates for ${yearLabel}`);

  const lowestRate = year.bands[0]?.ratePercent ?? 0;

  return defineAwaitingSourceRuleset({
    id: `canada-${spec.code}-${yearLabel}`,
    jurisdiction: 'canada',
    subJurisdiction: spec.code,
    subJurisdictionLabel: spec.label,
    incomeTaxLabel: `${spec.label} income tax`,
    currency: 'CAD',
    locale: 'en-CA',
    status: 'published',
    taxPeriod: periodFor(yearLabel),
    expiresOn: `${yearLabel}-12-31`,
    sources: [
      ...FEDERAL_SOURCES.map((source) => ({ ...source })),
      {
        id: `${spec.code}-provincial-rates`,
        title: `${spec.label} provincial income tax rates and payroll deduction tables`,
        publisher: 'Canada Revenue Agency',
        url: PROVINCIAL_SOURCE_URL,
        checkedOn: null,
      },
    ],
    provenance: {
      dataStatus: 'unverified',
      checkedOn: null,
      checkedBy: null,
      note: unverifiedNote(
        `${CONFIDENCE_NOTE[confidence]} ${spec.label} brackets and its basic personal amount are ` +
          'indexed annually, so the structure carries more confidence than the amounts.',
      ),
    },
    supportedProfile: {
      description: `Resident of ${spec.label} for the whole calendar year, employed, claiming only the basic personal amounts, no dependants.`,
      residency: `Resident of ${spec.label} on 31 December`,
      employmentType: 'Employee with T4 employment income',
    },
    assumptions: [...ASSUMPTIONS, ...(spec.extraAssumptions ?? [])],
    exclusions: EXCLUSIONS,
    changeNotes: [],
    rules: {
      incomeTaxBands: year.bands.map((band) => ({ ...band })),
      allowances: [],
      credits: [
        {
          id: `${spec.code}-bpa`,
          label: `${spec.label} basic personal amount`,
          amount: year.basicPersonalAmount,
          kind: 'non-refundable',
          ratePercent: lowestRate,
          taperThreshold: null,
          taperWithdrawnPerUnit: null,
          taperFloorAmount: 0,
          sourceIds: [`${spec.code}-provincial-rates`],
        },
      ],
      levies: [],
      contributions: [],
      surtaxes: year.surtaxBands
        ? [
            {
              id: `${spec.code}-surtax`,
              label: `${spec.label} surtax`,
              bands: year.surtaxBands.map((band) => ({ ...band })),
              sourceIds: [`${spec.code}-provincial-rates`],
            },
          ]
        : [],
      loanRepayments: [],
      optionalSchemes: { federalRulesetId: `canada-federal-${yearLabel}` },
      rounding: ROUNDING,
    },
  });
}

/**
 * Quebec is deliberately left unpublished, for every year.
 *
 * It is not a harder version of the same problem — it is a different problem.
 * Quebec collects its own provincial income tax, runs QPP at a different rate
 * instead of CPP, adds QPIP premiums, and reduces federal tax by the Quebec
 * abatement. The abatement is a reduction of *another layer's* tax, which this
 * engine has no construct for. Publishing Quebec in the shape used for other
 * provinces would be structurally wrong by thousands of dollars, not stale.
 */
export const canadaQuebec2026: Ruleset = defineAwaitingSourceRuleset({
  id: 'canada-quebec-2026',
  jurisdiction: 'canada',
  subJurisdiction: 'quebec',
  subJurisdictionLabel: 'Quebec',
  incomeTaxLabel: 'Quebec income tax',
  currency: 'CAD',
  locale: 'en-CA',
  status: 'draft',
  taxPeriod: periodFor('2026'),
  expiresOn: '2026-12-31',
  sources: [
    ...FEDERAL_SOURCES.map((source) => ({ ...source })),
    {
      id: 'quebec-provincial-rates',
      title: 'Source deductions and employer contributions',
      publisher: 'Revenu Québec',
      url: 'https://www.revenuquebec.ca/en/businesses/source-deductions-and-employer-contributions/',
      checkedOn: null,
    },
  ],
  provenance: {
    dataStatus: 'awaiting-official-source',
    checkedOn: null,
    checkedBy: null,
    note:
      `${AWAITING_SOURCE_NOTE} Quebec additionally needs engine support that does not yet ` +
      'exist: the Quebec abatement reduces federal tax, and there is no construct for one layer ' +
      'reducing another layer’s tax. QPP replaces CPP at a different rate and QPIP is an extra ' +
      'premium. Publishing Quebec using the shape used for other provinces would be structurally ' +
      'wrong, not merely out of date.',
  },
  supportedProfile: {
    description: 'Resident of Quebec for the whole calendar year, employed.',
    residency: 'Resident of Quebec on 31 December',
    employmentType: 'Employee with T4 employment income',
  },
  assumptions: ASSUMPTIONS,
  exclusions: EXCLUSIONS,
  changeNotes: [],
  rules: {
    incomeTaxBands: [],
    allowances: [],
    credits: [],
    levies: [],
    contributions: [],
    surtaxes: [],
    loanRepayments: [],
    optionalSchemes: {
      federalRulesetId: 'canada-federal-2026',
      usesQpp: true,
      usesQpip: true,
      hasFederalAbatement: true,
    },
    rounding: ROUNDING,
  },
});

export const canadaRulesets: readonly Ruleset[] = [
  ...FEDERAL_YEARS.map(buildFederal),
  ...FEDERAL_YEARS.flatMap((year) =>
    PROVINCES.map((province) => buildProvince(province, year.label, year.confidence)),
  ),
  canadaQuebec2026,
];

export const canadaFederal2026 = canadaRulesets[0] as Ruleset;
