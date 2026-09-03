/**
 * Measurement configuration.
 *
 * Privacy rule that overrides everything else in this file: no value a visitor
 * types into a calculator, and no value derived from one, may ever leave the
 * browser. The allow-list below is enforced at runtime by
 * `src/lib/analytics/track.ts`, not merely documented here.
 */

function env(key: string, fallback: string): string {
  const value = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

/** Cloudflare Web Analytics token. Cookie-light, no consent banner required. */
export const CF_ANALYTICS_TOKEN = env('CF_ANALYTICS_TOKEN', '');

/** GA4 measurement ID. Loaded only when set AND consent state permits. */
export const GA4_MEASUREMENT_ID = env('GA4_MEASUREMENT_ID', '');

/** Search Console HTML meta verification token, if that method is chosen. */
export const SEARCH_CONSOLE_VERIFICATION = env('SEARCH_CONSOLE_VERIFICATION', '');

/**
 * Consent management platform. No CMP is bundled. Until one is configured,
 * GA4 stays off for every visitor rather than defaulting to "granted".
 */
export const CMP_PROVIDER = env('CMP_PROVIDER', '');
export const CONSENT_REQUIRED_BY_DEFAULT = env('CONSENT_REQUIRED_BY_DEFAULT', 'true') === 'true';

export const ANALYTICS_ENABLED = CF_ANALYTICS_TOKEN !== '' || GA4_MEASUREMENT_ID !== '';

/** Product events. This union is the complete set; nothing else may be sent. */
export const ALLOWED_EVENTS = [
  'calculator_viewed',
  'calculation_completed',
  'advanced_options_opened',
  'pay_frequency_changed',
  'print_or_share_selected',
  'source_or_methodology_viewed',
] as const;

export type AnalyticsEvent = (typeof ALLOWED_EVENTS)[number];

/**
 * Property allow-list. A property not named here is dropped before dispatch.
 * Note what is absent: salary, bonus, mortgage balance, rate, deposit,
 * postcode, civil status, pension choice, and every computed result.
 */
export const ALLOWED_EVENT_PROPERTIES = [
  'tool_id',
  'calculator_family',
  'jurisdiction',
  'sub_jurisdiction',
  'tax_period',
  'page_template',
  'interaction_type',
  'is_prefilled_page',
  'validation_state',
] as const;

export type AnalyticsProperty = (typeof ALLOWED_EVENT_PROPERTIES)[number];

/**
 * Values allowed per property, where the set is closed. An unexpected value is
 * replaced with 'other' so that a coding mistake cannot leak free text.
 */
export const CLOSED_PROPERTY_VALUES: Partial<Record<AnalyticsProperty, readonly string[]>> = {
  interaction_type: ['load', 'submit', 'change', 'toggle', 'print', 'share', 'link'],
  validation_state: ['valid', 'invalid', 'unsupported'],
  is_prefilled_page: ['true', 'false'],
};

/** Any property value longer than this is rejected outright. */
export const MAX_PROPERTY_LENGTH = 64;
