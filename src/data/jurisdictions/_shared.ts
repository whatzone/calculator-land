/**
 * Shared helpers for jurisdiction rulesets.
 *
 * WHY EVERY RATE TABLE IN THIS DIRECTORY IS EMPTY
 * -----------------------------------------------
 * The build environment used to create this repository has a network egress
 * policy that blocks every official tax-authority domain (gov.uk, revenue.ie,
 * ato.gov.au, ird.govt.nz, canada.ca) and every third-party tax reference.
 * Confirmed unreachable on 2026-09-03 via both direct HTTPS and the fetch tool.
 *
 * The project's first accuracy rule is that no rate, threshold, credit,
 * contribution, formula, source, or check date may be invented. Publishing
 * remembered or search-summarised figures as if they were sourced from an
 * authority would break that rule, so the rate tables ship empty and every
 * ruleset sits at `status: 'draft'` with `dataStatus: 'awaiting-official-source'`.
 *
 * The consequences are deliberate and enforced by code, not by convention:
 *  - the engines are complete and fully tested, but refuse to produce a figure
 *    from an unpopulated ruleset and return an explicit `unsupported` notice;
 *  - the indexability gate omits every tax-calculator and salary page;
 *  - `npm run tax:audit` exits non-zero and names each ruleset still awaiting
 *    data.
 *
 * To bring a market live, follow docs/TAX-DATA-UPDATE-RUNBOOK.md. Nothing else
 * in the codebase needs to change: populate `rules`, fill in `sources` with
 * checked-on dates, set `dataStatus: 'populated'` and `status: 'published'`,
 * add golden fixtures, and the pages generate themselves.
 */
import { parseRuleset, type Ruleset } from '../../lib/validation/ruleset-schema.ts';

/** Date on which the official domains were confirmed unreachable. */
export const EGRESS_BLOCK_DATE = '2026-09-03';

export const AWAITING_SOURCE_NOTE =
  `Rate tables intentionally empty. Official tax-authority domains were blocked by the ` +
  `build environment's network egress policy on ${EGRESS_BLOCK_DATE}, so no figure in this ` +
  `ruleset could be verified against an authority. Populating this file from memory or from ` +
  `third-party summaries is prohibited — see docs/TAX-DATA-UPDATE-RUNBOOK.md.`;

export const CANDIDATE_SOURCE_NOTE =
  `Candidate entry point recorded to save research time. NOT verified: checkedOn is null and ` +
  `must stay null until a human opens the page and compares every figure.`;

/**
 * Build a ruleset that is structurally valid but explicitly unpopulated.
 * The schema forbids `published` status on such a ruleset, so this helper
 * cannot be used to accidentally ship unsourced numbers.
 */
export function defineAwaitingSourceRuleset(
  input: Omit<Parameters<typeof parseRuleset>[0] & Record<string, unknown>, never>,
): Ruleset {
  return parseRuleset(input);
}
