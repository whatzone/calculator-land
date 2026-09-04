/**
 * Provenance integrity.
 *
 * The site publishes tax figures that nobody has checked against an official
 * source. That is the owner's decision and a defensible one, but it is only
 * defensible while three things hold, which these tests pin:
 *
 *   1. no ruleset can claim a check that did not happen;
 *   2. every unverified ruleset explains itself in its own data;
 *   3. the explanation reaches the reader.
 *
 * The third is also enforced against the built HTML by check-indexability.ts.
 */
import { describe, expect, it } from 'vitest';
import { ALL_RULESETS } from '../../src/data/jurisdictions/index.ts';
import { isUnverified, isVerified } from '../../src/lib/validation/ruleset-helpers.ts';
import { rulesetSchema } from '../../src/lib/validation/ruleset-schema.ts';
import { buildPageManifest } from '../../src/lib/seo/manifest.ts';
import { validateBands, toBands } from '../../src/lib/calculations/common/brackets.ts';

const unverified = ALL_RULESETS.filter(isUnverified);

describe('no ruleset claims a check that did not happen', () => {
  it('leaves checkedOn null on every unverified ruleset', () => {
    for (const ruleset of unverified) {
      expect(ruleset.provenance.checkedOn, ruleset.id).toBeNull();
      expect(isVerified(ruleset), ruleset.id).toBe(false);
    }
  });

  it('leaves every source unchecked while the ruleset is unverified', () => {
    for (const ruleset of unverified) {
      for (const source of ruleset.sources) {
        expect(source.checkedOn, `${ruleset.id} / ${source.id}`).toBeNull();
      }
    }
  });

  it('refuses a ruleset that dates a check it has not done', () => {
    const base = unverified[0];
    expect(base).toBeDefined();
    const result = rulesetSchema.safeParse({
      ...base,
      provenance: { ...base!.provenance, checkedOn: '2026-09-03' },
    });
    expect(result.success).toBe(false);
  });

  it('refuses to call unverified data "verified-against-source"', () => {
    const base = unverified[0];
    const result = rulesetSchema.safeParse({ ...base, status: 'verified-against-source' });
    expect(result.success).toBe(false);
  });

  it('refuses an unverified ruleset with no explanation', () => {
    const base = unverified[0];
    const result = rulesetSchema.safeParse({
      ...base,
      provenance: { ...base!.provenance, note: 'tbc' },
    });
    expect(result.success).toBe(false);
  });
});

describe('every unverified ruleset explains itself', () => {
  it('says the figures were not read from the official source', () => {
    for (const ruleset of unverified) {
      expect(ruleset.provenance.note, ruleset.id).toMatch(/NOT read from the official source/);
    }
  });

  it('points at the ambiguity register', () => {
    for (const ruleset of unverified) {
      expect(ruleset.provenance.note, ruleset.id).toContain('RATE-AMBIGUITIES');
    }
  });

  it('declares what it excludes, in the reader’s terms', () => {
    for (const ruleset of unverified) {
      expect(ruleset.exclusions.length, ruleset.id).toBeGreaterThan(0);
      expect(ruleset.assumptions.length, ruleset.id).toBeGreaterThan(2);
    }
  });

  it('cites at least one official source per ruleset', () => {
    for (const ruleset of unverified) {
      expect(ruleset.sources.length, ruleset.id).toBeGreaterThan(0);
    }
  });
});

describe('the published rules are internally coherent', () => {
  it('has contiguous, ascending, unbounded-topped income tax bands', () => {
    for (const ruleset of ALL_RULESETS) {
      if (ruleset.rules.incomeTaxBands.length === 0) continue;
      expect(validateBands(toBands(ruleset.rules.incomeTaxBands)), ruleset.id).toEqual([]);
    }
  });

  it('has coherent contribution and surtax bands', () => {
    for (const ruleset of ALL_RULESETS) {
      for (const contribution of ruleset.rules.contributions) {
        if (contribution.bands.length === 0) continue;
        // A contribution that stops at a maximum earnings figure ends on a
        // bounded band, and that ceiling is the point of it.
        expect(
          validateBands(toBands(contribution.bands), { requireUnboundedTop: false }),
          `${ruleset.id} / ${contribution.id}`,
        ).toEqual([]);
      }
      for (const surtax of ruleset.rules.surtaxes) {
        expect(validateBands(toBands(surtax.bands)), `${ruleset.id} / ${surtax.id}`).toEqual([]);
      }
    }
  });

  it('never sets a taper floor above the amount being tapered', () => {
    for (const ruleset of ALL_RULESETS) {
      for (const item of [...ruleset.rules.allowances, ...ruleset.rules.credits]) {
        if (item.taperThreshold === null) continue;
        expect(Number(item.taperFloorAmount), `${ruleset.id} / ${item.id}`).toBeLessThanOrEqual(
          Number(item.amount),
        );
      }
    }
  });
});

describe('Quebec is held back deliberately', () => {
  const quebec = ALL_RULESETS.find((ruleset) => ruleset.subJurisdiction === 'quebec');

  it('is registered but not published', () => {
    expect(quebec).toBeDefined();
    expect(quebec?.status).toBe('draft');
    expect(quebec?.provenance.dataStatus).toBe('awaiting-official-source');
  });

  it('explains that the abatement cannot be modelled, not merely that data is missing', () => {
    expect(quebec?.provenance.note).toMatch(/abatement/i);
  });

  it('keeps every Quebec page out of the index', () => {
    const pages = buildPageManifest().filter((entry) => entry.region === 'quebec');
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(page.indexable, page.path).toBe(false);
    }
  });
});
