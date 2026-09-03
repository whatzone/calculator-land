#!/usr/bin/env tsx
/**
 * Scaffold a new calculator. Run with `npm run create:calculator`.
 *
 *   npm run create:calculator -- --id property-stamp-duty \
 *     --family property --slug stamp-duty --title "Stamp Duty Calculator" \
 *     --jurisdictions uk
 *
 * It creates the engine, the registry entry, the fixture, and the test file
 * from maintained templates, and it registers the calculator as `draft`, which
 * means noindex. It deliberately refuses to create a publishable calculator:
 * promoting one to `published` requires sources, assumptions, limitations, and
 * fixtures, and those are a person's job.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CALCULATORS } from '../src/lib/registry/index.ts';
import { CALCULATOR_FAMILIES } from '../src/lib/registry/types.ts';
import { JURISDICTIONS } from '../src/data/jurisdictions/index.ts';

interface Options {
  id: string;
  family: string;
  slug: string;
  title: string;
  jurisdictions: string[];
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const get = (name: string): string | undefined => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? undefined : args[index + 1];
  };

  const id = get('id') ?? '';
  const family = get('family') ?? '';
  const slug = get('slug') ?? '';
  const title = get('title') ?? '';
  const jurisdictions = (get('jurisdictions') ?? 'global').split(',').map((value) => value.trim());

  return { id, family, slug, title, jurisdictions };
}

function fail(message: string): never {
  console.error(`\n${message}\n`);
  console.error(
    'Usage: npm run create:calculator -- --id <id> --family <family> --slug <slug> \\\n' +
      '         --title "<Title>" --jurisdictions <global|uk,ireland,...>\n',
  );
  console.error(`Families: ${CALCULATOR_FAMILIES.join(', ')}`);
  console.error(`Jurisdictions: global, ${JURISDICTIONS.map((meta) => meta.code).join(', ')}`);
  process.exit(1);
}

function validate(options: Options): void {
  if (!/^[a-z0-9-]+$/.test(options.id)) fail('--id is required and must be lowercase kebab-case.');
  if (!/^[a-z0-9-]+$/.test(options.slug))
    fail('--slug is required and must be lowercase kebab-case.');
  if (!options.title.trim()) fail('--title is required.');
  if (!CALCULATOR_FAMILIES.includes(options.family as (typeof CALCULATOR_FAMILIES)[number])) {
    fail(`--family must be one of: ${CALCULATOR_FAMILIES.join(', ')}`);
  }

  if (CALCULATORS.some((calculator) => calculator.id === options.id)) {
    fail(`A calculator with id "${options.id}" already exists.`);
  }

  const valid = new Set(['global', ...JURISDICTIONS.map((meta) => meta.code)]);
  for (const jurisdiction of options.jurisdictions) {
    if (!valid.has(jurisdiction)) fail(`Unknown jurisdiction "${jurisdiction}".`);
  }

  // Slug collisions inside a jurisdiction would produce two routes at one URL.
  for (const jurisdiction of options.jurisdictions) {
    const clash = CALCULATORS.find(
      (calculator) =>
        calculator.slug === options.slug &&
        (calculator.jurisdictions as readonly string[]).includes(jurisdiction),
    );
    if (clash) fail(`Slug "${options.slug}" is already used by "${clash.id}" in ${jurisdiction}.`);
  }
}

function write(path: string, contents: string): void {
  const full = resolve(path);
  if (existsSync(full)) fail(`Refusing to overwrite existing file: ${path}`);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents, 'utf8');
  console.log(`  created ${path}`);
}

function camel(id: string): string {
  return id.replace(/-([a-z0-9])/g, (_, character: string) => character.toUpperCase());
}

function main(): void {
  const options = parseArgs();
  validate(options);

  const name = camel(options.id);
  const isGlobal = options.jurisdictions.includes('global');
  const engineDir = isGlobal ? 'global' : options.jurisdictions[0];

  console.log(`\nScaffolding calculator "${options.id}"\n`);

  write(
    `src/lib/calculations/${engineDir}/${options.slug}.ts`,
    `/**
 * ${options.title}.
 *
 * TODO(scaffold): implement the calculation.
 *
 * Rules for this file:
 *  - use the Money type from ../common/money.ts; never plain numbers for money;
 *  - take rates and thresholds from a ruleset, never as literals here;
 *  - return an itemised breakdown, not just a total;
 *  - where an input is not supported, return a warning rather than a guess.
 */
