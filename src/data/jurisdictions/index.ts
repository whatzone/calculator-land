/**
 * Ruleset registry — the single place the rest of the application looks up
 * tax rules. Nothing imports a jurisdiction file directly.
 */
import type { JurisdictionCode } from '../../lib/calculations/common/types.ts';
import {
  isCalculable,
  isExpired,
  isPublishable,
  isUnverified,
  isVerified,
  type Ruleset,
} from '../../lib/validation/ruleset-schema.ts';
import { byPeriodDescending, defaultPeriod, isCurrentPeriod } from './_years.ts';
import { ukRulesets } from './uk/index.ts';
import { irelandRulesets } from './ireland/index.ts';
import { australiaRulesets } from './australia/index.ts';
import { newZealandRulesets } from './new-zealand/index.ts';
import { canadaRulesets } from './canada/index.ts';

export const ALL_RULESETS: readonly Ruleset[] = [
  ...ukRulesets,
  ...irelandRulesets,
  ...australiaRulesets,
  ...newZealandRulesets,
  ...canadaRulesets,
];

const BY_ID = new Map<string, Ruleset>(ALL_RULESETS.map((ruleset) => [ruleset.id, ruleset]));

export function getRulesetById(id: string): Ruleset | undefined {
  return BY_ID.get(id);
}

export function requireRulesetById(id: string): Ruleset {
  const ruleset = BY_ID.get(id);
  if (!ruleset) throw new Error(`Unknown ruleset: ${id}`);
  return ruleset;
}

/**
 * Resolve the ruleset for a jurisdiction, region and tax year.
 *
 * Never silently substitutes one region's rules for another's, and never
 * substitutes one year's rules for another's: an unknown tax period returns
 * undefined so the caller can say so, rather than quietly answering with the
 * current year's figures under a previous year's label.
 */
export function findRuleset(
  jurisdiction: JurisdictionCode,
  subJurisdiction?: string | null,
  taxPeriod?: string | null,
): Ruleset | undefined {
  let candidates = ALL_RULESETS.filter((ruleset) => ruleset.jurisdiction === jurisdiction);

  if (subJurisdiction) {
    candidates = candidates.filter((ruleset) => ruleset.subJurisdiction === subJurisdiction);
  } else {
    const national = candidates.filter((ruleset) => ruleset.subJurisdiction === null);
    if (national.length > 0) candidates = national;
  }

  if (candidates.length === 0) return undefined;

  if (taxPeriod) {
    return candidates.find((ruleset) => ruleset.taxPeriod.label === taxPeriod);
  }

  const preferred = defaultPeriod(candidates);
  return candidates.find((ruleset) => ruleset.taxPeriod.label === preferred) ?? candidates[0];
}

/** Every tax year offered for a jurisdiction and region, newest first. */
export function taxPeriodsFor(
  jurisdiction: JurisdictionCode,
  subJurisdiction?: string | null,
): { label: string; isCurrent: boolean }[] {
  const candidates = ALL_RULESETS.filter(
    (ruleset) =>
      ruleset.jurisdiction === jurisdiction &&
      (subJurisdiction
        ? ruleset.subJurisdiction === subJurisdiction
        : ruleset.subJurisdiction === null || ruleset.subJurisdiction !== null) &&
      isCalculable(ruleset),
  );

  const seen = new Map<string, Ruleset>();
  for (const ruleset of candidates) {
    if (!seen.has(ruleset.taxPeriod.label)) seen.set(ruleset.taxPeriod.label, ruleset);
  }

  return [...seen.values()]
    .sort(byPeriodDescending)
    .map((ruleset) => ({ label: ruleset.taxPeriod.label, isCurrent: isCurrentPeriod(ruleset) }));
}

/** The tax year a calculator should open on for this jurisdiction. */
export function currentPeriodFor(
  jurisdiction: JurisdictionCode,
  subJurisdiction?: string | null,
): string | null {
  const candidates = ALL_RULESETS.filter(
    (ruleset) =>
      ruleset.jurisdiction === jurisdiction &&
      (subJurisdiction ? ruleset.subJurisdiction === subJurisdiction : true) &&
      isCalculable(ruleset),
  );
  return defaultPeriod(candidates);
}

export function rulesetsFor(jurisdiction: JurisdictionCode): readonly Ruleset[] {
  return ALL_RULESETS.filter((ruleset) => ruleset.jurisdiction === jurisdiction);
}

/** Rulesets whose data is complete enough to run a calculation at all. */
export function calculableRulesets(): readonly Ruleset[] {
  return ALL_RULESETS.filter(isCalculable);
}

/** Rulesets that may back an indexable page. */
export function publishableRulesets(): readonly Ruleset[] {
  return ALL_RULESETS.filter(isPublishable);
}

export function expiredRulesets(asOf: Date = new Date()): readonly Ruleset[] {
  return ALL_RULESETS.filter((ruleset) => isExpired(ruleset, asOf));
}

export interface JurisdictionMeta {
  readonly code: JurisdictionCode;
  readonly name: string;
  readonly adjective: string;
  readonly slug: string;
  readonly currency: string;
  readonly locale: string;
  readonly incomeTermPlural: string;
  /** Regions offered in the UI, in display order. Empty where there are none. */
  readonly regions: readonly { readonly code: string; readonly label: string }[];
}

export const JURISDICTIONS: readonly JurisdictionMeta[] = [
  {
    code: 'uk',
    name: 'the UK',
    adjective: 'UK',
    slug: 'uk',
    currency: 'GBP',
    locale: 'en-GB',
    incomeTermPlural: 'salaries',
    regions: [
      { code: 'england-wales-ni', label: 'England, Wales & Northern Ireland' },
      { code: 'scotland', label: 'Scotland' },
    ],
  },
  {
    code: 'ireland',
    name: 'Ireland',
    adjective: 'Irish',
    slug: 'ireland',
    currency: 'EUR',
    locale: 'en-IE',
    incomeTermPlural: 'salaries',
    regions: [],
  },
  {
    code: 'australia',
    name: 'Australia',
    adjective: 'Australian',
    slug: 'australia',
    currency: 'AUD',
    locale: 'en-AU',
    incomeTermPlural: 'salaries',
    regions: [],
  },
  {
    code: 'new-zealand',
    name: 'New Zealand',
    adjective: 'New Zealand',
    slug: 'new-zealand',
    currency: 'NZD',
    locale: 'en-NZ',
    incomeTermPlural: 'salaries',
    regions: [],
  },
  {
    code: 'canada',
    name: 'Canada',
    adjective: 'Canadian',
    slug: 'canada',
    currency: 'CAD',
    locale: 'en-CA',
    incomeTermPlural: 'salaries',
    regions: [
      { code: 'ontario', label: 'Ontario' },
      { code: 'british-columbia', label: 'British Columbia' },
      { code: 'alberta', label: 'Alberta' },
      { code: 'quebec', label: 'Quebec' },
    ],
  },
];

export function getJurisdiction(code: JurisdictionCode): JurisdictionMeta {
  const meta = JURISDICTIONS.find((candidate) => candidate.code === code);
  if (!meta) throw new Error(`Unknown jurisdiction: ${code}`);
  return meta;
}

export { isCalculable, isPublishable, isExpired, isVerified, isUnverified };
export { isCurrentPeriod, byPeriodDescending, defaultPeriod } from './_years.ts';
export type { Ruleset };
