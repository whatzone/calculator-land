/**
 * Registry and manifest invariants.
 *
 * These are the tests that stop the site quietly publishing something it should
 * not. They enumerate the registry rather than naming calculators, so a tool
 * added tomorrow is covered by them automatically.
 */
import { describe, expect, it } from 'vitest';
import {
  CALCULATORS,
  calculatorPath,
  indexabilityBlockers,
  isCalculatorIndexable,
} from '../../src/lib/registry/index.ts';
import {
  buildPageManifest,
  duplicatePaths,
  sitemapPages,
  withheldPages,
  containsPlaceholder,
} from '../../src/lib/seo/manifest.ts';
import { ALL_RULESETS, findRuleset } from '../../src/data/jurisdictions/index.ts';
import { salaryPageEntries } from '../../src/data/salary-amounts.ts';
import { isPublishable } from '../../src/lib/validation/ruleset-helpers.ts';

describe('calculator registry', () => {
  it('registers every calculator with a unique id', () => {
    const ids = CALCULATORS.map((calculator) => calculator.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every calculator a unique route', () => {
    const paths = CALCULATORS.map(calculatorPath);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('generates routes with a leading and trailing slash', () => {
    for (const calculator of CALCULATORS) {
      const path = calculatorPath(calculator);
      expect(path.startsWith('/')).toBe(true);
      expect(path.endsWith('/')).toBe(true);
      expect(path).not.toContain('//');
    }
  });

  it('points every related-calculator reference at a real calculator', () => {
    const ids = new Set(CALCULATORS.map((calculator) => calculator.id));
    for (const calculator of CALCULATORS) {
      for (const related of calculator.relatedCalculatorIds) {
        expect(ids.has(related), `${calculator.id} -> ${related}`).toBe(true);
      }
    }
  });

  it('never lets a calculator relate to itself', () => {
    for (const calculator of CALCULATORS) {
      expect(calculator.relatedCalculatorIds).not.toContain(calculator.id);
    }
  });

  it('gives every calculator a distinct title and meta description', () => {
    const titles = CALCULATORS.map((calculator) => calculator.title);
    const descriptions = CALCULATORS.map((calculator) => calculator.metaDescription);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it('has no placeholder copy in any published calculator', () => {
    for (const calculator of CALCULATORS.filter((item) => item.status === 'published')) {
      for (const text of [calculator.title, calculator.description, calculator.metaDescription]) {
        expect(containsPlaceholder(text), `${calculator.id}: "${text}"`).toEqual([]);
      }
    }
  });

  it('declares an analytics tool id matching the calculator id', () => {
    for (const calculator of CALCULATORS) {
      expect(calculator.analytics.toolId).toBe(calculator.id);
    }
  });
});

describe('indexability gate', () => {
  it('refuses to index a tax calculator whose ruleset is not published', () => {
    for (const calculator of CALCULATORS) {
      if (calculator.indexability.indexableWithoutTaxData) continue;
      const jurisdiction = (calculator.jurisdictions as readonly string[])[0];
      const ruleset = findRuleset(jurisdiction as never);
      if (ruleset && !isPublishable(ruleset)) {
        expect(isCalculatorIndexable(calculator), calculator.id).toBe(false);
        expect(indexabilityBlockers(calculator).length).toBeGreaterThan(0);
      }
    }
  });

  it('gives a reason for every calculator it withholds', () => {
    for (const calculator of CALCULATORS.filter((item) => !isCalculatorIndexable(item))) {
      const blockers = indexabilityBlockers(calculator);
      expect(blockers.length, calculator.id).toBeGreaterThan(0);
      for (const blocker of blockers) expect(blocker.length).toBeGreaterThan(10);
    }
  });

  it('indexes the global calculators, which depend on no tax data', () => {
    const globals = CALCULATORS.filter((calculator) =>
      (calculator.jurisdictions as readonly string[]).includes('global'),
    );
    expect(globals.length).toBeGreaterThan(0);
    for (const calculator of globals) {
      expect(isCalculatorIndexable(calculator), calculator.id).toBe(true);
    }
  });
});

describe('page manifest', () => {
  it('emits no duplicate paths', () => {
    expect(duplicatePaths()).toEqual([]);
  });

  it('gives every page a title and a description', () => {
    for (const entry of buildPageManifest()) {
      expect(entry.title.length, entry.path).toBeGreaterThan(5);
      expect(entry.description.length, entry.path).toBeGreaterThan(20);
    }
  });

  it('gives every page a unique title', () => {
    const titles = buildPageManifest().map((entry) => entry.title);
    const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);
    expect([...new Set(duplicates)]).toEqual([]);
  });

  it('records a reason for every withheld page', () => {
    for (const entry of withheldPages()) {
      expect(entry.blockers.length, entry.path).toBeGreaterThan(0);
    }
  });

  it('never places a withheld page in the sitemap', () => {
    const withheld = new Set(withheldPages().map((entry) => entry.path));
    for (const entry of sitemapPages()) {
      expect(withheld.has(entry.path), entry.path).toBe(false);
    }
  });

  it('produces an empty sitemap when indexing is not enabled', () => {
    // The default environment has no SITE_ALLOW_INDEXING, which is what every
    // preview and branch deployment looks like.
    expect(sitemapPages()).toEqual([]);
  });

  it('builds a salary page for every curated entry', () => {
    const salaryPages = buildPageManifest().filter((entry) => entry.template === 'salary-result');
    expect(salaryPages.length).toBe(salaryPageEntries().length);
  });

  it('holds back salary pages whose ruleset carries no figures at all', () => {
    // Quebec is the case: its rules cannot be modelled correctly, so it is
    // registered but unpublished, and every page depending on it is withheld.
    const withheld = buildPageManifest().filter(
      (entry) => entry.template === 'salary-result' && !entry.indexable,
    );
    expect(withheld.length).toBeGreaterThan(0);
    for (const entry of withheld) {
      const ruleset = findRuleset(entry.jurisdiction as never, entry.region ?? null);
      expect(ruleset?.provenance.dataStatus, entry.path).toBe('awaiting-official-source');
    }
  });

  it('dates pages from the ruleset check, not from the build', () => {
    for (const entry of buildPageManifest()) {
      expect(entry.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('curated salary pages', () => {
  it('builds a bounded, reviewed set rather than a generated range', () => {
    const entries = salaryPageEntries();
    expect(entries.length).toBeGreaterThan(90);
    expect(entries.length).toBeLessThan(130);
  });

  it('gives every entry a unique path', () => {
    const paths = salaryPageEntries().map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('keeps Scottish pages on their own path', () => {
    const scottish = salaryPageEntries().filter((entry) => entry.region === 'scotland');
    expect(scottish.length).toBeGreaterThan(0);
    for (const entry of scottish) expect(entry.path).toContain('/uk/scotland/salary/');
  });
});

describe('rulesets', () => {
  it('gives every ruleset a unique id', () => {
    const ids = ALL_RULESETS.map((ruleset) => ruleset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never marks a ruleset with no figures as publishable', () => {
    for (const ruleset of ALL_RULESETS) {
      if (ruleset.provenance.dataStatus === 'awaiting-official-source') {
        expect(isPublishable(ruleset), ruleset.id).toBe(false);
      }
    }
  });

  it('never lets an unverified ruleset masquerade as verified', () => {
    for (const ruleset of ALL_RULESETS) {
      if (ruleset.provenance.dataStatus === 'unverified') {
        expect(ruleset.status, ruleset.id).not.toBe('verified-against-source');
        expect(ruleset.provenance.checkedOn, ruleset.id).toBeNull();
      }
    }
  });

  it('explains why any ruleset awaiting a source is in that state', () => {
    for (const ruleset of ALL_RULESETS) {
      if (ruleset.provenance.dataStatus === 'awaiting-official-source') {
        expect(ruleset.provenance.note.length, ruleset.id).toBeGreaterThan(40);
      }
    }
  });

  it('records a tax period that ends after it starts', () => {
    for (const ruleset of ALL_RULESETS) {
      expect(new Date(ruleset.taxPeriod.endDate).getTime()).toBeGreaterThan(
        new Date(ruleset.taxPeriod.startDate).getTime(),
      );
    }
  });

  it('names at least one official source for every jurisdiction', () => {
    for (const ruleset of ALL_RULESETS) {
      expect(ruleset.sources.length, ruleset.id).toBeGreaterThan(0);
      for (const source of ruleset.sources) {
        expect(source.url).toMatch(/^https:\/\//);
      }
    }
  });
});