import { type Money, ZERO } from '../common/money.ts';

export interface ${name}Input {
  readonly amount: Money;
}

export interface ${name}Result {
  readonly total: Money;
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
}

export function ${name}(input: ${name}Input): ${name}Result {
  return {
    total: ZERO,
    assumptions: [],
    warnings: ['This calculator is not implemented yet.'],
  };
}
`,
  );

  write(
    `src/lib/registry/calculators/${options.id}.ts`,
    `/**
 * Registry entry for ${options.title}.
 *
 * Registered as \`draft\`, which means it is built but never indexed and never
 * appears in a sitemap. Promoting it to \`published\` requires everything the
 * quality gate asks for: at least one official source with a checked-on date,
 * assumptions, limitations, and passing fixtures.
 */
import { z } from 'zod';
import { ${name} } from '../../calculations/${engineDir}/${options.slug}.ts';
import type { CalculatorDefinition } from '../types.ts';

type Values = Record<string, unknown>;

export const ${name}Calculator: CalculatorDefinition<Values, ReturnType<typeof ${name}>> = {
  id: '${options.id}',
  family: '${options.family}',
  slug: '${options.slug}',
  title: '${options.title}',
  shortTitle: '${options.title}',
  description: 'TODO(scaffold): one or two sentences on what this answers and for whom.',
  metaDescription: 'TODO(scaffold): a distinct meta description, not a copy of the body text.',
  jurisdictions: [${options.jurisdictions.map((j) => `'${j}'`).join(', ')}],
  inputSchema: z.record(z.string(), z.unknown()),
  fields: [],
  calculate: () => ${name}({ amount: undefined as never }),
  present: () => ({
    headline: { label: 'Not implemented', value: '—' },
    summaryRows: [],
    breakdownRows: [],
    frequencyRows: [],
    notices: [{ severity: 'unsupported', message: 'This calculator is not implemented yet.' }],
    assumptions: [],
    supported: false,
  }),
  assumptions: [],
  sources: [],
  limitations: [],
  relatedCalculatorIds: [],
  indexability: {
    requiresPublishedRuleset: ${!isGlobal},
    rulesetIds: [],
    indexableWithoutTaxData: ${isGlobal},
  },
  analytics: { toolId: '${options.id}', category: '${options.family}' },
  testFixtures: ['tests/unit/${options.id}.test.ts'],
  status: 'draft',
};
`,
  );

  write(
    `tests/unit/${options.id}.test.ts`,
    `import { describe, expect, it } from 'vitest';
import { money } from '../../src/lib/calculations/common/money.ts';
import { ${name} } from '../../src/lib/calculations/${engineDir}/${options.slug}.ts';

describe('${options.id}', () => {
  it('reports that it is not implemented rather than returning a figure', () => {
    const result = ${name}({ amount: money(0) });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  // TODO(scaffold): before publishing, add
  //  - golden fixtures from the authority's own worked examples;
  //  - hand-calculated cases, with the workings in a comment;
  //  - every threshold tested immediately below, at, and immediately above;
  //  - zero, low, median, high, and very high inputs;
  //  - each unsupported combination, asserting it warns rather than guesses.
});
`,
  );

  console.log(`
Next steps, in order:

  1. Implement the calculation in
     src/lib/calculations/${engineDir}/${options.slug}.ts
  2. Define the input schema and the form fields in the registry entry.
  3. Add source-backed constants to a ruleset — never as literals in the engine.
  4. Replace every TODO(scaffold) marker. The indexability gate refuses to
     publish a page whose copy still contains one.
  5. Write golden and boundary fixtures in tests/unit/${options.id}.test.ts
  6. Add the calculator to CALCULATORS in src/lib/registry/index.ts
  7. Run: npm run gate
  8. Review the page inventory diff in
     src/data/page-manifests/generated/page-manifest.json
  9. Only then change status from 'draft' to 'published'.

Routing, navigation, sitemaps, breadcrumbs, structured data, and analytics all
read the registry, so none of them needs editing.
`);
}

main();
