#!/usr/bin/env tsx
/**
 * Writes the page manifest to disk so the build, the audits, and the handoff
 * inventory all read exactly the same list. Run with `npm run manifest:build`.
 */
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildPageManifest, duplicatePaths, summariseManifest } from '../src/lib/seo/manifest.ts';
import { ALL_RULESETS, JURISDICTIONS } from '../src/data/jurisdictions/index.ts';
import { CALCULATORS } from '../src/lib/registry/index.ts';
import { ADS_TXT_LINES } from '../src/config/monetisation.ts';

const OUTPUT = resolve('src/data/page-manifests/generated/page-manifest.json');
const ANALYTICS_OUTPUT = resolve('src/lib/analytics/closed-values.generated.ts');
const ADS_TXT_OUTPUT = resolve('public/ads.txt');

/**
 * ads.txt is a public claim about who may sell this site's advertising
 * inventory. A wrong or partial one can get a publisher account suspended, so
 * the file is written only when a real line has been supplied, and is removed
 * again if that configuration goes away. A static route could not do this: it
 * would emit a 200 response containing the word "missing".
 */
function writeAdsTxt(): void {
  if (ADS_TXT_LINES.length === 0) {
    if (existsSync(ADS_TXT_OUTPUT)) {
      rmSync(ADS_TXT_OUTPUT);
      console.log('Removed public/ads.txt (no publisher line configured)');
    }
    return;
  }

  const body = [
    '# Authorised digital sellers for this domain.',
    '# Generated from ADS_TXT_LINES; see docs/DEPLOYMENT.md.',
    ...ADS_TXT_LINES,
    '',
  ].join('\n');

  mkdirSync(dirname(ADS_TXT_OUTPUT), { recursive: true });
  writeFileSync(ADS_TXT_OUTPUT, body, 'utf8');
  console.log(`ads.txt written with ${ADS_TXT_LINES.length} publisher line(s)`);
}

/**
 * The analytics adapter validates closed-set properties by membership. Deriving
 * those sets by importing the registry at runtime would drag Zod — and every
 * ruleset module — into the browser bundle, which measured at 47 KB gzipped.
 * Generating them as a flat literal keeps the client bundle to the calculation
 * code it actually needs, and regenerating on every build keeps them in step
 * with the registry.
 */
function writeAnalyticsClosedValues(): void {
  const sets = {
    tax_period: [...new Set(ALL_RULESETS.map((ruleset) => ruleset.taxPeriod.label))].sort(),
    jurisdiction: [...JURISDICTIONS.map((meta) => meta.code), 'global'].sort(),
    sub_jurisdiction: [
      ...new Set(JURISDICTIONS.flatMap((meta) => meta.regions.map((region) => region.code))),
    ].sort(),
    tool_id: CALCULATORS.map((calculator) => calculator.id).sort(),
    calculator_family: [...new Set(CALCULATORS.map((calculator) => calculator.family))].sort(),
  };

  const body = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Written by scripts/build-page-manifest.ts on every build. It exists so the
 * analytics adapter can validate closed-set property values by membership
 * without importing the calculator registry, which would pull Zod and every
 * ruleset module into the browser bundle.
 */
import type { AnalyticsProperty } from '../../config/analytics.ts';

export const DERIVED_CLOSED_VALUES: Partial<Record<AnalyticsProperty, readonly string[]>> = ${JSON.stringify(sets, null, 2)};
`;

  mkdirSync(dirname(ANALYTICS_OUTPUT), { recursive: true });
  writeFileSync(ANALYTICS_OUTPUT, body, 'utf8');
  console.log(`Analytics closed values written to ${ANALYTICS_OUTPUT}`);
}

function main(): void {
  const duplicates = duplicatePaths();
  if (duplicates.length > 0) {
    console.error('Duplicate page paths detected. Two routes would emit the same URL:');
    for (const path of duplicates) console.error(`  ${path}`);
    process.exit(1);
  }

  const manifest = buildPageManifest();
  const summary = summariseManifest();

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(
    OUTPUT,
    `${JSON.stringify({ generatedFrom: 'src/lib/seo/manifest.ts', summary, pages: manifest }, null, 2)}\n`,
    'utf8',
  );

  writeAnalyticsClosedValues();
  writeAdsTxt();

  console.log(`Page manifest written to ${OUTPUT}`);
  console.log(
    `  ${summary.total} pages, ${summary.indexable} indexable, ${summary.withheld} withheld`,
  );
  if (!summary.allowIndexing) {
    console.log('  SITE_ALLOW_INDEXING is not "true", so this build is noindex throughout.');
  }
}

main();
