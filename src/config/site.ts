/**
 * Central brand and site configuration.
 *
 * Every user-visible brand string, URL, and contact route resolves from here so
 * that renaming the product or moving the domain never requires template edits.
 *
 * PLACEHOLDER VALUES: the owner had not supplied a final brand, domain, or
 * contact address at build time. Everything below marked `isPlaceholder` must be
 * replaced before production indexing is enabled. See docs/DECISIONS.md (D-002).
 */

export interface SiteConfig {
  readonly name: string;
  readonly legalEntity: string;
  readonly tagline: string;
  readonly valueProposition: string;
  readonly url: string;
  readonly contactEmail: string;
  readonly correctionsEmail: string;
  readonly publisherCountry: string;
  readonly defaultLocale: string;
  readonly isPlaceholderBrand: boolean;
  readonly isPlaceholderDomain: boolean;
  readonly isPlaceholderContact: boolean;
  /** When false, every page is emitted `noindex` regardless of its own gate result. */
  readonly allowIndexing: boolean;
}

/** Resolve an env var at build time, falling back to a documented placeholder. */
function env(key: string, fallback: string): string {
  const value = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

const PLACEHOLDER_URL = 'https://clearfigures.pages.dev';
const PLACEHOLDER_EMAIL = 'hello@example-clearfigures.invalid';

const resolvedUrl = env('SITE_URL', PLACEHOLDER_URL).replace(/\/+$/, '');
const resolvedContact = env('SITE_CONTACT_EMAIL', PLACEHOLDER_EMAIL);

/**
 * Indexing is opt-in. Cloudflare Pages preview/branch deployments and local
 * builds never set SITE_ALLOW_INDEXING, so they are noindex by construction.
 */
const allowIndexing = env('SITE_ALLOW_INDEXING', 'false') === 'true';

export const SITE: SiteConfig = {
  name: env('SITE_NAME', 'ClearFigures'),
  legalEntity: env('SITE_LEGAL_ENTITY', 'ClearFigures (working name, entity not yet incorporated)'),
  tagline: 'Transparent salary, tax and mortgage calculators',
  valueProposition:
    'Understand what you earn, what is deducted, and what changes when your pay changes — using transparent calculators sourced from official tax authorities.',
  url: resolvedUrl,
  contactEmail: resolvedContact,
  correctionsEmail: env('SITE_CORRECTIONS_EMAIL', resolvedContact),
  publisherCountry: 'GB',
  defaultLocale: 'en-GB',
  isPlaceholderBrand: env('SITE_NAME', 'ClearFigures') === 'ClearFigures',
  isPlaceholderDomain: resolvedUrl === PLACEHOLDER_URL,
  isPlaceholderContact: resolvedContact === PLACEHOLDER_EMAIL,
  allowIndexing,
};

/** Absolute URL for a site-relative path, with enforced trailing slash. */
export function absoluteUrl(path: string): string {
  if (path === '/') return `${SITE.url}/`;
  const clean = `/${path.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
  return `${SITE.url}${clean}`;
}
