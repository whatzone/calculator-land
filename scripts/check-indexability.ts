#!/usr/bin/env tsx
/**
 * Indexability audit. Run with `npm run seo:audit`.
 *
 * Fails the build when a page would be indexed despite failing the gate, when a
 * withheld page has leaked into the sitemap, or when a page carries placeholder
 * copy. It is the last line of defence before a bad page reaches the index.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildPageManifest,
  containsPlaceholder,
  sitemapPages,
  summariseManifest,
  withheldPages,
} from '../src/lib/seo/manifest.ts';
import { SITE } from '../src/config/site.ts';

const DIST = resolve('dist');

interface Problem {
  readonly path: string;
  readonly message: string;
}

function checkBuiltHtml(): Problem[] {
  const problems: Problem[] = [];
  if (!existsSync(DIST)) return problems;

  for (const entry of buildPageManifest()) {
    const file = resolve(DIST, `.${entry.path}index.html`);
    if (!existsSync(file)) continue;
    const html = readFileSync(file, 'utf8');

    const isNoindex = /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(html);

    if (!entry.indexable && !isNoindex) {
      problems.push({
        path: entry.path,
        message: 'Page failed the quality gate but was not emitted with noindex.',
      });
    }
    if (entry.indexable && SITE.allowIndexing && isNoindex) {
      problems.push({ path: entry.path, message: 'Page passed the gate but was emitted noindex.' });
    }

    const canonicalCount = (html.match(/rel=["']canonical["']/g) ?? []).length;
    if (canonicalCount !== 1) {
      problems.push({
        path: entry.path,
        message: `Expected exactly one canonical link, found ${canonicalCount}.`,
      });
    }

    const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
    if (h1Count !== 1) {
      problems.push({ path: entry.path, message: `Expected exactly one <h1>, found ${h1Count}.` });
    }

    if (entry.indexable) {
      // Only the rendered body text matters; script and style contents do not.
      // Elements marked `data-config-disclosure` are also skipped: they are
      // deliberate prose telling the reader that a configuration value is still
      // a placeholder, which is the opposite of the unfinished copy this check
      // exists to catch.
      const body = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<(\w+)[^>]*\bdata-config-disclosure\b[\s\S]*?<\/\1>/gi, '');
      const found = containsPlaceholder(body);
      if (found.length > 0) {
        problems.push({
          path: entry.path,
          message: `Placeholder copy on an indexable page: ${found.join(', ')}`,
        });
      }
    }
  }

  return problems;
}

function checkSitemap(): Problem[] {
  const problems: Problem[] = [];
  const withheld = new Set(withheldPages().map((entry) => entry.path));

  for (const entry of sitemapPages()) {
    if (withheld.has(entry.path)) {
      problems.push({ path: entry.path, message: 'A withheld page appears in the sitemap.' });
    }
    if (!entry.indexable) {
      problems.push({ path: entry.path, message: 'A non-indexable page appears in the sitemap.' });
    }
  }

  const sitemapFile = resolve(DIST, 'sitemap-index.xml');
  if (existsSync(sitemapFile)) {
    const xml = readFileSync(sitemapFile, 'utf8');
    if (!SITE.allowIndexing && /<loc>/.test(xml.replace(/<loc>[^<]*sitemap[^<]*<\/loc>/g, ''))) {
      // The index may still list its children; only entries are a problem.
      const childFile = resolve(DIST, 'sitemap-pages.xml');
      if (existsSync(childFile)) {
        const child = readFileSync(childFile, 'utf8');
        const count = (child.match(/<url>/g) ?? []).length;
        if (count > 0) {
          problems.push({
            path: '/sitemap-pages.xml',
            message: `Indexing is disabled but the sitemap lists ${count} URLs.`,
          });
        }
      }
    }
  }

  return problems;
}

function main(): void {
  const summary = summariseManifest();
  const problems = [...checkBuiltHtml(), ...checkSitemap()];

  console.log('\nIndexability audit');
  console.log('='.repeat(70));
  console.log(
    `Pages: ${summary.total} | indexable: ${summary.indexable} | withheld: ${summary.withheld}`,
  );
  console.log(`Sitemap entries: ${sitemapPages().length}`);
  console.log(`SITE_ALLOW_INDEXING: ${SITE.allowIndexing}`);

  if (SITE.isPlaceholderDomain && SITE.allowIndexing) {
    console.error('\nRefusing to allow indexing while SITE_URL is still the placeholder domain.');
    process.exit(1);
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const problem of problems) console.error(`  ${problem.path}: ${problem.message}`);
    process.exit(1);
  }

  console.log('\nNo indexability problems.');
}

main();
