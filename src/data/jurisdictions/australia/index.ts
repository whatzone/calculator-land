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
  /**
   * HELP and study loan repayments.
   *
   * The shape of this changed on 1 July 2025, not just the numbers. Until then
   * a rate was read from a band table and applied to the *whole* of repayment
   * income, so earning one dollar more at a band edge could cost hundreds.
   * From 2025-26 it is marginal: nothing below the threshold, then a rate on
   * each slice above it. Holding the method per year is the only honest way to
   * carry both.
   */
  readonly help: {
    readonly method: 'banded-rate-on-total' | 'marginal-bands';
    readonly threshold: number;
    readonly bands: readonly Band[];
  };
  readonly note?: string;
}

/**
 * The old whole-income scale, used through 2024-25. Each band's rate applies
 * to all of income once you reach it.
 */
const HELP_BANDS_2024_25: readonly Band[] = [
  { label: 'Below the first threshold', from: 0, to: 54435, ratePercent: 0 },
  { label: 'First band', from: 54435, to: 62851, ratePercent: 1 },
  { label: 'Second band', from: 62851, to: 66621, ratePercent: 2 },
  { label: 'Third band', from: 66621, to: 70619, ratePercent: 2.5 },
  { label: 'Fourth band', from: 70619, to: 74856, ratePercent: 3 },
  { label: 'Fifth band', from: 74856, to: 79347, ratePercent: 3.5 },
  { label: 'Sixth band', from: 79347, to: 84108, ratePercent: 4 },
  { label: 'Seventh band', from: 84108, to: 89155, ratePercent: 4.5 },
  { label: 'Eighth band', from: 89155, to: 94504, ratePercent: 5 },
  { label: 'Ninth band', from: 94504, to: 100175, ratePercent: 5.5 },
  { label: 'Tenth band', from: 100175, to: 106186, ratePercent: 6 },
  { label: 'Eleventh band', from: 106186, to: 112557, ratePercent: 6.5 },
  { label: 'Twelfth band', from: 112557, to: 119310, ratePercent: 7 },
  { label: 'Thirteenth band', from: 119310, to: 126468, ratePercent: 7.5 },
  { label: 'Fourteenth band', from: 126468, to: 134056, ratePercent: 8 },
  { label: 'Fifteenth band', from: 134056, to: 142100, ratePercent: 8.5 },
  { label: 'Sixteenth band', from: 142100, to: 150626, ratePercent: 9 },
  { label: 'Seventeenth band', from: 150626, to: 159663, ratePercent: 9.5 },
  { label: 'Top band', from: 159663, to: null, ratePercent: 10 },
];

/**
 * The marginal scale from 2025-26. Measured from the threshold, so the first
 * band is the first $58,000 of income *above* $67,000.
 */
const HELP_BANDS_MARGINAL: readonly Band[] = [
  { label: 'First band', from: 0, to: 58000, ratePercent: 15 },
  { label: 'Top band', from: 58000, to: null, ratePercent: 17 },
];

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
    help: { method: 'marginal-bands' as const, threshold: 67000, bands: HELP_BANDS_MARGINAL },
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
    help: { method: 'marginal-bands' as const, threshold: 67000, bands: HELP_BANDS_MARGINAL },
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
    help: { method: 'banded-rate-on-total' as const, threshold: 54435, bands: HELP_BANDS_2024_25 },
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
  {
    id: 'ato-study-loan-repayment',
    title: 'Study and training loan repayment thresholds and rates',
    publisher: 'Australian Taxation Office',
    url: 'https://www.ato.gov.au/tax-rates-and-codes/study-and-training-loan-repayment-thresholds-and-rates',
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
      'HELP repayments are calculated on salary alone. The ATO assesses them on repayment income, which adds back reportable fringe benefits, super contributions and investment losses, so a real repayment can be higher.',
    ],
    exclusions: [
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
      loanRepayments: [
        {
          id: 'help-repayment',
          label: 'HELP repayment',
          selector: 'help',
          method: year.help.method,
          threshold: year.help.threshold,
          ratePercent: 0,
          bands: year.help.bands.map((band) => ({ ...band })),
          sourceIds: ['ato-study-loan-repayment'],
        },
      ],
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
