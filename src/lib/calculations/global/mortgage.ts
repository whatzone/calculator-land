/**
 * Mortgage payment, amortisation, and overpayment maths.
 *
 * This module states no view on whether a loan is affordable, obtainable, or
 * advisable. It computes the arithmetic of a repayment loan and shows its
 * workings. Lending decisions, affordability rules, product fees, and rate
 * changes are outside its scope and are declared as such on every page.
 *
 * Standard repayment formula, with `r` the periodic rate and `n` the number of
 * periods:
 *
 *     payment = principal * r / (1 - (1 + r)^-n)
 *
 * At r = 0 that expression is undefined, so the zero-interest case is handled
 * explicitly as principal / n rather than allowed to divide by zero.
 */
import {
  type Money,
  money,
  ZERO,
  clampAtZero,
  minOf,
  roundToMinorUnit,
  sum,
} from '../common/money.ts';

export interface MortgageInput {
  readonly principal: Money;
  /** Nominal annual interest rate as a percentage, e.g. 4.5 for 4.5%. */
  readonly annualRatePercent: Money;
  readonly termYears: number;
  /** Payments per year. 12 is the ordinary case. */
  readonly paymentsPerYear?: number;
}

export interface AmortisationRow {
  readonly period: number;
  readonly payment: Money;
  readonly interest: Money;
  readonly principal: Money;
  readonly balance: Money;
}

export interface MortgageResult {
  readonly monthlyPayment: Money;
  readonly totalPaid: Money;
  readonly totalInterest: Money;
  readonly numberOfPayments: number;
  readonly schedule: readonly AmortisationRow[];
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
}

export const MORTGAGE_ASSUMPTIONS: readonly string[] = [
  'The interest rate is assumed to stay the same for the whole term. Most real mortgages change rate at the end of a fixed period.',
  'Interest is calculated on the balance at the start of each payment period.',
  'Payments are assumed to be made in full and on time, with no payment holidays.',
  'Product fees, arrangement fees, valuation fees, insurance, and early repayment charges are excluded.',
  'This is an arithmetic projection, not a lending decision, affordability assessment, or offer.',
];

const MAX_PERIODS = 1200; // 100 years at monthly payments; a guard, not a rule.

function periodicRate(annualRatePercent: Money, paymentsPerYear: number): Money {
  return annualRatePercent.div(100).div(paymentsPerYear);
}

/** The level payment that clears the loan over the full term. */
export function monthlyPayment(input: MortgageInput): Money {
  const paymentsPerYear = input.paymentsPerYear ?? 12;
  const n = Math.round(input.termYears * paymentsPerYear);
  if (n <= 0) return ZERO;
  if (input.principal.lte(0)) return ZERO;

  const r = periodicRate(input.annualRatePercent, paymentsPerYear);

  // Zero interest: the payment is simply the principal spread over the term.
  if (r.eq(0)) return roundToMinorUnit(input.principal.div(n));

  const onePlusR = money(1).plus(r);
  const discount = money(1).minus(money(1).div(onePlusR.pow(n)));
  return roundToMinorUnit(input.principal.times(r).div(discount));
}

/**
 * Build the full amortisation schedule by simulating each period against the
 * running balance, rather than by applying a closed-form split. Simulating is
 * what makes the final payment correct: it absorbs the accumulated rounding so
 * the balance lands on exactly zero.
 */
