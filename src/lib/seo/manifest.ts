/**
 * The build-time page manifest and indexability gate.
 *
 * Every page the site can emit is enumerated here, together with whether it
 * passes the quality gate and, if not, exactly why. The build reads this to
 * decide what to render, what to mark `noindex,follow`, and what to put in the
 * XML sitemaps — so a page can never end up in a sitemap without having passed.
 *
 * The gate is deliberately strict about things that are cheap to get right and
 * expensive to get wrong: an official source, a checked-on date, a visible
 * assumptions section, a visible limitations section, and no placeholder text.
 */
import { SITE } from '../../config/site.ts';
import {
  CALCULATORS,
  calculatorPath,
  indexabilityBlockers,
  isCalculatorIndexable,
} from '../registry/index.ts';
import { JURISDICTIONS, findRuleset, isExpired } from '../../data/jurisdictions/index.ts';
import { salaryPageEntries } from '../../data/salary-amounts.ts';
import { formatAmountForTitle } from '../formatting/index.ts';
import type { CurrencyCode, JurisdictionCode } from '../calculations/common/types.ts';
import type { AnyCalculatorDefinition } from '../registry/types.ts';

export type PageTemplate =
  | 'home'
  | 'family-hub'
  | 'country-hub'
  | 'calculator'
  | 'salary-result'
  | 'content'
  | 'legal'
  | 'directory';

export interface PageManifestEntry {
  readonly path: string;
  readonly template: PageTemplate;
  readonly title: string;
  readonly description: string;
  readonly indexable: boolean;
  /** Empty when indexable. Otherwise the exact reasons, for the audit report. */
  readonly blockers: readonly string[];
  readonly inSitemap: boolean;
  readonly calculatorId?: string;
  readonly jurisdiction?: JurisdictionCode;
  readonly region?: string | null;
  readonly amount?: number;
  /** ISO date reflecting a real content or rules change, not the build time. */
  readonly lastModified: string;
}

/** Text that must never appear on an indexable page. */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /\bTODO\b/i,
  /\bTBC\b/i,
  /\bTBD\b/i,
  /\blorem ipsum\b/i,
  /\bplaceholder\b/i,
  /\bcoming soon\b/i,
  /\bXXX\b/,
];

export function containsPlaceholder(text: string): string[] {
  return PLACEHOLDER_PATTERNS.filter((pattern) => pattern.test(text)).map(
    (pattern) => pattern.source,
  );
}

/**
 * The lastmod for tax-driven pages is the date the ruleset was checked against
 * its source, not the deployment time. A redeploy that changes nothing must not
 * tell search engines the page changed.
 */
function lastModifiedFor(
  jurisdiction: JurisdictionCode | undefined,
  region: string | null | undefined,
): string {
  if (!jurisdiction) return CONTENT_LAST_MODIFIED;
  const ruleset = findRuleset(jurisdiction, region ?? null);
  return ruleset?.provenance.checkedOn ?? CONTENT_LAST_MODIFIED;
}

/** Bumped by hand when the static content of the site actually changes. */
export const CONTENT_LAST_MODIFIED = '2026-09-03';

function gateCalculator(calculator: AnyCalculatorDefinition): string[] {
  const blockers: string[] = [...indexabilityBlockers(calculator)];

  if (calculator.assumptions.length === 0) {
    blockers.push(
      'No assumptions are declared, so the page could not show an assumptions section.',
    );
  }
  if (calculator.limitations.length === 0) {
    blockers.push('No limitations are declared.');
  }
  if (calculator.fields.length === 0) {
    blockers.push('The calculator has no input fields, so there is nothing to run.');
  }
  if (calculator.testFixtures.length === 0) {
    blockers.push('No test fixtures are referenced.');
  }

  // Every tax tool must cite its sources. A checked-on date is required only
  // once the ruleset claims to be verified — an unverified ruleset publishes
  // with a visible health warning instead, which the built HTML is checked for.
  if (!calculator.indexability.indexableWithoutTaxData) {
    if (calculator.sources.length === 0) {
      blockers.push('No official source is cited.');
    } else {
      const jurisdiction = (calculator.jurisdictions as readonly string[])[0];
      const ruleset =
        jurisdiction && jurisdiction !== 'global'
          ? findRuleset(jurisdiction as JurisdictionCode)
          : undefined;
      if (
        ruleset?.provenance.dataStatus === 'populated' &&
        calculator.sources.every((source) => source.checkedOn === null)
      ) {
        blockers.push('Ruleset claims to be verified but no source carries a checked-on date.');
      }
    }
  }

  for (const text of [calculator.title, calculator.description, calculator.metaDescription]) {
    const found = containsPlaceholder(text);
    if (found.length > 0) blockers.push(`Placeholder text found: ${found.join(', ')}`);
  }

  for (const jurisdiction of calculator.jurisdictions as readonly string[]) {
    if (jurisdiction === 'global') continue;
    const ruleset = findRuleset(jurisdiction as JurisdictionCode);
    if (ruleset && isExpired(ruleset)) {
      blockers.push(`The ${ruleset.taxPeriod.label} ruleset expired on ${ruleset.expiresOn}.`);
    }
  }

  return [...new Set(blockers)];
}

