/**
 * The salary-tax calculator factory.
 *
 * Four tools — salary, net-to-gross, bonus, and pay rise — are generated for
 * each launch market from one jurisdiction description. This is what stops the
 * site becoming twenty hand-maintained near-duplicates: a change to how bonus
 * pages present their result is made once, here, and applies everywhere.
 *
 * Each generated tool is still a distinct product answering a distinct search
 * intent. They share plumbing, not content: fields, sources, assumptions, and
 * limitations all come from the jurisdiction's own ruleset.
 */
import { z } from 'zod';
import { money } from '../../calculations/common/money.ts';
import { calculateSalary } from '../../calculations/index.ts';
import {
  calculateBonus,
  calculateNetToGross,
  calculatePayRise,
} from '../../calculations/common/scenarios.ts';
import { JURISDICTION_FREQUENCIES } from '../../calculations/common/frequency.ts';
import {
  currentPeriodFor,
  findRuleset,
  getJurisdiction,
  rulesetsFor,
  taxPeriodsFor,
} from '../../../data/jurisdictions/index.ts';
import { CURRENCY_SYMBOLS } from '../../formatting/index.ts';
import { presentBonus, presentNetToGross, presentPayRise, presentSalary } from '../presenters.ts';
import type {
  CalculationContext,
  CalculationInput,
  CurrencyCode,
  JurisdictionCode,
} from '../../calculations/common/types.ts';
import type { CalculatorDefinition, CalculatorFieldDefinition, SourceReference } from '../types.ts';

/** Extra profile controls a market needs beyond the shared ones. */
const JURISDICTION_EXTRAS: Record<JurisdictionCode, readonly CalculatorFieldDefinition[]> = {
  uk: [
    {
      name: 'pensionPercent',
      label: 'Pension contribution',
      type: 'percent',
      required: false,
      defaultValue: 0,
      min: 0,
      max: 100,
      step: 0.5,
      suffix: '%',
      advanced: true,
      inputMode: 'decimal',
      help: 'The percentage of your salary you pay into a workplace or personal pension.',
    },
    {
      name: 'pensionTreatment',
      label: 'How your pension is taken',
      type: 'select',
      required: false,
      defaultValue: 'net-pay',
      advanced: true,
      help: 'Salary sacrifice reduces National Insurance as well as Income Tax. A net-pay arrangement reduces Income Tax only.',
      options: [
        { value: 'net-pay', label: 'Net pay arrangement (most common)' },
        { value: 'salary-sacrifice', label: 'Salary sacrifice' },
      ],
    },
    {
      name: 'studentLoanPlan',
      label: 'Student loan plan',
      type: 'select',
      required: false,
      defaultValue: 'none',
      help: 'Repayments are 9% of income above your plan’s threshold, and nothing below it.',
      options: [
        { value: 'none', label: 'No student loan' },
        { value: 'plan-1', label: 'Plan 1 — started before September 2012' },
        { value: 'plan-2', label: 'Plan 2 — started September 2012 to July 2023' },
        { value: 'plan-4', label: 'Plan 4 — studied in Scotland' },
        { value: 'plan-5', label: 'Plan 5 — started August 2023 or later' },
      ],
    },
    {
      // A postgraduate loan is charged on top of an undergraduate plan, not
      // instead of it, and holding both is common. Offering the two in one
      // select forced a choice that does not exist and quietly understated
      // take-home pay for anyone with both.
      name: 'hasPostgraduateLoan',
      label: 'I also have a postgraduate loan',
      type: 'checkbox',
      required: false,
      defaultValue: false,
      help: 'Repaid at 6% above its own threshold, on top of any undergraduate plan.',
    },
  ],
  ireland: [
    {
      name: 'civilStatus',
      label: 'Civil status',
      type: 'select',
      required: false,
      defaultValue: 'single',
      help: 'Only the single, no-dependants profile is currently supported.',
      options: [
        { value: 'single', label: 'Single, no dependants' },
        { value: 'married-one-income', label: 'Married or civil partner, one income' },
        { value: 'married-two-incomes', label: 'Married or civil partner, two incomes' },
      ],
    },
    {
      name: 'pensionPercent',
      label: 'Pension contribution',
      type: 'percent',
      required: false,
      defaultValue: 0,
      min: 0,
      max: 100,
      step: 0.5,
      suffix: '%',
      advanced: true,
      inputMode: 'decimal',
      help: 'Contributions reduce Income Tax but not USC or PRSI.',
    },
  ],
  australia: [
    {
      name: 'claimsTaxFreeThreshold',
      label: 'I claim the tax-free threshold from this employer',
      type: 'checkbox',
      required: false,
      defaultValue: true,
      help: 'Most people claim it from their main job.',
    },
    {
      name: 'hasHelpDebt',
      label: 'I have a HELP or study loan',
      type: 'checkbox',
      required: false,
      defaultValue: false,
      advanced: true,
      help: 'Repayments are income-based and start above a threshold.',
    },
  ],
  canada: [
    {
      name: 'province',
      label: 'Province or territory',
      type: 'select',
      required: true,
      defaultValue: 'ontario',
      help: 'Provincial tax is set by where you live on 31 December, not where you work.',
      options: [
        { value: 'ontario', label: 'Ontario' },
        { value: 'british-columbia', label: 'British Columbia' },
        { value: 'alberta', label: 'Alberta' },
        { value: 'quebec', label: 'Quebec' },
      ],
    },
  ],
};

