/**
 * Ruleset predicates with no runtime dependencies.
 *
 * These live apart from `ruleset-schema.ts` on purpose. That module builds Zod
 * schemas at import time, so anything importing it pulls Zod into the bundle.
 * The calculation engine needs to ask "is this ruleset usable?" in the browser,
 * where a validation library has no business being — the data was already
 * validated at build time. Importing the `Ruleset` type from the schema module
 * is free, because type imports are erased.
 */
import type { Ruleset } from './ruleset-schema.ts';

/** Complete enough to run a calculation at all. */
export function isCalculable(ruleset: Ruleset): boolean {
  return (
    ruleset.provenance.dataStatus === 'populated' &&
    ruleset.status !== 'retired' &&
    ruleset.rules.incomeTaxBands.length > 0
  );
}

/** Complete enough to back an indexable page. */
export function isPublishable(ruleset: Ruleset): boolean {
  return isCalculable(ruleset) && ruleset.status === 'published';
}

export function isExpired(ruleset: Ruleset, asOf: Date = new Date()): boolean {
  return new Date(ruleset.expiresOn) < asOf;
}
