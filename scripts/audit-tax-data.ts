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
import { ALL_RULESETS, isExpired } from '../src/data/jurisdictions/index.ts';
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
  const gapSeverity = awaitingSource && ruleset.status === 'draft' ? 'expected-gap' : 'error';

  if (ruleset.provenance.dataStatus !== 'populated') {
    findings.push({
      severity: gapSeverity,
      rulesetId: id,
      message: `Rate tables are empty (${ruleset.provenance.dataStatus}).`,
    });
  }

  if (ruleset.provenance.checkedOn === null) {
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
        severity: awaitingSource ? 'expected-gap' : 'error',
        rulesetId: id,
        message: `Source "${source.id}" has never been checked: ${source.url}`,
      });
    }
  }

  if (isExpired(ruleset)) {
    findings.push({
      severity: 'error',
      rulesetId: id,
      message: `Expired on ${ruleset.expiresOn}. Pages using it must not be indexed.`,
    });
  } else {
    const remaining = daysUntil(ruleset.expiresOn);
    if (remaining <= EXPIRY_WARNING_DAYS) {
      findings.push({
        severity: 'warning',
        rulesetId: id,
        message: `Expires in ${remaining} day(s) on ${ruleset.expiresOn}. Start the update runbook now.`,
      });
    }
  }

  if (ruleset.rules.incomeTaxBands.length > 0) {
    const problems = validateBands(toBands(ruleset.rules.incomeTaxBands));
    for (const problem of problems) {
      findings.push({ severity: 'error', rulesetId: id, message: `Income tax bands: ${problem}` });
    }
  }

  for (const contribution of ruleset.rules.contributions) {
    if (contribution.bands.length === 0) continue;
    const problems = validateBands(toBands(contribution.bands));
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

function main(): void {
  const findings = ALL_RULESETS.flatMap(auditRuleset);

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
  console.log(
    `Populated: ${ALL_RULESETS.filter((r) => r.provenance.dataStatus === 'populated').length} | ` +
      `Awaiting source: ${ALL_RULESETS.filter((r) => r.provenance.dataStatus === 'awaiting-official-source').length}`,
  );
  console.log(
    `Pages withheld from the index: ${manifest.filter((e) => !e.indexable).length} of ${manifest.length}`,
  );
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
        `${gaps.length} finding(s) relate to rulesets still awaiting an official source.\n` +
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