function regionField(jurisdiction: JurisdictionCode): CalculatorFieldDefinition[] {
  const meta = getJurisdiction(jurisdiction);
  if (meta.regions.length === 0 || jurisdiction === 'canada') return [];
  return [
    {
      name: 'region',
      label: 'Where you live',
      type: 'select',
      required: true,
      defaultValue: meta.regions[0]?.code ?? '',
      help: 'Income tax rates differ between these, so the answer changes.',
      options: meta.regions.map((region) => ({ value: region.code, label: region.label })),
    },
  ];
}

const FREQUENCY_LABELS: Record<string, string> = {
  annual: 'A year',
  monthly: 'A month',
  fortnightly: 'A fortnight',
  biweekly: 'Every two weeks',
  weekly: 'A week',
  hourly: 'An hour',
};

/**
 * The tax year selector.
 *
 * Options come from the years actually held for the market, so a year can never
 * be offered that the engine cannot answer. The live year is labelled and is
 * the default; the others are marked as previous years so nobody mistakes an
 * archived result for a current one.
 */
function taxYearField(jurisdiction: JurisdictionCode): CalculatorFieldDefinition[] {
  const periods = taxPeriodsFor(jurisdiction);
  if (periods.length <= 1) return [];

  return [
    {
      name: 'taxPeriod',
      label: 'Tax year',
      type: 'select',
      required: true,
      defaultValue: currentPeriodFor(jurisdiction) ?? periods[0]?.label ?? '',
      help: 'Rates and thresholds change between years. Previous years are kept so you can check an old payslip.',
      options: periods.map((period) => ({
        value: period.label,
        label: period.isCurrent ? `${period.label} (current)` : `${period.label} (previous year)`,
      })),
    },
  ];
}

function frequencyField(jurisdiction: JurisdictionCode): CalculatorFieldDefinition {
  const frequencies = JURISDICTION_FREQUENCIES[jurisdiction] ?? ['annual', 'monthly', 'weekly'];
  return {
    name: 'payFrequency',
    label: 'How your salary is quoted',
    type: 'select',
    required: true,
    defaultValue: 'annual',
    options: frequencies.map((frequency) => ({
      value: frequency,
      label: FREQUENCY_LABELS[frequency] ?? frequency,
    })),
  };
}

function amountField(
  name: string,
  label: string,
  currency: CurrencyCode,
  help: string,
): CalculatorFieldDefinition {
  return {
    name,
    label,
    type: 'money',
    required: true,
    min: 0,
    max: 10_000_000,
    step: 1,
    prefix: CURRENCY_SYMBOLS[currency],
    inputMode: 'decimal',
    autocomplete: 'off',
    help,
  };
}

/** Sources and limitations always come from the jurisdiction's own rulesets. */
function jurisdictionSources(jurisdiction: JurisdictionCode): SourceReference[] {
  const seen = new Map<string, SourceReference>();
  for (const ruleset of rulesetsFor(jurisdiction)) {
    for (const source of ruleset.sources) {
      if (!seen.has(source.url)) seen.set(source.url, source);
    }
  }
  return [...seen.values()];
}

function contextFor(jurisdiction: JurisdictionCode, subJurisdiction?: string): CalculationContext {
  const meta = getJurisdiction(jurisdiction);
  const ruleset = findRuleset(jurisdiction, subJurisdiction) ?? findRuleset(jurisdiction);
  return {
    locale: meta.locale,
    currency: meta.currency as CurrencyCode,
    taxPeriodLabel: ruleset?.taxPeriod.label ?? 'unknown',
    rulesetVersion: ruleset?.id ?? 'unknown',
  };
}

