/**
 * Australia rulesets, one per income year (1 July to 30 June).
 *
 * Superannuation is deliberately absent from the deductions: the guarantee is
 * an employer cost paid on top of salary, so subtracting it would understate
 * every take-home figure.
 *
 * PROVENANCE: unverified throughout, and this is the least certain market on
 * the site. See ../_shared.ts.
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

interface AustralianYear {
  readonly label: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly confidence: YearConfidence;
  readonly bands: readonly Band[];
  /** No Medicare levy at or below this income. */
  readonly medicareExemptBelow: number;
  /** Top of the shade-in band, above which the full rate applies to all income. */
  readonly medicarePhaseInTo: number;
  readonly note?: string;
}

const AUSTRALIAN_YEARS: readonly AustralianYear[] = [
  {
    label: '2026-27',
    startDate: '2026-07-01',
    endDate: '2027-06-30',
    confidence: 'uncertain',
    bands: [
      { label: 'Tax-free threshold', from: 0, to: 18200, ratePercent: 0 },
      { label: 'First band', from: 18200, to: 45000, ratePercent: 15 },
      { label: 'Second band', from: 45000, to: 135000, ratePercent: 30 },
      { label: 'Third band', from: 135000, to: 190000, ratePercent: 37 },
      { label: 'Top band', from: 190000, to: null, ratePercent: 45 },
    ],
    medicareExemptBelow: 27222,
    medicarePhaseInTo: 34027,
    note: 'The lowest marginal rate was legislated to fall from 16% to 15% from 1 July 2026. That change is reflected here and should be confirmed first. The Medicare levy thresholds are indexed annually and are carried forward from the previous year, so they are almost certainly slightly out.',
  },
  {
    label: '2025-26',
    startDate: '2025-07-01',
    endDate: '2026-06-30',
    confidence: 'likely',
    bands: [
      { label: 'Tax-free threshold', from: 0, to: 18200, ratePercent: 0 },
      { label: 'First band', from: 18200, to: 45000, ratePercent: 16 },
      { label: 'Second band', from: 45000, to: 135000, ratePercent: 30 },
      { label: 'Third band', from: 135000, to: 190000, ratePercent: 37 },
      { label: 'Top band', from: 190000, to: null, ratePercent: 45 },
    ],
    medicareExemptBelow: 27222,
    medicarePhaseInTo: 34027,
  },
  {
    label: '2024-25',
    startDate: '2024-07-01',
    endDate: '2025-06-30',
    confidence: 'settled',
    bands: [
      { label: 'Tax-free threshold', from: 0, to: 18200, ratePercent: 0 },
      { label: 'First band', from: 18200, to: 45000, ratePercent: 16 },
      { label: 'Second band', from: 45000, to: 135000, ratePercent: 30 },
      { label: 'Third band', from: 135000, to: 190000, ratePercent: 37 },
      { label: 'Top band', from: 190000, to: null, ratePercent: 45 },
    ],
    medicareExemptBelow: 26000,
    medicarePhaseInTo: 32500,
    note: 'The first year of the revised stage three rates, which cut the lowest rate to 16% and moved the upper thresholds.',
  },
];

const SOURCES = [
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
    id: 'ato-lito',
    title: 'Low income tax offset',
    publisher: 'Australian Taxation Office',
    url: 'https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/tax-offsets/low-and-middle-income-earners',
    checkedOn: null,
  },
] as const;

function buildAustralianRuleset(year: AustralianYear): Ruleset {
  return defineAwaitingSourceRuleset({
    id: `australia-${year.label}`,
    jurisdiction: 'australia',
    subJurisdiction: null,
    subJurisdictionLabel: null,
    incomeTaxLabel: 'Income Tax',
    currency: 'AUD',
    locale: 'en-AU',
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
        'Australian tax resident for the full income year, single, employed, claiming the tax-free threshold, no private health insurance considerations.',
      residency: 'Australian resident for tax purposes, full income year',
      employmentType: 'Employee with PAYG withholding',
    },
    assumptions: [
      'The tax-free threshold is claimed from this employer.',
      'Full-year Australian residency. Working-holiday-maker and foreign-resident scales are different and are not modelled.',
      'The Medicare levy is applied at the ordinary single rate, with the shade-in band between the lower threshold and full liability.',
      'The low income tax offset is applied. It reduces tax due and cannot take it below zero.',
      'The superannuation guarantee is paid by your employer on top of this salary and is therefore not deducted.',
      'HELP and study loan repayments are not included, because their bands change every July and could not be sourced.',
    ],
    exclusions: [
      'HELP and other study and training loan repayments',
      'Medicare levy surcharge and the private health insurance rebate',
      'Medicare levy reductions for families and dependants',
      'Working holiday makers and foreign residents',
      'Salary sacrifice and reportable employer superannuation contributions',
      'Capital gains, investment, and business income',
    ],
    changeNotes: year.note ? [year.note] : [],
    rules: {
      incomeTaxBands: year.bands.map((band) => ({ ...band })),
      allowances: [],
      // The low income tax offset withdraws in two stages, expressed as two
      // credits rather than one compound rule. Together: $700, gone by ~$66,667.
      credits: [
        {
          id: 'lito-first-stage',
          label: 'Low income tax offset (first stage)',
          amount: 375,
          kind: 'non-refundable',
          ratePercent: null,
          taperThreshold: 37500,
          taperWithdrawnPerUnit: 0.05,
          taperFloorAmount: 0,
          sourceIds: ['ato-lito'],
        },
        {
          id: 'lito-second-stage',
          label: 'Low income tax offset (second stage)',
          amount: 325,
          kind: 'non-refundable',
          ratePercent: null,
          taperThreshold: 45000,
          taperWithdrawnPerUnit: 0.015,
          taperFloorAmount: 0,
          sourceIds: ['ato-lito'],
        },
      ],
      levies: [
        {
          id: 'medicare-levy',
          label: 'Medicare levy',
          ratePercent: 2,
          basis: 'whole-income',
          floor: 0,
          ceiling: null,
          exemptBelow: year.medicareExemptBelow,
          phaseInTo: year.medicarePhaseInTo,
          phaseInRatePercent: 10,
          sourceIds: ['ato-medicare-levy'],
        },
      ],
      contributions: [],
      surtaxes: [],
      loanRepayments: [],
      optionalSchemes: {},
      rounding: {
        taxableIncome: 'none',
        taxDue: 'half-up-to-minor',
        note: 'Rounding policy not confirmed against ATO guidance.',
      },
    },
  });
}

export const australiaRulesets: readonly Ruleset[] = AUSTRALIAN_YEARS.map(buildAustralianRuleset);
export const australia2026_27 = australiaRulesets[0] as Ruleset;
