/**
 * Formatting through Intl, using the page locale.
 *
 * A UK user should see £50,000 and a Canadian $50,000 with the right separators
 * and the right currency position, without any template deciding that itself.
 */
import type { Money } from '../calculations/common/money.ts';
import type { CurrencyCode } from '../calculations/common/types.ts';

const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
  GBP: 'en-GB',
  EUR: 'en-IE',
  AUD: 'en-AU',
  NZD: 'en-NZ',
  CAD: 'en-CA',
  USD: 'en-US',
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  GBP: '£',
  EUR: '€',
  AUD: '$',
  NZD: '$',
  CAD: '$',
  USD: '$',
};

export function localeFor(currency: CurrencyCode): string {
  return CURRENCY_LOCALES[currency] ?? 'en-GB';
}

/** Money with no minor units — the default for salary figures. */
export function formatCurrency(value: Money, currency: CurrencyCode, locale?: string): string {
  return new Intl.NumberFormat(locale ?? localeFor(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value.toString()));
}

/** Money with minor units — for per-period figures where pennies matter. */
export function formatCurrencyPrecise(
  value: Money,
  currency: CurrencyCode,
  locale?: string,
): string {
  return new Intl.NumberFormat(locale ?? localeFor(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value.toString()));
}

/** A rate expressed as a fraction (0.32) rendered as a percentage (32.0%). */
export function formatRate(rate: Money, locale = 'en-GB', digits = 1): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(rate.toString()));
}

/** A percentage already expressed as a number (20) rendered as 20%. */
export function formatPercentValue(percent: Money, locale = 'en-GB', digits = 0): string {
  return (
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number(percent.toString())) + '%'
  );
}

export function formatNumber(value: number, locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** ISO date to a readable date, for "last checked" lines. */
export function formatDate(iso: string, locale = 'en-GB'): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** A compact amount for slugs and titles: 50000 -> "50,000". */
export function formatAmountForTitle(
  amount: number,
  currency: CurrencyCode,
  locale?: string,
): string {
  return new Intl.NumberFormat(locale ?? localeFor(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDuration(years: number, months: number): string {
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(' and ') : 'no time';
}
