/**
 * Ireland rulesets, one per tax year.
 *
 * Irish take-home pay is three charges on three different bases — income tax
 * reduced by credits rather than by an allowance, USC with its own bands, and
 * PRSI — so they appear as three deduction lines.
 *
 * Ireland changes bands, credits and USC thresholds in the Budget each October,
 * which makes the year table more useful here than anywhere else on the site.
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

interface IrishYear {
  readonly label: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly confidence: YearConfidence;
  /** Standard rate band for a single person, on taxable income. */
  readonly standardRateBand: number;
  readonly personalCredit: number;
  readonly employeeCredit: number;
  readonly uscBands: readonly Band[];
  readonly uscExemption: number;
  readonly prsiRatePercent: number;
  readonly prsiThreshold: number;
  readonly note?: string;
}

const IRISH_YEARS: readonly IrishYear[] = [
  {
    label: '2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    confidence: 'uncertain',
    standardRateBand: 44000,
    personalCredit: 2000,
    employeeCredit: 2000,
    uscBands: [
      { label: 'First band', from: 0, to: 12012, ratePercent: 0.5 },
      { label: 'Second band', from: 12012, to: 27382, ratePercent: 2 },
      { label: 'Third band', from: 27382, to: 70044, ratePercent: 3 },
      { label: 'Top band', from: 70044, to: null, ratePercent: 8 },
    ],
    uscExemption: 13000,
    prsiRatePercent: 4.1,
    prsiThreshold: 18304,
    note: 'Carried forward from 2025 unchanged. Budget 2026 almost certainly moved the standard rate band and the credits, and PRSI was on a schedule of stepped increases — check all three before relying on this year.',
  },
  {
    label: '2025',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    confidence: 'likely',
    standardRateBand: 44000,
    personalCredit: 2000,
    employeeCredit: 2000,
    uscBands: [
      { label: 'First band', from: 0, to: 12012, ratePercent: 0.5 },
      { label: 'Second band', from: 12012, to: 27382, ratePercent: 2 },
      { label: 'Third band', from: 27382, to: 70044, ratePercent: 3 },
      { label: 'Top band', from: 70044, to: null, ratePercent: 8 },
    ],
    uscExemption: 13000,
    prsiRatePercent: 4.1,
    prsiThreshold: 18304,
  },
  {
    label: '2024',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    confidence: 'settled',
    standardRateBand: 42000,
    personalCredit: 1875,
    employeeCredit: 1875,
    uscBands: [
      { label: 'First band', from: 0, to: 12012, ratePercent: 0.5 },
      { label: 'Second band', from: 12012, to: 25760, ratePercent: 2 },
      { label: 'Third band', from: 25760, to: 70044, ratePercent: 4 },
      { label: 'Top band', from: 70044, to: null, ratePercent: 8 },
    ],
    uscExemption: 13000,
    prsiRatePercent: 4,
    prsiThreshold: 18304,
    note: 'PRSI rose from 4% to 4.1% part-way through this year. A single annual rate cannot express that, so 4% is used and PRSI is slightly understated for the final quarter.',
  },
];

const SOURCES = [
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
] as const;

function buildIrishRuleset(year: IrishYear): Ruleset {
  return defineAwaitingSourceRuleset({
    id: `ireland-${year.label}`,
    jurisdiction: 'ireland',
    subJurisdiction: null,
    subJurisdictionLabel: null,
    incomeTaxLabel: 'Income Tax',
    currency: 'EUR',
    locale: 'en-IE',
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
        'Single individual, PAYE employee, Class A PRSI, tax resident in Ireland for the whole year, no dependants.',
      residency: 'Irish tax resident for the whole calendar year',
      employmentType: 'PAYE employee, PRSI Class A',
    },
    assumptions: [
      'Civil status is single with no dependants. Married and civil-partner band and credit transfers change the result materially and are not modelled.',
      'PRSI Class A is assumed. Other classes have different rates.',
      'Only the personal and PAYE (employee) tax credits are applied.',
      'The tapered PRSI credit for weekly earnings just above the threshold is not modelled, so PRSI is slightly overstated near it.',
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
    changeNotes: year.note ? [year.note] : [],
    rules: {
      // No personal allowance: all income is taxable, then credits reduce the tax.
      incomeTaxBands: [
        { label: 'Standard rate', from: 0, to: year.standardRateBand, ratePercent: 20 },
        { label: 'Higher rate', from: year.standardRateBand, to: null, ratePercent: 40 },
      ],
      allowances: [],
      credits: [
        {
          id: 'personal-credit',
          label: 'Personal Tax Credit',
          amount: year.personalCredit,
          kind: 'non-refundable',
          ratePercent: null,
          taperThreshold: null,
          taperWithdrawnPerUnit: null,
          taperFloorAmount: 0,
          sourceIds: ['revenue-tax-rates-bands'],
        },
        {
          id: 'employee-credit',
          label: 'Employee (PAYE) Tax Credit',
          amount: year.employeeCredit,
          kind: 'non-refundable',
          ratePercent: null,
          taperThreshold: null,
          taperWithdrawnPerUnit: null,
          taperFloorAmount: 0,
          sourceIds: ['revenue-tax-rates-bands'],
        },
      ],
      levies: [],
      contributions: [
        {
          id: 'usc',
          label: 'Universal Social Charge',
          bands: year.uscBands.map((band) => ({ ...band })),
          exemptBelow: year.uscExemption,
          maximumContribution: null,
          maximumEarnings: null,
          sourceIds: ['revenue-usc'],
        },
        {
          id: 'prsi',
          label: 'PRSI (Class A)',
          bands: [{ label: 'Class A', from: 0, to: null, ratePercent: year.prsiRatePercent }],
          exemptBelow: year.prsiThreshold,
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
}

export const irelandRulesets: readonly Ruleset[] = IRISH_YEARS.map(buildIrishRuleset);
export const ireland2026 = irelandRulesets[0] as Ruleset;
