/**
 * Canada rulesets for the 2026 calendar tax year.
 *
 * Canadian take-home pay is federal tax plus provincial/territorial tax plus
 * payroll contributions, so it is modelled as a *composed* calculation: one
 * federal ruleset, plus one ruleset per province or territory that references
 * it. That keeps the federal figures in exactly one place and lets a province
 * be published independently once its own tests pass.
 *
 * Quebec is not a variant of the pattern — it collects its own provincial tax,
 * runs QPP instead of CPP, and adds QPIP — so its ruleset carries an explicit
 * flag and its own source list pointing at Revenu Québec as well as the CRA.
 *
 * Rate tables are empty. See ../_shared.ts for why.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { AWAITING_SOURCE_NOTE, defineAwaitingSourceRuleset } from '../_shared.ts';

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

const COMMON = {
  jurisdiction: 'canada',
  currency: 'CAD',
  locale: 'en-CA',
  status: 'draft',
  taxPeriod: TAX_PERIOD,
  expiresOn: '2026-12-31',
  provenance: {
    dataStatus: 'awaiting-official-source',
    checkedOn: null,
    checkedBy: null,
    note: AWAITING_SOURCE_NOTE,
  },
  supportedProfile: {
    description:
      'Resident of the stated province for the whole calendar year, employed, claiming only the basic personal amounts, no dependants.',
    residency: 'Resident of the stated province on 31 December',
    employmentType: 'Employee with T4 employment income',
  },
  assumptions: [
    'Only the federal and provincial basic personal amounts are claimed.',
    'The province of residence on 31 December determines provincial tax, regardless of where the income was earned.',
    'Contributions are annualised. Real payroll stops CPP/QPP and EI/QPIP mid-year once the annual maximum is reached, so individual pay periods differ.',
    'Employer-paid contributions are not deducted from the take-home figure shown.',
  ],
  exclusions: [
    'Spousal, dependant, age, disability, and tuition credits',
    'RRSP deductions and pension adjustments',
    'Provincial surtaxes, health premiums, and low-income reductions unless explicitly present in the populated ruleset',
    'Self-employment income and CPP self-employed contribution rates',
    'Residents of more than one province during the year',
  ],
  changeNotes: [],
  rules: {
    incomeTaxBands: [],
    allowances: [],
    credits: [],
    levies: [],
    contributions: [],
    optionalSchemes: {},
    rounding: {
      taxableIncome: 'none',
      taxDue: 'half-up-to-minor',
      note: 'Rounding policy must be confirmed against CRA publication T4127 before publication.',
    },
  },
} as const;

/** Federal layer. Every provincial ruleset composes with exactly this one. */
export const canadaFederal2026: Ruleset = defineAwaitingSourceRuleset({
  ...COMMON,
  id: 'canada-federal-2026',
  subJurisdiction: null,
  subJurisdictionLabel: 'Federal',
  sources: FEDERAL_SOURCES.map((source) => ({ ...source })),
});

interface ProvinceSpec {
  readonly code: string;
  readonly label: string;
  readonly sourceUrl: string;
  readonly sourcePublisher: string;
  readonly isQuebec?: boolean;
}

const LAUNCH_PROVINCES: readonly ProvinceSpec[] = [
  {
    code: 'ontario',
    label: 'Ontario',
    sourcePublisher: 'Canada Revenue Agency',
    sourceUrl:
      'https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables.html',
  },
  {
    code: 'british-columbia',
    label: 'British Columbia',
    sourcePublisher: 'Canada Revenue Agency',
    sourceUrl:
      'https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables.html',
  },
  {
    code: 'alberta',
    label: 'Alberta',
    sourcePublisher: 'Canada Revenue Agency',
    sourceUrl:
      'https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables.html',
  },
  {
    code: 'quebec',
    label: 'Quebec',
    sourcePublisher: 'Revenu Québec',
    sourceUrl:
      'https://www.revenuquebec.ca/en/businesses/source-deductions-and-employer-contributions/',
    isQuebec: true,
  },
];

function buildProvince(spec: ProvinceSpec): Ruleset {
  return defineAwaitingSourceRuleset({
    ...COMMON,
    id: `canada-${spec.code}-2026`,
    subJurisdiction: spec.code,
    subJurisdictionLabel: spec.label,
    sources: [
      ...FEDERAL_SOURCES.map((source) => ({ ...source })),
      {
        id: `${spec.code}-provincial-rates`,
        title: `${spec.label} provincial income tax rates and payroll deduction tables`,
        publisher: spec.sourcePublisher,
        url: spec.sourceUrl,
        checkedOn: null,
      },
    ],
    assumptions: spec.isQuebec
      ? [
          ...COMMON.assumptions,
          'Quebec administers its own provincial income tax through Revenu Québec, uses QPP in place of CPP, and adds QPIP premiums. Federal tax is reduced by the Quebec abatement. All four points must be sourced separately before this province is published.',
        ]
      : [...COMMON.assumptions],
    rules: {
      ...COMMON.rules,
      optionalSchemes: {
        federalRulesetId: 'canada-federal-2026',
        usesQpp: spec.isQuebec === true,
        usesQpip: spec.isQuebec === true,
        hasFederalAbatement: spec.isQuebec === true,
      },
    },
  });
}

export const canadaProvincialRulesets: readonly Ruleset[] = LAUNCH_PROVINCES.map(buildProvince);

export const canadaRulesets: readonly Ruleset[] = [canadaFederal2026, ...canadaProvincialRulesets];
