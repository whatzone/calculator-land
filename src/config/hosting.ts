/**
 * Host configuration: security headers, cache rules, and redirects.
 *
 * The single source of truth for all three supported hosts. Cloudflare Pages
 * and Netlify read `public/_headers` and `public/_redirects`; Vercel reads
 * `vercel.json`. All of them are generated from this file by
 * `scripts/build-host-config.ts`, because three hand-maintained copies of a
 * Content-Security-Policy is three chances for one of them to be quietly wrong
 * — and a CSP that is wrong on one host produces a page that renders perfectly
 * and calculates nothing.
 *
 * A test asserts the committed files still match what this file generates, so
 * editing one by hand fails the build rather than silently diverging.
 */

export interface HeaderRule {
  /** Path pattern. `/*` means every route. */
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  /** Explains the rule in the generated files. */
  readonly note?: string;
}

export interface RedirectRule {
  readonly from: string;
  readonly to: string;
  readonly status: 301 | 302;
  readonly note?: string;
}

/**
 * Third-party origins, kept separate so that enabling an integration is a
 * one-line change here rather than an edit to a long policy string.
 *
 * When you add one, deploy and then use the calculator. A CSP violation is
 * silent to the reader: the page looks finished and the submit button does
 * nothing.
 */
const CSP_SOURCES = {
  script: [
    "'self'",
    // Cloudflare Web Analytics. Harmless on other hosts; the beacon only loads
    // when CF_ANALYTICS_TOKEN is set.
    'https://static.cloudflareinsights.com',
    // GA4, when enabled, also needs:
    //   https://www.googletagmanager.com https://www.google-analytics.com
  ],
  connect: [
    "'self'",
    'https://cloudflareinsights.com',
    // GA4, when enabled, also needs: https://www.google-analytics.com
  ],
  // 'unsafe-inline' is required for styles because Astro inlines small
  // stylesheets. It is NOT permitted for scripts, which is the case that
  // matters: there is no inline executable script anywhere on the site.
  style: ["'self'", "'unsafe-inline'"],
  img: ["'self'", 'data:'],
  font: ["'self'"],
} as const;

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src ${CSP_SOURCES.script.join(' ')}`,
  `style-src ${CSP_SOURCES.style.join(' ')}`,
  `img-src ${CSP_SOURCES.img.join(' ')}`,
  `font-src ${CSP_SOURCES.font.join(' ')}`,
  `connect-src ${CSP_SOURCES.connect.join(' ')}`,
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

export const HEADER_RULES: readonly HeaderRule[] = [
  {
    path: '/*',
    note:
      'No X-Robots-Tag here on purpose. Indexing is controlled per page by the ' +
      'meta robots tag, driven by SITE_ALLOW_INDEXING, so previews are noindex ' +
      'and production is not. A blanket header would override that permanently.',
    headers: {
      'Content-Security-Policy': CONTENT_SECURITY_POLICY,
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy':
        'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  {
    path: '/_astro/*',
    note: 'Hashed build assets are immutable, so a year is safe.',
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Robots-Tag': 'none',
    },
  },
  {
    path: '/favicon.svg',
    headers: { 'Cache-Control': 'public, max-age=604800' },
  },
  {
    path: '/*.html',
    note:
      'Applies to a directly requested .html path. Pages are served as directory ' +
      'URLs, and every host already revalidates those by default — this rule ' +
      'exists so the intent is explicit rather than inherited.',
    headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' },
  },
  {
    path: '/sitemap-*.xml',
    headers: { 'Cache-Control': 'public, max-age=3600' },
  },
  {
    path: '/robots.txt',
    headers: { 'Cache-Control': 'public, max-age=3600' },
  },
];

/**
 * Redirects for paths a reader might reasonably type. Trailing-slash handling
 * is not listed here: every host is configured to enforce it, matching Astro's
 * `trailingSlash: 'always'`, so `/uk` and `/uk/` can never both be crawlable.
 */
export const REDIRECT_RULES: readonly RedirectRule[] = [
  { from: '/uk/salary', to: '/uk/salary-calculator/', status: 301 },
  { from: '/ireland/salary', to: '/ireland/salary-calculator/', status: 301 },
  { from: '/australia/salary', to: '/australia/salary-calculator/', status: 301 },
  { from: '/canada/salary', to: '/canada/salary-calculator/', status: 301 },
  { from: '/mortgage', to: '/mortgage-calculators/', status: 301 },
  { from: '/salary', to: '/salary-tax-calculators/', status: 301 },
  { from: '/tools', to: '/calculators/', status: 301 },
  { from: '/sources.html', to: '/sources/', status: 301 },
];

/** Hosts this project is configured for. */
export const SUPPORTED_HOSTS = ['cloudflare', 'netlify', 'vercel'] as const;
export type SupportedHost = (typeof SUPPORTED_HOSTS)[number];
