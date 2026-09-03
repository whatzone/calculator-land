/**
 * Global calculators — the tools that need no tax data.
 *
 * These are the only calculators on the site that can be indexed today, because
 * their correctness depends on arithmetic that is the same everywhere rather
 * than on rates that must be verified against a tax authority. Their
 * `indexableWithoutTaxData` flag is what tells the quality gate that.
 */
import { z } from 'zod';
import { money } from '../../calculations/common/money.ts';
import { amortise, compareOverpayment } from '../../calculations/global/mortgage.ts';
import { convertHourly } from '../../calculations/global/hourly.ts';
import { presentHourly, presentMortgage, presentOverpayment } from '../presenters.ts';
import type { CurrencyCode, PayFrequency } from '../../calculations/common/types.ts';
import type { CalculatorDefinition, CalculatorFieldDefinition } from '../types.ts';

const valueSchema = z.record(z.string(), z.unknown());
type Values = Record<string, unknown>;

const CURRENCY_OPTIONS = [
  { value: 'GBP', label: 'Pounds (£)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'AUD', label: 'Australian dollars (A$)' },
  { value: 'NZD', label: 'New Zealand dollars (NZ$)' },
  { value: 'CAD', label: 'Canadian dollars (C$)' },
  { value: 'USD', label: 'US dollars ($)' },
];

const currencyField: CalculatorFieldDefinition = {
  name: 'currency',
  label: 'Currency',
  type: 'select',
  required: true,
  defaultValue: 'GBP',
  options: CURRENCY_OPTIONS,
  help: 'Only changes how figures are displayed. The arithmetic is the same in every currency.',
};

function readCurrency(values: Values): CurrencyCode {
  const value = String(values['currency'] ?? 'GBP');
  return (
    CURRENCY_OPTIONS.some((option) => option.value === value) ? value : 'GBP'
  ) as CurrencyCode;
}

function readNumber(values: Values, key: string, fallback: number): number {
  const raw = values[key];
  const parsed = typeof raw === 'number' ? raw : Number(String(raw ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

const MORTGAGE_LIMITATIONS = [
  'This is arithmetic, not a lending decision. It does not assess affordability, eligibility, or whether any lender would offer this loan.',
  'Product fees, valuation fees, insurance, and early repayment charges are excluded.',
  'A rate change at the end of a fixed period is not modelled; the rate entered is applied for the whole term.',
  'Interest-only, offset, and part-and-part mortgages are not modelled.',
];

export const hourlyToSalary: CalculatorDefinition<Values, ReturnType<typeof convertHourly>> = {
  id: 'global-hourly-to-salary',
  family: 'general-finance',
  slug: 'hourly-to-salary',
  title: 'Hourly to Salary Calculator',
  shortTitle: 'Hourly to salary',
  description:
    'Convert a rate of pay between hourly, daily, weekly, monthly and yearly, using your own hours and weeks. These are gross figures before tax, so the answer is the same wherever you live.',
  metaDescription:
    'Convert hourly pay to an annual salary, or an annual salary back to an hourly rate, using your own hours per week and weeks per year.',
  jurisdictions: ['global'],
  inputSchema: valueSchema,
  fields: [
    {
      name: 'amount',
      label: 'Amount you are paid',
      type: 'money',
      required: true,
      min: 0,
      max: 10_000_000,
      step: 0.01,
      inputMode: 'decimal',
      help: 'Enter the figure, then choose below what period it covers.',
    },
    {
      name: 'inputFrequency',
      label: 'Paid every',
      type: 'select',
      required: true,
      defaultValue: 'hourly',
      options: [
        { value: 'hourly', label: 'Hour' },
        { value: 'weekly', label: 'Week' },
        { value: 'fortnightly', label: 'Fortnight' },
        { value: 'monthly', label: 'Month' },
        { value: 'annual', label: 'Year' },
      ],
    },
    {
      name: 'hoursPerWeek',
      label: 'Hours a week',
      type: 'number',
      required: true,
      defaultValue: 37.5,
      min: 0.5,
      max: 100,
      step: 0.5,
      inputMode: 'decimal',
      help: 'Your contracted paid hours, not including unpaid breaks.',
    },
    {
      name: 'weeksPerYear',
      label: 'Weeks a year',
      type: 'number',
      required: true,
      defaultValue: 52,
      min: 1,
      max: 52,
      step: 1,
      inputMode: 'numeric',
      help: 'Use 52 if your holiday is paid. Use your worked weeks if it is not.',
    },
    currencyField,
  ],
  calculate: (values) =>
    convertHourly({
      amount: money(String(values['amount'] ?? 0)),
      inputFrequency: String(values['inputFrequency'] ?? 'hourly') as PayFrequency,
      hoursPerWeek: readNumber(values, 'hoursPerWeek', 37.5),
      weeksPerYear: readNumber(values, 'weeksPerYear', 52),
      currency: readCurrency(values),
    }),
  present: (result, context) => presentHourly(result, context),
  assumptions: [
    {
      id: 'gross',
      text: 'Every figure is gross pay, before income tax and any social contributions.',
    },
    {
      id: 'even',
      text: 'Hours are assumed to be the same every week, with no overtime or shift premium.',
    },
    { id: 'day', text: 'A working day is taken as your weekly hours divided by five.' },
  ],
  sources: [],
  limitations: [
    'No tax, national insurance, or social contributions are deducted. Use the country calculator for take-home pay.',
    'Overtime, shift premiums, tips, commission, and bonuses are excluded.',
    'Unpaid breaks are not deducted; enter paid hours only.',
  ],
  relatedCalculatorIds: [
    'uk-salary',
    'ireland-salary',
    'australia-salary',
    'new-zealand-salary',
    'canada-salary',
  ],
  indexability: { requiresPublishedRuleset: false, rulesetIds: [], indexableWithoutTaxData: true },
  analytics: { toolId: 'global-hourly-to-salary', category: 'general-finance' },
  testFixtures: ['tests/unit/hourly.test.ts'],
  status: 'published',
};

export const mortgagePayment: CalculatorDefinition<Values, ReturnType<typeof amortise>> = {
  id: 'global-mortgage-payment',
  family: 'mortgage',
  slug: 'monthly-payment',
  title: 'Mortgage Payment Calculator',
  shortTitle: 'Mortgage payment',
  description:
    'Work out the monthly payment on a repayment mortgage, the total interest over the term, and how the balance falls year by year. The formula and every assumption are shown.',
  metaDescription:
    'Calculate a repayment mortgage monthly payment, total interest, and full amortisation schedule, with the formula and assumptions shown.',
  jurisdictions: ['global'],
  inputSchema: valueSchema,
  fields: [
    {
      name: 'principal',
      label: 'Amount borrowed',
      type: 'money',
      required: true,
      min: 1,
      max: 100_000_000,
      step: 1000,
      inputMode: 'decimal',
      help: 'The loan amount, not the property price.',
    },
    {
      name: 'annualRatePercent',
      label: 'Interest rate',
      type: 'percent',
      required: true,
      defaultValue: 5,
      min: 0,
      max: 30,
      step: 0.01,
      suffix: '%',
      inputMode: 'decimal',
      help: 'The annual rate. A rate of zero is handled correctly.',
    },
    {
      name: 'termYears',
      label: 'Term',
      type: 'number',
      required: true,
      defaultValue: 25,
      min: 1,
      max: 40,
      step: 1,
      suffix: 'years',
      inputMode: 'numeric',
    },
    currencyField,
  ],
  calculate: (values) =>
    amortise({
      principal: money(String(values['principal'] ?? 0)),
      annualRatePercent: money(String(values['annualRatePercent'] ?? 0)),
      termYears: readNumber(values, 'termYears', 25),
    }),
  present: (result, context) => presentMortgage(result, context),
  assumptions: [
    { id: 'fixed-rate', text: 'The rate is assumed to stay the same for the whole term.' },
    { id: 'monthly', text: 'Interest is charged on the balance at the start of each month.' },
    {
      id: 'final',
      text: 'The final payment absorbs the rounding residue, as lenders do, so the balance ends at exactly zero.',
    },
  ],
  sources: [],
  limitations: MORTGAGE_LIMITATIONS,
  relatedCalculatorIds: ['global-mortgage-overpayment'],
  indexability: { requiresPublishedRuleset: false, rulesetIds: [], indexableWithoutTaxData: true },
  analytics: { toolId: 'global-mortgage-payment', category: 'mortgage' },
  testFixtures: ['tests/unit/mortgage.test.ts'],
  status: 'published',
};

export const mortgageOverpayment: CalculatorDefinition<
  Values,
  ReturnType<typeof compareOverpayment>
> = {
  id: 'global-mortgage-overpayment',
  family: 'mortgage',
  slug: 'overpayment',
  title: 'Mortgage Overpayment Calculator',
  shortTitle: 'Mortgage overpayment',
  description:
    'Compare a mortgage repaid on schedule with the same mortgage repaid faster, and see how much interest overpaying saves and how much sooner the loan ends.',
  metaDescription:
    'See how much interest a mortgage overpayment saves and how many years it takes off the term, compared side by side with the original schedule.',
  jurisdictions: ['global'],
  inputSchema: valueSchema,
  fields: [
    {
      name: 'principal',
      label: 'Amount outstanding',
      type: 'money',
      required: true,
      min: 1,
      max: 100_000_000,
      step: 1000,
      inputMode: 'decimal',
      help: 'The balance you owe now.',
    },
    {
      name: 'annualRatePercent',
      label: 'Interest rate',
      type: 'percent',
      required: true,
      defaultValue: 5,
      min: 0,
      max: 30,
      step: 0.01,
      suffix: '%',
      inputMode: 'decimal',
    },
    {
      name: 'termYears',
      label: 'Years left',
      type: 'number',
      required: true,
      defaultValue: 25,
      min: 1,
      max: 40,
      step: 1,
      suffix: 'years',
      inputMode: 'numeric',
    },
    {
      name: 'monthlyOverpayment',
      label: 'Extra each month',
      type: 'money',
      required: false,
      defaultValue: 0,
      min: 0,
      max: 100_000,
      step: 10,
      inputMode: 'decimal',
      help: 'Paid on top of your contractual payment, every month.',
    },
    {
      name: 'lumpSum',
      label: 'One-off lump sum',
      type: 'money',
      required: false,
      defaultValue: 0,
      min: 0,
      max: 100_000_000,
      step: 1000,
      advanced: true,
      inputMode: 'decimal',
      help: 'Paid once, now, before the schedule starts.',
    },
    currencyField,
  ],
  calculate: (values) =>
    compareOverpayment({
      principal: money(String(values['principal'] ?? 0)),
      annualRatePercent: money(String(values['annualRatePercent'] ?? 0)),
      termYears: readNumber(values, 'termYears', 25),
      monthlyOverpayment: money(String(values['monthlyOverpayment'] ?? 0)),
      lumpSum: money(String(values['lumpSum'] ?? 0)),
    }),
  present: (result, context) => presentOverpayment(result, context),
  assumptions: [
    {
      id: 'term',
      text: 'Overpayments are assumed to shorten the term rather than reduce the monthly payment. Lenders often offer both, and the choice changes the outcome substantially.',
    },
    {
      id: 'erc',
      text: 'Early repayment charges are excluded. Many fixed-rate deals cap annual overpayments.',
    },
    {
      id: 'opportunity',
      text: 'No return is assumed on money that could have been saved or invested instead.',
    },
  ],
  sources: [],
  limitations: [
    ...MORTGAGE_LIMITATIONS,
    'Whether overpaying is better than saving or investing the same money is a personal decision this tool does not make.',
  ],
  relatedCalculatorIds: ['global-mortgage-payment'],
  indexability: { requiresPublishedRuleset: false, rulesetIds: [], indexableWithoutTaxData: true },
  analytics: { toolId: 'global-mortgage-overpayment', category: 'mortgage' },
  testFixtures: ['tests/unit/mortgage.test.ts'],
  status: 'published',
};

export const globalCalculators = [hourlyToSalary, mortgagePayment, mortgageOverpayment] as const;