/** Build the CalculationInput the engines expect from raw form values. */
function toCalculationInput(
  jurisdiction: JurisdictionCode,
  values: Record<string, unknown>,
  grossKey = 'grossAnnualIncome',
): CalculationInput {
  const meta = getJurisdiction(jurisdiction);
  const region =
    jurisdiction === 'canada'
      ? String(values['province'] ?? 'ontario')
      : String(values['region'] ?? meta.regions[0]?.code ?? '');

  const profile: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === grossKey || key === 'payFrequency' || key === 'region') continue;
    if (key === 'taxPeriod') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      profile[key] = value;
    }
  }

  const requested = typeof values['taxPeriod'] === 'string' ? values['taxPeriod'] : undefined;
  const ruleset = findRuleset(jurisdiction, region || null, requested);

  return {
    jurisdiction,
    ...(region ? { subJurisdiction: region } : {}),
    taxPeriod: requested ?? ruleset?.taxPeriod.label ?? 'unknown',
    grossAnnualIncome: money(String(values[grossKey] ?? 0)),
    payFrequency: 'annual',
    profile,
  };
}

const valueSchema = z.record(z.string(), z.unknown());

type Values = Record<string, unknown>;

export interface SalaryToolSet {
  readonly salary: CalculatorDefinition<Values, ReturnType<typeof calculateSalary>>;
  readonly netToGross: CalculatorDefinition<Values, ReturnType<typeof calculateNetToGross>>;
  readonly bonus: CalculatorDefinition<Values, ReturnType<typeof calculateBonus>>;
  readonly payRise: CalculatorDefinition<Values, ReturnType<typeof calculatePayRise>>;
}

