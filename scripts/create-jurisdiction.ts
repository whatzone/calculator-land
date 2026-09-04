#!/usr/bin/env tsx
/**
 * Scaffold a new jurisdiction. Run with `npm run create:jurisdiction`.
 *
 *   npm run create:jurisdiction -- --code singapore --name Singapore \
 *     --adjective Singaporean --currency SGD --locale en-SG \
 *     --period 2027 --start 2027-01-01 --end 2027-12-31
 *
 * It creates a ruleset with empty rate tables, `status: 'draft'` and
 * `dataStatus: 'awaiting-official-source'`. That is the only state it can
 * create: the ruleset schema rejects a published ruleset that has no populated
 * data, no sources, and no checked-on date, so this script cannot be used to
 * shortcut the research.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ALL_RULESETS, JURISDICTIONS } from '../src/data/jurisdictions/index.ts';

interface Options {
  code: string;
  name: string;
  adjective: string;
  currency: string;
  locale: string;
  period: string;
  start: string;
  end: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const get = (name: string, fallback = ''): string => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? fallback : (args[index + 1] ?? fallback);
  };
  return {
    code: get('code'),
    name: get('name'),
    adjective: get('adjective'),
    currency: get('currency'),
    locale: get('locale'),
    period: get('period'),
    start: get('start'),
    end: get('end'),
  };
}

function fail(message: string): never {
  console.error(`\n${message}\n`);
  console.error(
    'Usage: npm run create:jurisdiction -- --code <code> --name <Name> \\\n' +
      '         --adjective <Adjective> --currency <ISO> --locale <locale> \\\n' +
      '         --period <label> --start <YYYY-MM-DD> --end <YYYY-MM-DD>\n',
  );
  process.exit(1);
}

function main(): void {
  const options = parseArgs();

  if (!/^[a-z0-9-]+$/.test(options.code))
    fail('--code is required and must be lowercase kebab-case.');
  if (!options.name) fail('--name is required.');
  if (!options.adjective) fail('--adjective is required (used in page titles).');
  if (!/^[A-Z]{3}$/.test(options.currency))
    fail('--currency must be a three-letter ISO 4217 code.');
  if (!options.locale) fail('--locale is required, e.g. en-SG.');
  if (!options.period) fail('--period is required, e.g. 2027 or 2026-27.');
  for (const [flag, value] of [
    ['--start', options.start],
    ['--end', options.end],
  ] as const) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${flag} must be an ISO date (YYYY-MM-DD).`);
  }
  if (new Date(options.end) <= new Date(options.start)) fail('--end must be after --start.');

  if (JURISDICTIONS.some((meta) => meta.code === options.code)) {
    fail(`Jurisdiction "${options.code}" already exists.`);
  }
  const rulesetId = `${options.code}-${options.period.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  if (ALL_RULESETS.some((ruleset) => ruleset.id === rulesetId)) {
    fail(`Ruleset "${rulesetId}" already exists.`);
  }

  const path = `src/data/jurisdictions/${options.code}/index.ts`;
  const full = resolve(path);
  if (existsSync(full)) fail(`Refusing to overwrite existing file: ${path}`);

  const varName = options.code.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(
    full,
    `/**
 * ${options.name} ruleset for the ${options.period} tax period.
 *
 * Rate tables are empty. See ../_shared.ts for the rule this enforces: no rate,
 * threshold, credit, or contribution may be entered here except from the
 * official source that publishes it, read by a person, on a recorded date.
 */
import type { Ruleset } from '../../../lib/validation/ruleset-schema.ts';
import { defineAwaitingSourceRuleset } from '../_shared.ts';

export const ${varName}${options.period.replace(/[^a-zA-Z0-9]/g, '_')}: Ruleset = defineAwaitingSourceRuleset({
  id: '${rulesetId}',
  jurisdiction: '${options.code}',
  subJurisdiction: null,
  subJurisdictionLabel: null,
  currency: '${options.currency}',
  locale: '${options.locale}',
  status: 'draft',
  taxPeriod: { label: '${options.period}', startDate: '${options.start}', endDate: '${options.end}' },
  expiresOn: '${options.end}',
  provenance: {
    dataStatus: 'awaiting-official-source',
    checkedOn: null,
    checkedBy: null,
    note: 'Scaffolded ruleset. No figure has been sourced. See docs/COUNTRY-ONBOARDING.md.',
  },
  sources: [
    // TODO(scaffold): add the official authority pages. Each entry keeps
    // checkedOn: null until a person has opened it and compared every figure.
  ],
  supportedProfile: {
    description: 'TODO(scaffold): describe exactly whose situation this models.',
    residency: 'TODO(scaffold)',
    employmentType: 'TODO(scaffold)',
  },
  assumptions: [],
  exclusions: [],
  changeNotes: [],
  rules: {
    incomeTaxBands: [],
    allowances: [],
    credits: [],
    levies: [],
    contributions: [],
    surtaxes: [],
    loanRepayments: [],
    optionalSchemes: {},
    rounding: { taxableIncome: 'none', taxDue: 'half-up-to-minor', note: 'TODO(scaffold): confirm against the authority.' },
  },
});

export const ${varName}Rulesets: readonly Ruleset[] = [${varName}${options.period.replace(/[^a-zA-Z0-9]/g, '_')}];
`,
    'utf8',
  );

  console.log(`\n  created ${path}\n`);
  console.log(`Next steps, in order:

  1. Register the ruleset in src/data/jurisdictions/index.ts:
       import { ${varName}Rulesets } from './${options.code}/index.ts';
     and add it to ALL_RULESETS and JURISDICTIONS.
  2. Work through docs/COUNTRY-ONBOARDING.md. It is a checklist, not a summary.
  2a. Read "Check the rule shape exists before you start" in
     docs/TAX-DATA-UPDATE-RUNBOOK.md. If a rule does not fit an existing shape,
     extend the schema rather than approximating with the nearest one.
  3. Populate rules ONLY from the official source, recording the URL and the
     date you read it against every figure.
  4. Add golden fixtures from the authority's own worked examples, plus
     boundary tests immediately below, at, and above every threshold.
  5. Add the jurisdiction's salary amounts to src/data/salary-amounts.ts —
     an explicit, reviewed list, not a generated range.
  6. Run: npm run gate && npm run tax:audit -- --strict
  7. Set dataStatus to 'populated' and status to 'published'.

Until step 7, every page for this jurisdiction is built but held out of the
index and out of the sitemap automatically. Nothing else needs changing.
`);
}

main();
