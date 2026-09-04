#!/usr/bin/env tsx
/**
 * Tax-data audit. Run with `npm run tax:audit`.
 *
 * Reports rulesets that are expiring, expired, unpopulated, unsourced, undated,
 * or referenced by a page that claims to be publishable. Exits non-zero when
 * anything is genuinely wrong, so CI fails rather than quietly shipping.
 *
 * This script never fetches a source and never edits a rate. Updating tax data
 * is a human job with a runbook: docs/TAX-DATA-UPDATE-RUNBOOK.md.
 */
import { ALL_RULESETS } from '../src/data/jurisdictions/index.ts';
import { validateBands, toBands } from '../src/lib/calculations/common/brackets.ts';
import { buildPageManifest } from '../src/lib/seo/manifest.ts';
import type { Ruleset } from '../src/lib/validation/ruleset-schema.ts';

const EXPIRY_WARNING_DAYS = 60;

/**
 * `expected-gap` is the documented, tracked state of a ruleset that is awaiting
 * an official source. It is reported loudly on every run but does not fail the
 * build, because the danger it represents — unverified figures reaching the
 * index — is already hard-blocked by the indexability gate, and a permanently
 * red pipeline trains people to ignore it.
 *
 * `error` is anything else: a real defect, or an expected gap that has somehow
 * become publicly indexable. Run with `--strict` to treat expected gaps as
 * errors too; CI does this once a jurisdiction is meant to be live.
 */
interface Finding {
  readonly severity: 'error' | 'expected-gap' | 'warning' | 'info';
  readonly rulesetId: string;
  readonly message: string;
}

const STRICT = process.argv.includes('--strict');

function daysUntil(iso: string): number {
  const target = new Date(`${iso}T00:00:00Z`).getTime();
  return Math.floor((target - Date.now()) / 86_400_000);
}

function auditRuleset(ruleset: Ruleset): Finding[] {
  const findings: Finding[] = [];
  const id = ruleset.id;

  if (ruleset.status === 'retired') {
    findings.push({ severity: 'info', rulesetId: id, message: 'Retired; kept for auditability.' });
    return findings;
  }

  const awaitingSource = ruleset.provenance.dataStatus === 'awaiting-official-source';
  const unverified = ruleset.provenance.dataStatus === 'unverified';
  const gapSeverity = awaitingSource && ruleset.status === 'draft' ? 'expected-gap' : 'error';

  if (awaitingSource) {
    findings.push({
      severity: gapSeverity,
      rulesetId: id,
      message: 'Rate tables are empty.',
    });
  }

  if (unverified) {
    findings.push({
      severity: 'expected-gap',
      rulesetId: id,
      message:
        'PUBLISHED WITH UNVERIFIED FIGURES. Nobody has compared these against the authority ' +
        'that publishes them. Every affected page renders a provenance notice saying so.',
    });
  }

  if (ruleset.provenance.checkedOn === null && !awaitingSource && !unverified) {
    findings.push({
      severity: gapSeverity,
      rulesetId: id,
      message: 'No checked-on date: nobody has confirmed this against the official source.',
    });
  }

  if (ruleset.sources.length === 0) {
    findings.push({ severity: 'error', rulesetId: id, message: 'No official source is recorded.' });
  }

  for (const source of ruleset.sources) {
    if (source.checkedOn === null) {
      findings.push({
        severity: awaitingSource || unverified ? 'expected-gap' : 'error',
        rulesetId: id,
        message: `Source "${source.id}" has never been checked: ${source.url}`,
      });
    }
  }

  // Expiry is checked per jurisdiction in auditSuccession, not here. A past tax
  // year being past its end date is the point of keeping it, not a fault.

  if (ruleset.rules.incomeTaxBands.length > 0) {
    const problems = validateBands(toBands(ruleset.rules.incomeTaxBands));
    for (const problem of problems) {
      findings.push({ severity: 'error', rulesetId: id, message: `Income tax bands: ${problem}` });
    }
  }

  for (const surtax of ruleset.rules.surtaxes) {
    for (const problem of validateBands(toBands(surtax.bands))) {
      findings.push({
        severity: 'error',
        rulesetId: id,
        message: `Surtax "${surtax.id}": ${problem}`,
      });
    }
  }

  for (const contribution of ruleset.rules.contributions) {
    if (contribution.bands.length === 0) continue;
    // Contributions may end on a bounded band: CPP and EI both stop at a
    // maximum earnings figure.
    const problems = validateBands(toBands(contribution.bands), { requireUnboundedTop: false });
    for (const problem of problems) {
      findings.push({
        severity: 'error',
        rulesetId: id,
        message: `Contribution "${contribution.id}": ${problem}`,
      });
    }
  }

  return findings;
}

/**
 * The real staleness risk, now that past years are kept deliberately.
 *
 * A historical ruleset sitting past its end date is expected. What is not
 * expected is the *newest* ruleset for a jurisdiction having ended with no
 * successor — that is the state in which the site quietly serves last year's
 * rates as though they were current.
 */
