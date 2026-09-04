/**
 * Host configuration integrity.
 *
 * The site is deployable to Cloudflare Pages, Netlify, and Vercel, which read
 * three different config formats describing one policy. These tests exist so
 * that a policy correct on two hosts and quietly broken on the third fails the
 * build instead of reaching production.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HEADER_RULES, REDIRECT_RULES } from '../../src/config/hosting.ts';

const headersFile = readFileSync('public/_headers', 'utf8');
const redirectsFile = readFileSync('public/_redirects', 'utf8');
const vercelJson = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  trailingSlash: boolean;
  cleanUrls: boolean;
  headers: { source: string; headers: { key: string; value: string }[] }[];
  redirects: { source: string; destination: string; permanent: boolean }[];
};
const netlifyToml = readFileSync('netlify.toml', 'utf8');

describe('generated host configuration', () => {
  it('is in sync with src/config/hosting.ts', () => {
    // Fails if anyone edited a generated file by hand instead of the source.
    expect(() =>
      execFileSync('npx', ['tsx', 'scripts/build-host-config.ts', '--check'], {
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it('describes the same headers to every host', () => {
    for (const rule of HEADER_RULES) {
      for (const [name, value] of Object.entries(rule.headers)) {
        expect(headersFile, `${name} missing from _headers`).toContain(`${name}: ${value}`);

        const vercelRule = vercelJson.headers.find((entry) =>
          entry.headers.some((header) => header.key === name && header.value === value),
        );
        expect(vercelRule, `${name} missing from vercel.json`).toBeDefined();
      }
    }
  });

  it('describes the same redirects to every host', () => {
    for (const rule of REDIRECT_RULES) {
      expect(redirectsFile).toContain(`${rule.from}  ${rule.to}  ${rule.status}`);

      const vercelRedirect = vercelJson.redirects.find((entry) => entry.source === rule.from);
      expect(vercelRedirect, `${rule.from} missing from vercel.json`).toBeDefined();
      expect(vercelRedirect?.destination).toBe(rule.to);
      expect(vercelRedirect?.permanent).toBe(rule.status === 301);
    }
  });

  it('enforces trailing slashes on Vercel, matching the Astro build', () => {
    // astro.config.mjs sets trailingSlash: 'always'. If Vercel disagreed, both
    // /uk and /uk/ would resolve, which is the duplicate-content problem the
    // URL policy exists to prevent.
    expect(vercelJson.trailingSlash).toBe(true);
    expect(vercelJson.cleanUrls).toBe(false);
  });

  it('escapes literal dots in Vercel source patterns', () => {
    // Unescaped, `/sitemap-*.xml` would also match `/sitemap-1axml`.
    for (const entry of vercelJson.headers) {
      if (!entry.source.includes('.')) continue;
      const unescaped = entry.source.replace(/\(\.\*\)/g, '').replace(/\\\./g, '');
      expect(unescaped, `unescaped dot in "${entry.source}"`).not.toContain('.');
    }
  });
});

describe('security policy', () => {
  const csp = HEADER_RULES.find((rule) => rule.path === '/*')?.headers['Content-Security-Policy'];

  it('is applied to every route', () => {
    expect(csp).toBeDefined();
  });

  it('never permits inline or eval script', () => {
    // There is no inline executable script on the site. The JSON-LD and
    // calculator-config blocks are application/... types, which are data.
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('locks down framing, base URI, and plugins', () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it('sets no blanket X-Robots-Tag, which would override the per-page control', () => {
    const global = HEADER_RULES.find((rule) => rule.path === '/*');
    expect(global?.headers['X-Robots-Tag']).toBeUndefined();
  });

  it('denies the device permissions this site has no use for', () => {
    const permissions = HEADER_RULES.find((rule) => rule.path === '/*')?.headers[
      'Permissions-Policy'
    ];
    for (const feature of ['camera', 'geolocation', 'microphone', 'payment']) {
      expect(permissions).toContain(`${feature}=()`);
    }
  });
});

describe('netlify.toml', () => {
  it('builds with the project build command', () => {
    expect(netlifyToml).toContain('command = "npm run build"');
    expect(netlifyToml).toContain('publish = "dist"');
  });

  it('keeps deploy previews and branch deploys out of the index', () => {
    expect(netlifyToml).toContain('[context.deploy-preview.environment]');
    expect(netlifyToml).toContain('[context.branch-deploy.environment]');
    // Every occurrence of the switch in this file must be false; production is
    // turned on in the host UI, deliberately, by a person.
    const values = [...netlifyToml.matchAll(/SITE_ALLOW_INDEXING = "(\w+)"/g)].map((m) => m[1]);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((value) => value === 'false')).toBe(true);
  });
});
