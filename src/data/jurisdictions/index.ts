/**
 * Ruleset registry — the single place the rest of the application looks up
 * tax rules. Nothing imports a jurisdiction file directly.
 */
import type { JurisdictionCode } from '../../lib/calculations/common/types.ts';
import {
  isCalculable,
  isExpired,
  isPublishable,
  type Ruleset,
} from '../../lib/validation/ruleset-schema.ts';
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
 * Resolve the ruleset for a jurisdiction and optional sub-jurisdiction.
 * Falls back to the jurisdiction-level ruleset only where one genuinely exists
 * (Ireland, Australia, New Zealand); never silently substitutes one region's
 * rules for another's.
 */
export function findRuleset(
  jurisdiction: JurisdictionCode,
  subJurisdiction?: string | null,
): Ruleset | undefined {
  const candidates = ALL_RULESETS.filter((ruleset) => ruleset.jurisdiction === jurisdiction);
  if (subJurisdiction) {
    return candidates.find((ruleset) => ruleset.subJurisdiction === subJurisdiction);
  }
  return candidates.find((ruleset) => ruleset.subJurisdiction === null) ?? candidates[0];
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

export { isCalculable, isPublishable, isExpired };
export type { Ruleset };
