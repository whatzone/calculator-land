/**
 * Route helpers shared by every page template.
 */
import { buildPageManifest, type PageManifestEntry } from './manifest.ts';
import { JURISDICTIONS, findRuleset, rulesetsFor } from '../../data/jurisdictions/index.ts';
import type { JurisdictionCode } from '../calculations/common/types.ts';
import type { Ruleset } from '../validation/ruleset-schema.ts';
import type { Crumb } from './structured-data.ts';

export function manifestEntry(path: string): PageManifestEntry | undefined {
  return buildPageManifest().find((entry) => entry.path === path);
}

/** A page not in the manifest is never indexable: the gate is opt-in. */
export function isPathIndexable(path: string): boolean {
  return manifestEntry(path)?.indexable ?? false;
}

/**
 * The rulesets a calculator page must embed for the browser to recalculate.
 * Keyed by the sub-jurisdiction the form will select, plus 'default'.
 */
export function rulesetsForClient(jurisdiction: JurisdictionCode): Record<string, Ruleset> {
  const map: Record<string, Ruleset> = {};

  for (const ruleset of rulesetsFor(jurisdiction)) {
    if (ruleset.subJurisdiction) {
      map[ruleset.subJurisdiction] = ruleset;
    } else if (ruleset.subJurisdictionLabel === 'Federal') {
      map['federal'] = ruleset;
    } else {
      map['default'] = ruleset;
    }
  }

  const fallback = findRuleset(jurisdiction);
  if (!map['default'] && fallback) map['default'] = fallback;

  return map;
}

export function jurisdictionCrumbs(jurisdiction: JurisdictionCode): Crumb[] {
  const meta = JURISDICTIONS.find((candidate) => candidate.code === jurisdiction);
  return [
    { name: 'Home', path: '/' },
    ...(meta ? [{ name: `${meta.adjective} calculators`, path: `/${meta.slug}/` }] : []),
  ];
}
