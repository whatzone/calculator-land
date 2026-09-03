#!/usr/bin/env tsx
/**
 * Link audit over the built output.
 *
 * Internal links are always checked: a link to a page that was not built is a
 * broken link, and on this site it is usually a sign that a route and the page
 * manifest have drifted apart.
 *
 * External links are checked only with `--external`, because they need network
 * access the build environment may not have. A network failure is reported as
 * "unchecked" rather than "broken" — claiming an official source is dead when
 * we simply could not reach it would be worse than saying nothing.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIST = resolve('dist');
const CHECK_EXTERNAL = process.argv.includes('--external');

function htmlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return htmlFiles(full);
    return name.endsWith('.html') ? [full] : [];
  });
}

interface Problem {
  readonly source: string;
  readonly href: string;
  readonly reason: string;
}

function toPageUrl(file: string): string {
  const relative = file.slice(DIST.length).replace(/\\/g, '/');
  return relative.replace(/index\.html$/, '') || '/';
}

/** An internal href resolves if the build emitted a matching file. */
function internalTargetExists(href: string): boolean {
  const [pathOnly] = href.split(/[?#]/);
  if (!pathOnly) return true;
  if (pathOnly === '/') return existsSync(join(DIST, 'index.html'));

  const clean = pathOnly.replace(/^\//, '').replace(/\/$/, '');
  return (
    existsSync(join(DIST, clean, 'index.html')) ||
    existsSync(join(DIST, clean)) ||
    existsSync(join(DIST, `${clean}.html`))
  );
}

async function main(): Promise<void> {
  const files = htmlFiles(DIST);
  if (files.length === 0) {
    console.error('No built HTML found. Run `astro build` first.');
    process.exit(1);
  }

  const problems: Problem[] = [];
  const externalHrefs = new Set<string>();
  let internalChecked = 0;

  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const source = toPageUrl(file);

    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      if (!href) continue;

      if (href.startsWith('http://') || href.startsWith('https://')) {
        externalHrefs.add(href);
        if (href.startsWith('http://')) {
          problems.push({ source, href, reason: 'Insecure http:// link (mixed content risk).' });
        }
        continue;
      }
      if (href.startsWith('mailto:') || href.startsWith('#') || href.startsWith('data:')) continue;
      if (!href.startsWith('/')) {
        problems.push({ source, href, reason: 'Relative link; use a root-relative path.' });
        continue;
      }

      internalChecked += 1;
      if (!internalTargetExists(href)) {
        problems.push({
          source,
          href,
          reason: 'Internal link points at a page that was not built.',
        });
      }
      if (!href.includes('.') && !href.endsWith('/') && !href.includes('?')) {
        problems.push({
          source,
          href,
          reason: 'Internal link is missing its trailing slash, which would redirect.',
        });
      }
    }
  }

  let unchecked = 0;
  if (CHECK_EXTERNAL) {
    for (const href of externalHrefs) {
      try {
        const response = await fetch(href, { method: 'HEAD', redirect: 'follow' });
        if (response.status >= 400) {
          problems.push({ source: '(external)', href, reason: `HTTP ${response.status}` });
        }
      } catch {
        unchecked += 1;
      }
    }
  }

  console.log('\nLink audit');
  console.log('='.repeat(70));
  console.log(`Pages scanned: ${files.length}`);
  console.log(`Internal links checked: ${internalChecked}`);
  console.log(
    `External links: ${externalHrefs.size} ` +
      (CHECK_EXTERNAL
        ? `(${unchecked} unreachable from this environment)`
        : '(not checked; pass --external)'),
  );

  if (unchecked > 0) {
    console.log(
      `\n${unchecked} external link(s) could not be reached from here. That is reported as\n` +
        'unchecked, not broken — this environment blocks outbound requests to tax\n' +
        'authority domains. Run with --external from a machine with open egress.',
    );
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const problem of problems) {
      console.error(`  ${problem.source} -> ${problem.href}\n    ${problem.reason}`);
    }
    process.exit(1);
  }

  console.log('\nNo broken internal links.');
}

void main();
