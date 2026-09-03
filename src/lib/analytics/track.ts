/**
 * The analytics adapter.
 *
 * The privacy rule is enforced here, in code, not merely stated in a policy: an
 * event name outside the allow-list is dropped, a property outside the
 * allow-list is stripped, a value that is not in a closed set is replaced with
 * 'other', and anything that looks like a number the user typed is rejected
 * outright. A future calculator cannot leak a salary through this function even
 * if someone passes one in by mistake.
 *
 * Providers sit behind `dispatch`, so swapping Cloudflare or GA4 for something
 * else never touches a calculator.
 */
import {
  ALLOWED_EVENTS,
  ALLOWED_EVENT_PROPERTIES,
  CLOSED_PROPERTY_VALUES,
  MAX_PROPERTY_LENGTH,
  type AnalyticsEvent,
  type AnalyticsProperty,
} from '../../config/analytics.ts';
/**
 * Closed sets generated from the application's own registries at build time, so
 * they cannot drift out of date. They are read from a generated literal rather
 * than derived at runtime because importing the registry here would pull Zod
 * and every ruleset module into the browser bundle.
 *
 * A value that is a member of one of these is safe by construction: it came
 * from our own data, not from anything a visitor typed.
 */
import { DERIVED_CLOSED_VALUES } from './closed-values.generated.ts';

function closedValuesFor(property: AnalyticsProperty): readonly string[] | undefined {
  return CLOSED_PROPERTY_VALUES[property] ?? DERIVED_CLOSED_VALUES[property];
}

export type EventProperties = Partial<Record<AnalyticsProperty, string | boolean>>;

interface WindowWithProviders extends Window {
  gtag?: (command: string, ...args: unknown[]) => void;
  dataLayer?: unknown[];
  __clearfiguresConsent?: 'granted' | 'denied' | 'unknown';
}

function isAllowedEvent(name: string): name is AnalyticsEvent {
  return (ALLOWED_EVENTS as readonly string[]).includes(name);
}

/**
 * Last-resort heuristic for the few properties that have no closed set
 * (page_template, for instance). Anything currency-shaped or containing a long
 * run of digits is exactly the kind of value that must never be sent, so it is
 * dropped rather than guessed at.
 */
function looksLikeUserData(value: string): boolean {
  return /^[\d.,\s£$€]+$/.test(value) || /\d{4,}/.test(value);
}

export function sanitiseProperties(input: EventProperties): Record<string, string> {
  const output: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(input)) {
    if (!(ALLOWED_EVENT_PROPERTIES as readonly string[]).includes(key)) continue;
    if (rawValue === undefined || rawValue === null) continue;

    const value = String(rawValue);
    if (value.length === 0 || value.length > MAX_PROPERTY_LENGTH) continue;

    const closed = closedValuesFor(key as AnalyticsProperty);
    if (closed) {
      // Membership in a set we generated ourselves is proof enough; the
      // heuristic would reject legitimate values such as the tax period
      // "2026/27" purely for containing a four-digit year.
      output[key] = closed.includes(value) ? value : 'other';
      continue;
    }

    if (looksLikeUserData(value)) continue;
    output[key] = value;
  }

  return output;
}

/** True only when a consent management platform has recorded a positive choice. */
function analyticsConsentGranted(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as WindowWithProviders).__clearfiguresConsent === 'granted';
}

function dispatch(event: AnalyticsEvent, properties: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  const scope = window as WindowWithProviders;

  // GA4 is loaded only when configured AND consented; guard again here so a
  // misconfiguration cannot produce an unconsented hit.
  if (typeof scope.gtag === 'function' && analyticsConsentGranted()) {
    scope.gtag('event', event, properties);
  }

  if (import.meta.env?.DEV) {
    console.warn('[analytics]', event, properties);
  }
}

export function track(event: string, properties: EventProperties = {}): void {
  if (!isAllowedEvent(event)) {
    if (import.meta.env?.DEV) {
      console.error(`[analytics] refused unknown event "${event}"`);
    }
    return;
  }
  dispatch(event, sanitiseProperties(properties));
}