export function amortise(input: MortgageInput, overridePayment?: Money): MortgageResult {
  const paymentsPerYear = input.paymentsPerYear ?? 12;
  const warnings: string[] = [];
  const scheduledPayments = Math.round(input.termYears * paymentsPerYear);

  if (input.principal.lte(0)) {
    return {
      monthlyPayment: ZERO,
      totalPaid: ZERO,
      totalInterest: ZERO,
      numberOfPayments: 0,
      schedule: [],
      assumptions: MORTGAGE_ASSUMPTIONS,
      warnings: ['Enter a loan amount above zero to see a repayment schedule.'],
    };
  }
  if (scheduledPayments <= 0) {
    return {
      monthlyPayment: ZERO,
      totalPaid: ZERO,
      totalInterest: ZERO,
      numberOfPayments: 0,
      schedule: [],
      assumptions: MORTGAGE_ASSUMPTIONS,
      warnings: ['Enter a term of at least one year.'],
    };
  }
  if (input.annualRatePercent.lt(0)) {
    return {
      monthlyPayment: ZERO,
      totalPaid: ZERO,
      totalInterest: ZERO,
      numberOfPayments: 0,
      schedule: [],
      assumptions: MORTGAGE_ASSUMPTIONS,
      warnings: ['A negative interest rate is not supported by this calculator.'],
    };
  }

  const payment = overridePayment ?? monthlyPayment(input);
  const r = periodicRate(input.annualRatePercent, paymentsPerYear);

  const schedule: AmortisationRow[] = [];
  let balance = input.principal;
  let period = 0;

  while (balance.gt(0) && period < MAX_PERIODS) {
    period += 1;
    const interest = roundToMinorUnit(balance.times(r));

    // The overpayment tools can produce a payment below the interest charge.
    // That loan never amortises, so say so instead of looping to the guard.
    if (period === 1 && payment.lte(interest) && r.gt(0)) {
      return {
        monthlyPayment: payment,
        totalPaid: ZERO,
        totalInterest: ZERO,
        numberOfPayments: 0,
        schedule: [],
        assumptions: MORTGAGE_ASSUMPTIONS,
        warnings: [
          'The payment is not large enough to cover the interest, so the balance would never reduce. Increase the payment or reduce the rate.',
        ],
      };
    }

    let principalPortion = minOf(clampAtZero(payment.minus(interest)), balance);

    // Final-payment adjustment. Rounding the level payment to the penny leaves a
    // few pounds outstanding after the last scheduled period, which would
    // otherwise show up as an absurd 301st payment of small change. Lenders
    // absorb that residual into the final payment, so this does too — but only
    // when it really is a residual (no larger than one payment), never when the
    // payment is genuinely too small to clear the loan on schedule.
    if (period === scheduledPayments) {
      const remaining = balance.minus(principalPortion);
      if (remaining.gt(0) && remaining.lte(payment)) {
        principalPortion = balance;
      }
    }

    const actualPayment = principalPortion.plus(interest);
    balance = roundToMinorUnit(balance.minus(principalPortion));

    schedule.push({
      period,
      payment: actualPayment,
      interest,
      principal: principalPortion,
      balance: clampAtZero(balance),
    });
  }

  if (period >= MAX_PERIODS && balance.gt(0)) {
    warnings.push(
      'The loan does not clear within 100 years at this payment, so the schedule was stopped.',
    );
  }

  const totalPaid = sum(schedule.map((row) => row.payment));
  const totalInterest = sum(schedule.map((row) => row.interest));

  return {
    monthlyPayment: payment,
    totalPaid: roundToMinorUnit(totalPaid),
    totalInterest: roundToMinorUnit(totalInterest),
    numberOfPayments: schedule.length,
    schedule,
    assumptions: MORTGAGE_ASSUMPTIONS,
    warnings,
  };
}

export interface OverpaymentInput extends MortgageInput {
  /** Extra paid every period on top of the contractual payment. */
  readonly monthlyOverpayment?: Money;
  /** One-off extra payment applied at the start. */
  readonly lumpSum?: Money;
}

export interface OverpaymentResult {
  readonly baseline: MortgageResult;
  readonly withOverpayment: MortgageResult;
  readonly interestSaved: Money;
  readonly periodsSaved: number;
  readonly yearsSaved: number;
  readonly monthsSaved: number;
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
}

export const OVERPAYMENT_ASSUMPTIONS: readonly string[] = [
  ...MORTGAGE_ASSUMPTIONS,
  'Overpayments are assumed to reduce the term, not the monthly payment. Many lenders offer both; the choice changes the outcome substantially.',
  'Early repayment charges are excluded. Many fixed-rate deals cap annual overpayments, commonly at a percentage of the balance.',
  'No return is assumed on money that could have been saved or invested instead.',
];

export function compareOverpayment(input: OverpaymentInput): OverpaymentResult {
  const paymentsPerYear = input.paymentsPerYear ?? 12;
  const baseline = amortise(input);

  const lumpSum = input.lumpSum ?? ZERO;
  const overpayment = input.monthlyOverpayment ?? ZERO;
  const warnings: string[] = [...baseline.warnings];

  if (lumpSum.gte(input.principal)) {
    warnings.push('The lump sum covers the whole balance, so there is nothing left to repay.');
  }

  const reducedPrincipal = clampAtZero(input.principal.minus(lumpSum));
  const withOverpayment = amortise(
    { ...input, principal: reducedPrincipal },
    baseline.monthlyPayment.plus(overpayment),
  );

  const periodsSaved = Math.max(0, baseline.numberOfPayments - withOverpayment.numberOfPayments);
  const interestSaved = clampAtZero(baseline.totalInterest.minus(withOverpayment.totalInterest));

  return {
    baseline,
    withOverpayment,
    interestSaved: roundToMinorUnit(interestSaved),
    periodsSaved,
    yearsSaved: Math.floor(periodsSaved / paymentsPerYear),
    monthsSaved: periodsSaved % paymentsPerYear,
    assumptions: OVERPAYMENT_ASSUMPTIONS,
    warnings: [...new Set([...warnings, ...withOverpayment.warnings])],
  };
}

/** Condense a schedule to one row per year, for display without 360 table rows. */
export function annualSummary(result: MortgageResult, paymentsPerYear = 12) {
  const years: {
    year: number;
    paid: Money;
    interest: Money;
    principal: Money;
    balance: Money;
  }[] = [];

  for (let index = 0; index < result.schedule.length; index += paymentsPerYear) {
    const slice = result.schedule.slice(index, index + paymentsPerYear);
    const last = slice[slice.length - 1];
    if (!last) continue;
    years.push({
      year: Math.floor(index / paymentsPerYear) + 1,
      paid: roundToMinorUnit(sum(slice.map((row) => row.payment))),
      interest: roundToMinorUnit(sum(slice.map((row) => row.interest))),
      principal: roundToMinorUnit(sum(slice.map((row) => row.principal))),
      balance: last.balance,
    });
  }

  return years;
}