function auditSuccession(): Finding[] {
  const findings: Finding[] = [];

  const groups = new Map<string, Ruleset[]>();
  for (const ruleset of ALL_RULESETS) {
    if (ruleset.status === 'retired') continue;
    const key = `${ruleset.jurisdiction}/${ruleset.subJurisdiction ?? 'national'}`;
    groups.set(key, [...(groups.get(key) ?? []), ruleset]);
  }

  for (const [key, rulesets] of groups) {
    const newest = [...rulesets].sort((a, b) =>
      b.taxPeriod.startDate.localeCompare(a.taxPeriod.startDate),
    )[0];
    if (!newest) continue;

    const remaining = daysUntil(newest.taxPeriod.endDate);

    if (remaining < 0) {
      findings.push({
        severity: 'error',
        rulesetId: key,
        message:
          `The newest tax year held is ${newest.taxPeriod.label}, which ended on ` +
          `${newest.taxPeriod.endDate}. There is no successor, so the calculator is offering a ` +
          'finished year as though it were current. Add the new year.',
      });
    } else if (remaining <= EXPIRY_WARNING_DAYS) {
      findings.push({
        severity: 'warning',
        rulesetId: key,
        message:
          `The current tax year ${newest.taxPeriod.label} ends in ${remaining} day(s). ` +
          'Start the update runbook so the next year is ready before it does.',
      });
    }
  }

  return findings;
}

function main(): void {
  const findings = [...ALL_RULESETS.flatMap(auditRuleset), ...auditSuccession()];

  // A page that claims to be indexable must not rest on an unpublished ruleset.
  const manifest = buildPageManifest();
  const leaking = manifest.filter(
    (entry) => entry.indexable && entry.jurisdiction !== undefined && entry.blockers.length > 0,
  );
  for (const entry of leaking) {
    findings.push({
      severity: 'error',
      rulesetId: entry.jurisdiction ?? 'unknown',
      message: `Page ${entry.path} is marked indexable despite blockers: ${entry.blockers.join('; ')}`,
    });
  }

  const rawErrors = findings.filter((finding) => finding.severity === 'error');
  const gaps = findings.filter((finding) => finding.severity === 'expected-gap');
  const warnings = findings.filter((finding) => finding.severity === 'warning');
  const infos = findings.filter((finding) => finding.severity === 'info');
  const errors = STRICT ? [...rawErrors, ...gaps] : rawErrors;

  console.log('\nTax data audit');
  console.log('='.repeat(70));
  console.log(`Rulesets registered: ${ALL_RULESETS.length}`);
  const count = (status: string) =>
    ALL_RULESETS.filter((r) => r.provenance.dataStatus === status).length;
  console.log(
    `Verified: ${count('populated')} | Unverified: ${count('unverified')} | ` +
      `Awaiting source: ${count('awaiting-official-source')}`,
  );
  console.log(
    `Pages withheld from the index: ${manifest.filter((e) => !e.indexable).length} of ${manifest.length}`,
  );
  console.log('');

  // Which years each market currently offers. This is the line a maintainer
  // reads once a year to see what still needs the new year adding.
  const years = new Map<string, Set<string>>();
  for (const ruleset of ALL_RULESETS) {
    const key = ruleset.subJurisdiction
      ? `${ruleset.jurisdiction}/${ruleset.subJurisdiction}`
      : ruleset.jurisdiction;
    const set = years.get(key) ?? new Set<string>();
    set.add(ruleset.taxPeriod.label);
    years.set(key, set);
  }
  console.log('Tax years offered');
  for (const key of [...years.keys()].sort()) {
    const labels = [...(years.get(key) ?? [])].sort().reverse();
    console.log(`  ${key.padEnd(28)} ${labels.join(', ')}`);
  }
  console.log('');

  for (const [label, list] of [
    ['ERROR', rawErrors],
    ['AWAITING OFFICIAL SOURCE', gaps],
    ['WARNING', warnings],
    ['INFO', infos],
  ] as const) {
    if (list.length === 0) continue;
    console.log(`${label} (${list.length})`);
    for (const finding of list) {
      console.log(`  [${finding.rulesetId}] ${finding.message}`);
    }
    console.log('');
  }

  console.log('='.repeat(70));

  if (errors.length > 0) {
    console.log(`${errors.length} blocking issue(s). Fix these before deploying.`);
    process.exitCode = 1;
    return;
  }

  if (gaps.length > 0) {
    console.log(
      `No blocking issues.\n\n` +
        `${gaps.length} finding(s) relate to rulesets that are unverified or awaiting a source.\n` +
        'Those are tracked, not ignored: every page depending on them is held out\n' +
        'of the index and out of the sitemap by the indexability gate, which is\n' +
        'verified separately by `npm run seo:audit`. Follow\n' +
        'docs/TAX-DATA-UPDATE-RUNBOOK.md to source and publish a jurisdiction,\n' +
        'then re-run this audit with --strict.',
    );
    return;
  }

  console.log('No blocking issues.');
}

main();
