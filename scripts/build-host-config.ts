#!/usr/bin/env tsx
/**
 * Generates host configuration from `src/config/hosting.ts`.
 *
 *   public/_headers    Cloudflare Pages and Netlify
 *   public/_redirects  Cloudflare Pages and Netlify
 *   vercel.json        Vercel
 *   netlify.toml       Netlify build settings
 *
 * Run with `npm run host:config`. `--check` verifies the committed files match
 * without writing, which is what the test and CI use: editing a generated file
 * by hand then fails, rather than silently diverging from the other hosts.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { HEADER_RULES, REDIRECT_RULES } from '../src/config/hosting.ts';

const CHECK_ONLY = process.argv.includes('--check');

const BANNER = (reader: string) =>
  `Generated from src/config/hosting.ts by scripts/build-host-config.ts.
Do not edit by hand — run \`npm run host:config\` instead.

This file is one of several describing the same policy to different hosts;
${reader} this one. Hand-editing a single file is how a
Content-Security-Policy ends up correct on two hosts and quietly broken on the
third, which produces a page that renders perfectly and calculates nothing.`;

/** Wrap at a readable width so generated comments do not run off the screen. */
function comment(text: string, prefix: string, width = 76): string {
  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(' ')) {
      if (current === '') {
        current = word;
      } else if (`${current} ${word}`.length <= width) {
        current += ` ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current !== '') lines.push(current);
  }

  return lines.map((line) => `${prefix}${line ? ` ${line}` : ''}`).join('\n');
}

/** Cloudflare Pages and Netlify share this format exactly. */
function buildHeadersFile(): string {
  const parts: string[] = [comment(BANNER('Cloudflare Pages and Netlify both read'), '#'), ''];

  for (const rule of HEADER_RULES) {
    if (rule.note) parts.push(comment(rule.note, '#'));
    parts.push(rule.path);
    for (const [name, value] of Object.entries(rule.headers)) {
      parts.push(`  ${name}: ${value}`);
    }
    parts.push('');
  }

  return `${parts.join('\n').trimEnd()}\n`;
}

function buildRedirectsFile(): string {
  const parts: string[] = [comment(BANNER('Cloudflare Pages and Netlify both read'), '#'), ''];

  for (const rule of REDIRECT_RULES) {
    if (rule.note) parts.push(comment(rule.note, '#'));
    parts.push(`${rule.from}  ${rule.to}  ${rule.status}`);
  }

  parts.push(
    '',
    comment(
      'The canonical-host redirect (www to apex, or the reverse) is configured\n' +
        'against the real domain in the host dashboard, not here. Adding a guessed\n' +
        'hostname would create a redirect loop on a domain that does not exist yet.',
      '#',
    ),
  );

  return `${parts.join('\n').trimEnd()}\n`;
}

/**
 * Translate a glob path into Vercel's source pattern.
 *
 * Vercel treats the value as a path-to-regexp pattern, so every regex
 * metacharacter has to be escaped — a literal dot left unescaped in
 * `/sitemap-*.xml` would match `/sitemap-1axml` too. Only `*` is meaningful as
 * a glob, and it becomes a capture group.
 */
function toVercelSource(path: string): string {
  const escaped = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(/\*/g, '(.*)');
}

function buildVercelJson(): string {
  const config = {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    // Kept in sync with astro.config.mjs `trailingSlash: 'always'`. Without it
    // Vercel would serve both /uk and /uk/, which is the duplicate-content
    // problem the whole URL policy exists to avoid.
    trailingSlash: true,
    cleanUrls: false,
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    framework: 'astro',
    headers: HEADER_RULES.map((rule) => ({
      // Vercel matches on a source pattern rather than a glob.
      source: toVercelSource(rule.path),
      headers: Object.entries(rule.headers).map(([key, value]) => ({ key, value })),
    })),
    redirects: REDIRECT_RULES.map((rule) => ({
      source: rule.from,
      destination: rule.to,
      permanent: rule.status === 301,
    })),
  };

  return `${JSON.stringify(config, null, 2)}\n`;
}

function buildNetlifyToml(): string {
  return `${comment(BANNER('Netlify reads'), '#')}
#
# Netlify reads public/_headers and public/_redirects natively once they are
# copied into the publish directory by the build, so headers and redirects are
# not repeated here.

[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"
  # Indexing is opt-in. Set SITE_ALLOW_INDEXING=true in the Netlify UI, scoped
  # to production only, so deploy previews stay noindex.
  SITE_ALLOW_INDEXING = "false"

# Deploy previews and branch deploys are never indexable, belt and braces:
# the per-page meta robots tag already handles it, and this makes it explicit
# to anyone reading the config.
[context.deploy-preview.environment]
  SITE_ALLOW_INDEXING = "false"

[context.branch-deploy.environment]
  SITE_ALLOW_INDEXING = "false"
`;
}

const OUTPUTS: readonly { path: string; contents: string }[] = [
  { path: 'public/_headers', contents: buildHeadersFile() },
  { path: 'public/_redirects', contents: buildRedirectsFile() },
  { path: 'vercel.json', contents: buildVercelJson() },
  { path: 'netlify.toml', contents: buildNetlifyToml() },
];

function main(): void {
  const drifted: string[] = [];

  for (const output of OUTPUTS) {
    const full = resolve(output.path);
    const current = existsSync(full) ? readFileSync(full, 'utf8') : null;

    if (current === output.contents) continue;

    if (CHECK_ONLY) {
      drifted.push(output.path);
      continue;
    }

    writeFileSync(full, output.contents, 'utf8');
    console.log(`  wrote ${output.path}`);
  }

  if (CHECK_ONLY) {
    if (drifted.length > 0) {
      console.error('\nHost configuration is out of date:');
      for (const path of drifted) console.error(`  ${path}`);
      console.error('\nRun `npm run host:config` and commit the result.');
      process.exit(1);
    }
    console.log('Host configuration is in sync across Cloudflare, Netlify and Vercel.');
    return;
  }

  console.log('Host configuration generated for Cloudflare Pages, Netlify and Vercel.');
}

main();