function calculatorEntries(): PageManifestEntry[] {
  return CALCULATORS.map((calculator) => {
    const blockers = gateCalculator(calculator);
    const indexable = blockers.length === 0 && isCalculatorIndexable(calculator);
    const jurisdiction = (calculator.jurisdictions as readonly string[])[0];
    return {
      path: calculatorPath(calculator),
      template: 'calculator' as const,
      title: calculator.title,
      description: calculator.metaDescription,
      indexable,
      blockers,
      inSitemap: indexable,
      calculatorId: calculator.id,
      ...(jurisdiction && jurisdiction !== 'global'
        ? { jurisdiction: jurisdiction as JurisdictionCode }
        : {}),
      lastModified: lastModifiedFor(
        jurisdiction === 'global' ? undefined : (jurisdiction as JurisdictionCode),
        null,
      ),
    };
  });
}

function salaryEntries(): PageManifestEntry[] {
  return salaryPageEntries().map((entry) => {
    const meta = JURISDICTIONS.find((candidate) => candidate.code === entry.jurisdiction);
    const ruleset = findRuleset(entry.jurisdiction, entry.region);
    const salaryTool = CALCULATORS.find(
      (calculator) => calculator.id === `${entry.jurisdiction}-salary`,
    );

    const blockers: string[] = [];
    if (!ruleset) {
      blockers.push(`No ruleset for ${entry.jurisdiction}/${entry.region ?? 'default'}.`);
    } else {
      if (ruleset.provenance.dataStatus === 'awaiting-official-source') {
        blockers.push(
          `The ${ruleset.taxPeriod.label} ruleset has empty rate tables, so no static result can be rendered.`,
        );
      }
      if (ruleset.status !== 'published') {
        blockers.push(`Ruleset status is "${ruleset.status}", not "published".`);
      }
      if (isExpired(ruleset)) {
        blockers.push(`The ruleset expired on ${ruleset.expiresOn}.`);
      }
    }
    if (salaryTool && !isCalculatorIndexable(salaryTool)) {
      blockers.push('The underlying salary calculator is not itself indexable.');
    }

    const currency = (meta?.currency ?? 'GBP') as CurrencyCode;
    const place = entry.regionLabel ?? meta?.name ?? entry.jurisdiction;
    const period = ruleset?.taxPeriod.label ?? '';

    return {
      path: entry.path,
      template: 'salary-result' as const,
      title: `${formatAmountForTitle(entry.amount, currency)} After Tax in ${place} (${period})`,
      description: `A full breakdown of what ${formatAmountForTitle(entry.amount, currency)} a year is after tax in ${place} for ${period}, with every deduction itemised.`,
      indexable: blockers.length === 0,
      blockers: [...new Set(blockers)],
      inSitemap: blockers.length === 0,
      calculatorId: `${entry.jurisdiction}-salary`,
      jurisdiction: entry.jurisdiction,
      region: entry.region,
      amount: entry.amount,
      lastModified: lastModifiedFor(entry.jurisdiction, entry.region),
    };
  });
}

/** Static content and legal pages. These never depend on tax data. */
export const STATIC_PAGES: readonly {
  path: string;
  template: PageTemplate;
  title: string;
  description: string;
}[] = [
  {
    path: '/',
    template: 'home',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.valueProposition,
  },
  {
    path: '/salary-tax-calculators/',
    template: 'family-hub',
    title: 'Salary & Tax Calculators | ClearFigures',
    description:
      'Take-home pay, net-to-gross, bonus, and pay-rise calculators for every market we cover.',
  },
  {
    path: '/mortgage-calculators/',
    template: 'family-hub',
    title: 'Mortgage Calculators | ClearFigures',
    description:
      'Repayment, amortisation, and overpayment calculators with the formulas and assumptions shown.',
  },
  {
    path: '/calculators/',
    template: 'directory',
    title: 'All Calculators | ClearFigures',
    description: 'Every calculator on the site, grouped by what it does and where it applies.',
  },
  {
    path: '/methodology/',
    template: 'content',
    title: 'How These Calculators Work | ClearFigures',
    description:
      'Progressive bands, marginal versus average rates, contribution handling, annualisation, and rounding, explained plainly.',
  },
  {
    path: '/sources/',
    template: 'content',
    title: 'Official Sources | ClearFigures',
    description:
      'Every official source behind these calculators, grouped by country and tax period, with the date each was checked.',
  },
  {
    path: '/tax-data-updates/',
    template: 'content',
    title: 'Tax Data Update Log | ClearFigures',
    description: 'A dated record of every change to the tax rules behind these calculators.',
  },
  {
    path: '/editorial-policy/',
    template: 'content',
    title: 'Editorial Policy | ClearFigures',
    description:
      'How rules are researched, reviewed, and published, and what that review does and does not amount to.',
  },
  {
    path: '/corrections/',
    template: 'content',
    title: 'Corrections | ClearFigures',
    description: 'How to report an error in a calculation, and how corrections are handled.',
  },
  {
    path: '/about/',
    template: 'content',
    title: `About ${SITE.name}`,
    description: `What ${SITE.name} is for and who builds it.`,
  },
  {
    path: '/contact/',
    template: 'content',
    title: `Contact ${SITE.name}`,
    description: `How to get in touch with ${SITE.name}.`,
  },
  {
    path: '/privacy/',
    template: 'legal',
    title: 'Privacy Notice | ClearFigures',
    description: 'What is and is not collected when you use these calculators.',
  },
  {
    path: '/cookies/',
    template: 'legal',
    title: 'Cookies | ClearFigures',
    description: 'Which cookies and similar technologies this site uses.',
  },
  {
    path: '/terms/',
    template: 'legal',
    title: 'Terms of Use | ClearFigures',
    description: 'The terms on which this site is provided.',
  },
  {
    path: '/disclaimer/',
    template: 'legal',
    title: 'Disclaimer | ClearFigures',
    description:
      'These calculators produce estimates and are not tax, legal, mortgage, or financial advice.',
  },
];

