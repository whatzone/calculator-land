/**
 * Canada rulesets for the 2026 calendar tax year.
 *
 * Modelled as a composed calculation: one federal ruleset carrying federal tax
 * and the federal payroll contributions, plus one ruleset per province
 * carrying only that province's own tax, credit and surtax. Federal figures
 * therefore live in exactly one place, each layer is its own deduction line,
 * and a province can be published independently.
 *
 * PROVENANCE: unverified for the federal ruleset and for Ontario, British
 * Columbia and Alberta. QUEBEC IS DELIBERATELY NOT PUBLISHED — see below.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { AWAITING_SOURCE_NOTE, defineAwaitingSourceRuleset, unverifiedNote } from '../_shared.ts';

const TAX_PERIOD = { label: '2026', startDate: '2026-01-01', endDate: '2026-12-31' } as const;

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

const COMMON = {
  jurisdiction: 'canada',
  currency: 'CAD',
  locale: 'en-CA',
  taxPeriod: TAX_PERIOD,
  expiresOn: '2026-12-31',
  supportedProfile: {
    description:
      'Resident of the stated province for the whole calendar year, employed, claiming only the basic personal amounts, no dependants.',
    residency: 'Resident of the stated province on 31 December',
    employmentType: 'Employee with T4 employment income',
  },
  assumptions: [
    'Only the federal and provincial basic personal amounts are claimed.',
    'The province of residence on 31 December determines provincial tax, regardless of where the income was earned.',
    'Contributions are annualised. Real payroll stops CPP and EI mid-year once the annual maximum is reached, so individual pay periods differ.',
    'Employer-paid contributions are not deducted from the take-home figure.',
  ],
  exclusions: [
    'Spousal, dependant, age, disability, and tuition credits',
    'RRSP deductions and pension adjustments',
    'Provincial health premiums and low-income reductions',
    'Self-employment income and self-employed CPP rates',
    'Residents of more than one province during the year',
  ],
  changeNotes: [],
} as const;

const ROUNDING = {
  taxableIncome: 'none',
  taxDue: 'half-up-to-minor',
  note: 'Rounding policy not confirmed against CRA publication T4127.',
} as const;

/**
 * Federal layer. Carries federal income tax and the payroll contributions,
 * which are federal programmes and so belong here rather than in each province.
 */
export const canadaFederal2026: Ruleset = defineAwaitingSourceRuleset({
  ...COMMON,
  id: 'canada-federal-2026',
  subJurisdiction: null,
  subJurisdictionLabel: 'Federal',
  incomeTaxLabel: 'Federal income tax',
  status: 'published',
  sources: FEDERAL_SOURCES.map((source) => ({ ...source })),
  provenance: {
    dataStatus: 'unverified',
    checkedOn: null,
    checkedBy: null,
    note: unverifiedNote(
      'Canadian brackets, the basic personal amount and the CPP and EI maximums are all indexed ' +
        'annually, so the 2026 figures here are very likely to be slightly out even where the ' +
        'structure is right. The lowest federal rate was reduced to 14%, which is reflected here.',
    ),
  },
  rules: {
    incomeTaxBands: [
      { label: 'First bracket', from: 0, to: 57375, ratePercent: 14 },
      { label: 'Second bracket', from: 57375, to: 114750, ratePercent: 20.5 },
      { label: 'Third bracket', from: 114750, to: 177882, ratePercent: 26 },
      { label: 'Fourth bracket', from: 177882, to: 253414, ratePercent: 29 },
      { label: 'Top bracket', from: 253414, to: null, ratePercent: 33 },
    ],
    allowances: [],
    credits: [
      {
        // Canadian personal amounts are credits at the lowest rate, not
        // allowances — an allowance would save tax at the marginal rate, which
        // would understate tax for every higher-rate earner.
        id: 'federal-bpa',
        label: 'Federal basic personal amount',
        amount: 16129,
        kind: 'non-refundable',
        ratePercent: 14,
        // The enhanced amount withdraws across the second-highest bracket down
        // to a floor, rather than disappearing.
        taperThreshold: 177882,
        taperWithdrawnPerUnit: 0.021064,
        taperFloorAmount: 14538,
        sourceIds: ['cra-tax-rates'],
      },
    ],
    levies: [],
    contributions: [
      {
        id: 'cpp',
        label: 'Canada Pension Plan',
        bands: [{ label: 'Base contribution', from: 3500, to: 71300, ratePercent: 5.95 }],
        exemptBelow: 3500,
        maximumContribution: null,
        maximumEarnings: 71300,
        sourceIds: ['cra-cpp-ei'],
      },
      {
        id: 'cpp2',
        label: 'CPP second additional contribution',
        bands: [{ label: 'Second earnings ceiling', from: 71300, to: 81200, ratePercent: 4 }],
        exemptBelow: 71300,
        maximumContribution: null,
        maximumEarnings: 81200,
        sourceIds: ['cra-cpp-ei'],
      },
      {
        id: 'ei',
        label: 'Employment Insurance',
        bands: [{ label: 'Premium', from: 0, to: 65700, ratePercent: 1.64 }],
        exemptBelow: 0,
        maximumContribution: null,
        maximumEarnings: 65700,
        sourceIds: ['cra-cpp-ei'],
      },
    ],
    surtaxes: [],
    loanRepayments: [],
    optionalSchemes: {},
    rounding: ROUNDING,
  },
});

