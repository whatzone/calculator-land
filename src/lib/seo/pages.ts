/**
 * Route helpers shared by every page template.
 */
import { buildPageManifest, type PageManifestEntry } from './manifest.ts';
import { JURISDICTIONS, isCalculable, rulesetsFor } from '../../data/jurisdictions/index.ts';
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
 * The rulesets a calculator page embeds so the browser can recalculate.
 *
 * Keyed `region|taxPeriod`, because the reader can change either. A miss is
 * deliberately not backfilled from another year: answering a request for
 * 2024/25 with this year's rules under last year's label would be worse than
 * refusing.
 *
 * This is the one place page weight grows with the number of years held. The
 * rulesets are small — bands, thresholds and labels — and arrive as
 * already-validated JSON, so the browser still ships no validation library.
 */
export function rulesetsForClient(jurisdiction: JurisdictionCode): Record<string, Ruleset> {
  const map: Record<string, Ruleset> = {};

  for (const ruleset of rulesetsFor(jurisdiction)) {
    if (!isCalculable(ruleset)) continue;

    const region =
      ruleset.subJurisdiction ??
      (ruleset.subJurisdictionLabel === 'Federal' ? 'federal' : 'default');

    map[clientRulesetKey(region, ruleset.taxPeriod.label)] = ruleset;
  }

  return map;
}

/**
 * The key both sides use to find an embedded ruleset. Defined once so the
 * template and the browser cannot drift apart on its shape.
 */
export function clientRulesetKey(region: string | null | undefined, period: string): string {
  return `${region && region.length > 0 ? region : 'default'}|${period}`;
}

export function jurisdictionCrumbs(jurisdiction: JurisdictionCode): Crumb[] {
  const meta = JURISDICTIONS.find((candidate) => candidate.code === jurisdiction);
  return [
    { name: 'Home', path: '/' },
    ...(meta ? [{ name: `${meta.adjective} calculators`, path: `/${meta.slug}/` }] : []),
  ];
}