function staticEntries(): PageManifestEntry[] {
  return STATIC_PAGES.map((page) => ({
    ...page,
    indexable: true,
    blockers: [],
    inSitemap: true,
    lastModified: CONTENT_LAST_MODIFIED,
  }));
}

function countryHubEntries(): PageManifestEntry[] {
  return JURISDICTIONS.map((meta) => {
    const ruleset = findRuleset(meta.code);
    const calculators = CALCULATORS.filter((calculator) =>
      (calculator.jurisdictions as readonly string[]).includes(meta.code),
    );
    const anyIndexable = calculators.some(isCalculatorIndexable);

    // A country hub is worth indexing only when it can send the reader to a
    // working calculator. Otherwise it is a signpost to nothing.
    const blockers = anyIndexable
      ? []
      : [`No calculator for ${meta.name} is indexable yet, so the hub has nothing to link to.`];

    return {
      path: `/${meta.slug}/`,
      template: 'country-hub' as const,
      title: `${meta.adjective} Salary & Tax Calculators (${ruleset?.taxPeriod.label ?? ''})`,
      description: `Take-home pay, bonus, and pay-rise calculators for ${meta.name}, with sources and assumptions shown on every result.`,
      indexable: blockers.length === 0,
      blockers,
      inSitemap: blockers.length === 0,
      jurisdiction: meta.code,
      lastModified: lastModifiedFor(meta.code, null),
    };
  });
}

let cached: PageManifestEntry[] | null = null;

export function buildPageManifest(): PageManifestEntry[] {
  if (cached) return cached;
  cached = [...staticEntries(), ...countryHubEntries(), ...calculatorEntries(), ...salaryEntries()];
  return cached;
}

export function indexablePages(): PageManifestEntry[] {
  return buildPageManifest().filter((entry) => entry.indexable && SITE.allowIndexing);
}

export function sitemapPages(): PageManifestEntry[] {
  // Staging and preview builds never set SITE_ALLOW_INDEXING, so their sitemap
  // is empty by construction rather than by anyone remembering to clear it.
  if (!SITE.allowIndexing) return [];
  return buildPageManifest().filter((entry) => entry.inSitemap);
}

export function withheldPages(): PageManifestEntry[] {
  return buildPageManifest().filter((entry) => !entry.indexable);
}

export interface ManifestSummary {
  readonly total: number;
  readonly indexable: number;
  readonly withheld: number;
  readonly byTemplate: Record<string, { total: number; indexable: number }>;
  readonly allowIndexing: boolean;
}

export function summariseManifest(): ManifestSummary {
  const manifest = buildPageManifest();
  const byTemplate: Record<string, { total: number; indexable: number }> = {};
  for (const entry of manifest) {
    const bucket = (byTemplate[entry.template] ??= { total: 0, indexable: 0 });
    bucket.total += 1;
    if (entry.indexable) bucket.indexable += 1;
  }
  return {
    total: manifest.length,
    indexable: manifest.filter((entry) => entry.indexable).length,
    withheld: manifest.filter((entry) => !entry.indexable).length,
    byTemplate,
    allowIndexing: SITE.allowIndexing,
  };
}

/** Duplicate-path detection. Two routes emitting the same URL is a build error. */
export function duplicatePaths(): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of buildPageManifest()) {
    if (seen.has(entry.path)) duplicates.add(entry.path);
    seen.add(entry.path);
  }
  return [...duplicates];
}