export function buildSalaryToolSet(jurisdiction: JurisdictionCode): SalaryToolSet {
  const meta = getJurisdiction(jurisdiction);
  const currency = meta.currency as CurrencyCode;
  const extras = JURISDICTION_EXTRAS[jurisdiction];
  const sources = jurisdictionSources(jurisdiction);
  const primary = findRuleset(jurisdiction);
  const limitations = primary ? [...primary.exclusions] : [];
  const rulesetIds = rulesetsFor(jurisdiction).map((ruleset) => ruleset.id);
  const period = primary?.taxPeriod.label ?? '';

  const indexability = {
    requiresPublishedRuleset: true,
    rulesetIds,
    indexableWithoutTaxData: false,
  } as const;

  const commonFields = [
    ...regionField(jurisdiction),
    ...taxYearField(jurisdiction),
    frequencyField(jurisdiction),
    ...extras,
  ];

  const assumptionsFor = (extra: readonly string[] = []) => [
    ...(primary?.assumptions ?? []).map((text, index) => ({ id: `assumption-${index}`, text })),
    ...extra.map((text, index) => ({ id: `extra-${index}`, text })),
  ];

  const salary: SalaryToolSet['salary'] = {
    id: `${jurisdiction}-salary`,
    family: 'salary-tax',
    slug: 'salary-calculator',
    title: `${meta.adjective} Salary Calculator ${period}`,
    shortTitle: 'Salary calculator',
    description: `Work out your take-home pay in ${meta.name} after income tax and other deductions, with every deduction itemised and linked to its official source.`,
    metaDescription: `Free ${meta.adjective} salary calculator for ${period}. See your take-home pay a year, a month and a week, with an itemised breakdown of every deduction.`,
    jurisdictions: [jurisdiction],
    currency,
    inputSchema: valueSchema,
    fields: [
      amountField(
        'grossAnnualIncome',
        'Your salary before tax',
        currency,
        'Enter the figure on your contract or job advert.',
      ),
      ...commonFields,
    ],
    calculate: (values) => calculateSalary(toCalculationInput(jurisdiction, values)),
    present: (result, context) => presentSalary(result, context),
    assumptions: assumptionsFor(),
    sources,
    limitations,
    relatedCalculatorIds: [
      `${jurisdiction}-net-to-gross`,
      `${jurisdiction}-bonus`,
      `${jurisdiction}-pay-rise`,
      'global-hourly-to-salary',
    ],
    indexability,
    analytics: { toolId: `${jurisdiction}-salary`, category: 'salary-tax' },
    testFixtures: [`tests/fixtures/${jurisdiction}/salary.json`],
    status: 'published',
  };

  const netToGross: SalaryToolSet['netToGross'] = {
    id: `${jurisdiction}-net-to-gross`,
    family: 'salary-tax',
    slug: 'net-to-gross-calculator',
    title: `${meta.adjective} Net to Gross Salary Calculator ${period}`,
    shortTitle: 'Net to gross calculator',
    description: `Start from the take-home pay you want and find the gross salary that produces it in ${meta.name}. The answer is found by search and then verified against the forward calculation.`,
    metaDescription: `Work out the gross salary you need in ${meta.name} to take home a given amount, for ${period}.`,
    jurisdictions: [jurisdiction],
    currency,
    inputSchema: valueSchema,
    fields: [
      amountField(
        'targetNetAnnual',
        'Take-home pay you want',
        currency,
        'The amount you want to receive each year after deductions.',
      ),
      ...commonFields,
    ],
    calculate: (values) =>
      calculateNetToGross(
        calculateSalary,
        toCalculationInput(jurisdiction, values, 'targetNetAnnual'),
        money(String(values['targetNetAnnual'] ?? 0)),
      ),
    present: (result, context) => presentNetToGross(result, context),
    assumptions: assumptionsFor([
      'The gross salary is found by searching for the figure that produces your target take-home pay, then checking that figure through the forward calculation.',
      'Where no gross salary produces exactly your target, that is reported rather than rounded over.',
    ]),
    sources,
    limitations,
    relatedCalculatorIds: [`${jurisdiction}-salary`, `${jurisdiction}-pay-rise`],
    indexability,
    analytics: { toolId: `${jurisdiction}-net-to-gross`, category: 'salary-tax' },
    testFixtures: [`tests/fixtures/${jurisdiction}/net-to-gross.json`],
    status: 'published',
  };

  const bonus: SalaryToolSet['bonus'] = {
    id: `${jurisdiction}-bonus`,
    family: 'salary-tax',
    slug: 'bonus-tax-calculator',
    title: `${meta.adjective} Bonus Tax Calculator ${period}`,
    shortTitle: 'Bonus tax calculator',
    description: `See how much of a bonus you actually keep in ${meta.name}. The figure is the difference between your year with the bonus and without it, so it accounts for any threshold the bonus pushes you across.`,
    metaDescription: `Work out how much of your bonus you keep in ${meta.name} after tax and contributions, for ${period}.`,
    jurisdictions: [jurisdiction],
    currency,
    inputSchema: valueSchema,
    fields: [
      amountField(
        'grossAnnualIncome',
        'Your salary before tax',
        currency,
        'Your regular annual salary, without the bonus.',
      ),
      amountField(
        'bonusAmount',
        'Bonus before tax',
        currency,
        'The gross bonus you have been offered or paid.',
      ),
      ...commonFields,
    ],
    calculate: (values) =>
      calculateBonus(
        calculateSalary,
        toCalculationInput(jurisdiction, values),
        money(String(values['bonusAmount'] ?? 0)),
      ),
    present: (result, context) => presentBonus(result, context),
    assumptions: assumptionsFor([
      'The effective rate on a bonus is worked out by calculating the whole year twice, with and without the bonus, and taking the difference. Multiplying a bonus by a headline tax rate gives the wrong answer whenever the bonus crosses a threshold.',
    ]),
    sources,
    limitations,
    relatedCalculatorIds: [`${jurisdiction}-salary`, `${jurisdiction}-pay-rise`],
    indexability,
    analytics: { toolId: `${jurisdiction}-bonus`, category: 'salary-tax' },
    testFixtures: [`tests/fixtures/${jurisdiction}/bonus.json`],
    status: 'published',
  };

  const payRise: SalaryToolSet['payRise'] = {
    id: `${jurisdiction}-pay-rise`,
    family: 'salary-tax',
    slug: 'pay-rise-calculator',
    title: `${meta.adjective} Pay Rise Calculator ${period}`,
    shortTitle: 'Pay rise calculator',
    description: `Compare your pay before and after a rise in ${meta.name}, and see what share of the increase actually reaches your bank account.`,
    metaDescription: `See how much extra take-home pay a rise gives you in ${meta.name}, and how much of it you keep, for ${period}.`,
    jurisdictions: [jurisdiction],
    currency,
    inputSchema: valueSchema,
    fields: [
      amountField(
        'grossAnnualIncome',
        'Salary before the rise',
        currency,
        'Your current annual salary before tax.',
      ),
      amountField(
        'newGrossAnnual',
        'Salary after the rise',
        currency,
        'Your new annual salary before tax.',
      ),
      ...commonFields,
    ],
    calculate: (values) =>
      calculatePayRise(
        calculateSalary,
        toCalculationInput(jurisdiction, values),
        money(String(values['newGrossAnnual'] ?? 0)),
      ),
    present: (result, context) => presentPayRise(result, context),
    assumptions: assumptionsFor([
      'Both salaries are treated as if held for a whole tax year. A rise part-way through the year produces a different actual outcome.',
    ]),
    sources,
    limitations,
    relatedCalculatorIds: [`${jurisdiction}-salary`, `${jurisdiction}-bonus`],
    indexability,
    analytics: { toolId: `${jurisdiction}-pay-rise`, category: 'salary-tax' },
    testFixtures: [`tests/fixtures/${jurisdiction}/pay-rise.json`],
    status: 'published',
  };

  return { salary, netToGross, bonus, payRise };
}

export { contextFor, toCalculationInput };
