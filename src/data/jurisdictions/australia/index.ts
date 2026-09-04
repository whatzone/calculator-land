/**
 * Australia ruleset for the 2026-27 income year (1 July to 30 June).
 *
 * Superannuation is deliberately absent from the deductions: the guarantee is
 * an employer cost paid on top of salary, so subtracting it would understate
 * every take-home figure.
 *
 * PROVENANCE: unverified. See `unverifiedNote` in ../_shared.ts. This is the
 * least certain of the five markets, because the 2026-27 income year began
 * after the point to which the figures below are known.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { defineAwaitingSourceRuleset, unverifiedNote } from '../_shared.ts';

export const australia2026_27: Ruleset = defineAwaitingSourceRuleset({
  id: 'australia-2026-27',
  jurisdiction: 'australia',
  subJurisdiction: null,
  subJurisdictionLabel: null,
  incomeTaxLabel: 'Income Tax',
  currency: 'AUD',
  locale: 'en-AU',
  status: 'published',
  taxPeriod: { label: '2026-27', startDate: '2026-07-01', endDate: '2027-06-30' },
  expiresOn: '2027-06-30',
  provenance: {
    dataStatus: 'unverified',
    checkedOn: null,
    checkedBy: null,
    note: unverifiedNote(
      'Least certain of the five markets. The 2026-27 income year began after the point to ' +
        'which these figures are known, and the lowest marginal rate was legislated to fall to ' +
        '15% from 1 July 2026 — that change is reflected here but should be confirmed first. ' +
        'The Medicare levy thresholds are indexed annually and are almost certainly slightly out.',
    ),
  },
  sources: [
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
      url: 'https://www.ato.gov.au/tax-rates-and-codes/study-and-training-support-loans-rates-and-repayment-thresholds',
      checkedOn: null,
    },
  ],
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
    'The low income tax offset is applied. It is not a payment — it reduces tax due and cannot take it below zero.',
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
  changeNotes: [],
  rules: {
    incomeTaxBands: [
      { label: 'Tax-free threshold', from: 0, to: 18200, ratePercent: 0 },
      { label: 'First band', from: 18200, to: 45000, ratePercent: 15 },
      { label: 'Second band', from: 45000, to: 135000, ratePercent: 30 },
      { label: 'Third band', from: 135000, to: 190000, ratePercent: 37 },
      { label: 'Top band', from: 190000, to: null, ratePercent: 45 },
    ],
    allowances: [],
    credits: [
      // The low income tax offset withdraws in two stages, so it is expressed
      // as two credits with different thresholds rather than one compound rule.
      // Together: $700 maximum, gone by about $66,667.
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
        // Charged on the whole of taxable income once fully liable, not on the
        // part above the threshold.
        basis: 'whole-income',
        floor: 0,
        ceiling: null,
        exemptBelow: 27222,
        phaseInTo: 34027,
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

export const australiaRulesets: readonly Ruleset[] = [australia2026_27];
