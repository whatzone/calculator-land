/**
 * The curated salary-page manifest.
 *
 * This is the whole list of programmatic salary pages the site will ever build.
 * It is a typed literal rather than a generated range on purpose: adding a page
 * has to be an explicit, reviewed change, because every entry is a promise that
 * the resulting page says something specific about that amount in that place.
 *
 * Roughly 118 pages. Not thousands. The expansion criteria for adding to this
 * list are in docs/EDITORIAL-AND-SEO.md; the short version is that a new amount
 * needs Search Console evidence of distinct demand, not a hunch.
 */
import type { JurisdictionCode } from '../lib/calculations/common/types.ts';

export interface SalaryPageSpec {
  readonly jurisdiction: JurisdictionCode;
  /** Region slug used in the URL, or null for a jurisdiction-level page. */
  readonly region: string | null;
  readonly regionLabel: string | null;
  readonly amounts: readonly number[];
}

const UK_AMOUNTS = [
  18000, 20000, 22000, 25000, 28000, 30000, 32000, 35000, 40000, 45000, 50000, 60000, 75000, 100000,
  125000, 150000,
] as const;

const IRELAND_AMOUNTS = [
  25000, 30000, 35000, 40000, 45000, 50000, 60000, 75000, 100000, 125000,
] as const;

const AUSTRALIA_AMOUNTS = [
  40000, 50000, 60000, 70000, 80000, 90000, 100000, 120000, 150000, 200000,
] as const;

const NEW_ZEALAND_AMOUNTS = [
  40000, 50000, 60000, 70000, 80000, 90000, 100000, 120000, 150000, 200000,
] as const;

const CANADA_AMOUNTS = [
  30000, 40000, 50000, 60000, 70000, 80000, 100000, 120000, 150000, 200000,
] as const;

export const SALARY_PAGE_SPECS: readonly SalaryPageSpec[] = [
  // The UK ships two full sets because Scottish income tax has a different band
  // structure, so a Scottish reader given rest-of-UK figures would be misled.
  { jurisdiction: 'uk', region: null, regionLabel: null, amounts: UK_AMOUNTS },
  { jurisdiction: 'uk', region: 'scotland', regionLabel: 'Scotland', amounts: UK_AMOUNTS },

  { jurisdiction: 'ireland', region: null, regionLabel: null, amounts: IRELAND_AMOUNTS },
  { jurisdiction: 'australia', region: null, regionLabel: null, amounts: AUSTRALIA_AMOUNTS },
  { jurisdiction: 'new-zealand', region: null, regionLabel: null, amounts: NEW_ZEALAND_AMOUNTS },

  // Four provinces at launch. The other nine are added only once their engine
  // tests pass and demand is demonstrated — see docs/ROADMAP.md, phase 2.
  { jurisdiction: 'canada', region: 'ontario', regionLabel: 'Ontario', amounts: CANADA_AMOUNTS },
  {
    jurisdiction: 'canada',
    region: 'british-columbia',
    regionLabel: 'British Columbia',
    amounts: CANADA_AMOUNTS,
  },
  { jurisdiction: 'canada', region: 'alberta', regionLabel: 'Alberta', amounts: CANADA_AMOUNTS },
  { jurisdiction: 'canada', region: 'quebec', regionLabel: 'Quebec', amounts: CANADA_AMOUNTS },
];

export interface SalaryPageEntry {
  readonly jurisdiction: JurisdictionCode;
  readonly region: string | null;
  readonly regionLabel: string | null;
  readonly amount: number;
  readonly path: string;
}

/** Every curated salary page, expanded. Routes are generated from this. */
export function salaryPageEntries(): SalaryPageEntry[] {
  const entries: SalaryPageEntry[] = [];
  for (const spec of SALARY_PAGE_SPECS) {
    for (const amount of spec.amounts) {
      entries.push({
        jurisdiction: spec.jurisdiction,
        region: spec.region,
        regionLabel: spec.regionLabel,
        amount,
        path: spec.region
          ? `/${spec.jurisdiction}/${spec.region}/salary/${amount}-after-tax/`
          : `/${spec.jurisdiction}/salary/${amount}-after-tax/`,
      });
    }
  }
  return entries;
}

export const TOTAL_SALARY_PAGES = salaryPageEntries().length;

/**
 * Neighbouring amounts for internal linking. Links follow the journey a reader
 * actually takes — "what about a bit more, or a bit less" — rather than being
 * a keyword-stuffed block of every amount on the site.
 */
export function neighbouringAmounts(
  jurisdiction: JurisdictionCode,
  region: string | null,
  amount: number,
  count = 4,
): SalaryPageEntry[] {
  const siblings = salaryPageEntries().filter(
    (entry) => entry.jurisdiction === jurisdiction && entry.region === region,
  );
  const index = siblings.findIndex((entry) => entry.amount === amount);
  if (index === -1) return [];

  const before = siblings.slice(Math.max(0, index - Math.ceil(count / 2)), index);
  const after = siblings.slice(index + 1, index + 1 + count - before.length);
  return [...before, ...after];
}