interface ProvinceSpec {
  readonly code: string;
  readonly label: string;
  readonly bands: readonly {
    label: string;
    from: number;
    to: number | null;
    ratePercent: number;
  }[];
  readonly basicPersonalAmount: number;
  readonly lowestRatePercent: number;
  readonly surtaxBands?: readonly {
    label: string;
    from: number;
    to: number | null;
    ratePercent: number;
  }[];
  readonly extraAssumptions?: readonly string[];
}

const PROVINCES: readonly ProvinceSpec[] = [
  {
    code: 'ontario',
    label: 'Ontario',
    bands: [
      { label: 'First bracket', from: 0, to: 52886, ratePercent: 5.05 },
      { label: 'Second bracket', from: 52886, to: 105775, ratePercent: 9.15 },
      { label: 'Third bracket', from: 105775, to: 150000, ratePercent: 11.16 },
      { label: 'Fourth bracket', from: 150000, to: 220000, ratePercent: 12.16 },
      { label: 'Top bracket', from: 220000, to: null, ratePercent: 13.16 },
    ],
    basicPersonalAmount: 12747,
    lowestRatePercent: 5.05,
    // Charged on Ontario tax, not on income. The second rate is the combined
    // 20% + 36% that applies above the higher threshold.
    surtaxBands: [
      { label: 'Below the first threshold', from: 0, to: 5554, ratePercent: 0 },
      { label: 'First surtax', from: 5554, to: 7108, ratePercent: 20 },
      { label: 'Second surtax', from: 7108, to: null, ratePercent: 56 },
    ],
    extraAssumptions: [
      'The Ontario Health Premium is not included. It is charged through the tax return and would add up to a few hundred dollars a year.',
    ],
  },
  {
    code: 'british-columbia',
    label: 'British Columbia',
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
    lowestRatePercent: 5.06,
  },
  {
    code: 'alberta',
    label: 'Alberta',
    bands: [
      { label: 'First bracket', from: 0, to: 60000, ratePercent: 8 },
      { label: 'Second bracket', from: 60000, to: 151234, ratePercent: 10 },
      { label: 'Third bracket', from: 151234, to: 181481, ratePercent: 12 },
      { label: 'Fourth bracket', from: 181481, to: 241974, ratePercent: 13 },
      { label: 'Fifth bracket', from: 241974, to: 362961, ratePercent: 14 },
      { label: 'Top bracket', from: 362961, to: null, ratePercent: 15 },
    ],
    basicPersonalAmount: 22323,
    lowestRatePercent: 8,
  },
];

function buildProvince(spec: ProvinceSpec): Ruleset {
  return defineAwaitingSourceRuleset({
    ...COMMON,
    id: `canada-${spec.code}-2026`,
    subJurisdiction: spec.code,
    subJurisdictionLabel: spec.label,
    incomeTaxLabel: `${spec.label} income tax`,
    status: 'published',
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
        `${spec.label} brackets and its basic personal amount are indexed annually, so the 2026 ` +
          'figures here are very likely to be slightly out even where the structure is right.',
      ),
    },
    assumptions: [...COMMON.assumptions, ...(spec.extraAssumptions ?? [])],
    rules: {
      incomeTaxBands: spec.bands.map((band) => ({ ...band })),
      allowances: [],
      credits: [
        {
          id: `${spec.code}-bpa`,
          label: `${spec.label} basic personal amount`,
          amount: spec.basicPersonalAmount,
          kind: 'non-refundable',
          ratePercent: spec.lowestRatePercent,
          taperThreshold: null,
          taperWithdrawnPerUnit: null,
          taperFloorAmount: 0,
          sourceIds: [`${spec.code}-provincial-rates`],
        },
      ],
      levies: [],
      contributions: [],
      surtaxes: spec.surtaxBands
        ? [
            {
              id: `${spec.code}-surtax`,
              label: `${spec.label} surtax`,
              bands: spec.surtaxBands.map((band) => ({ ...band })),
              sourceIds: [`${spec.code}-provincial-rates`],
            },
          ]
        : [],
      loanRepayments: [],
      optionalSchemes: { federalRulesetId: 'canada-federal-2026' },
      rounding: ROUNDING,
    },
  });
}

/**
 * Quebec is deliberately left unpublished.
 *
 * It is not a harder version of the same problem — it is a different problem.
 * Quebec collects its own provincial income tax, runs QPP at a different rate
 * instead of CPP, adds QPIP premiums, and reduces federal tax by the Quebec
 * abatement. The abatement in particular is a reduction of *another layer's*
 * tax, which this engine has no construct for. Publishing Quebec with the other
 * provinces' shape would not be slightly stale; it would be structurally wrong
 * by thousands of dollars.
 */
export const canadaQuebec2026: Ruleset = defineAwaitingSourceRuleset({
  ...COMMON,
  id: 'canada-quebec-2026',
  subJurisdiction: 'quebec',
  subJurisdictionLabel: 'Quebec',
  incomeTaxLabel: 'Quebec income tax',
  status: 'draft',
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
      'exist: the Quebec abatement reduces federal tax, and there is no construct for one ' +
      'layer reducing another layer’s tax. QPP replaces CPP at a different rate and QPIP is an ' +
      'extra premium. Publishing Quebec using the shape used for other provinces would be ' +
      'structurally wrong, not merely out of date.',
  },
  assumptions: [...COMMON.assumptions],
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

export const canadaProvincialRulesets: readonly Ruleset[] = [
  ...PROVINCES.map(buildProvince),
  canadaQuebec2026,
];

export const canadaRulesets: readonly Ruleset[] = [canadaFederal2026, ...canadaProvincialRulesets];
