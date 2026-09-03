/**
 * The calculator registry.
 *
 * Everything downstream reads this: routes, navigation, the calculator
 * directory, breadcrumbs, related links, metadata, structured data, analytics
 * identifiers, the page manifest, sitemaps, and the indexability audit.
 * Registering a calculator here is the only step needed to make it exist.
 */
import { JURISDICTIONS, findRuleset, isPublishable } from '../../data/jurisdictions/index.ts';
import { buildSalaryToolSet, contextFor } from './factories/salary-tax.ts';
import { globalCalculators } from './calculators/global.ts';
import type { JurisdictionCode } from '../calculations/common/types.ts';
import type { AnyCalculatorDefinition, CalculatorFamily } from './types.ts';

const salaryToolSets = JURISDICTIONS.map((meta) => buildSalaryToolSet(meta.code));

export const CALCULATORS: readonly AnyCalculatorDefinition[] = [
  ...salaryToolSets.flatMap(
    (set) =>
      [set.salary, set.netToGross, set.bonus, set.payRise] as unknown as AnyCalculatorDefinition[],
  ),
  ...(globalCalculators as unknown as AnyCalculatorDefinition[]),
];

const BY_ID = new Map(CALCULATORS.map((calculator) => [calculator.id, calculator]));

export function getCalculator(id: string): AnyCalculatorDefinition | undefined {
  return BY_ID.get(id);
}

export function requireCalculator(id: string): AnyCalculatorDefinition {
  const calculator = BY_ID.get(id);
  if (!calculator) throw new Error(`Unknown calculator: ${id}`);
  return calculator;
}

export function calculatorsForJurisdiction(
  jurisdiction: JurisdictionCode,
): AnyCalculatorDefinition[] {
  return CALCULATORS.filter((calculator) =>
    (calculator.jurisdictions as readonly string[]).includes(jurisdiction),
  );
}

export function globalCalculatorList(): AnyCalculatorDefinition[] {
  return CALCULATORS.filter((calculator) =>
    (calculator.jurisdictions as readonly string[]).includes('global'),
  );
}

export function calculatorsInFamily(family: CalculatorFamily): AnyCalculatorDefinition[] {
  return CALCULATORS.filter((calculator) => calculator.family === family);
}

/** The canonical URL path for a calculator. Routes are generated from this. */
export function calculatorPath(calculator: AnyCalculatorDefinition): string {
  if ((calculator.jurisdictions as readonly string[]).includes('global')) {
    return calculator.family === 'mortgage'
      ? `/mortgage-calculators/${calculator.slug}/`
      : `/calculators/${calculator.slug}/`;
  }
  const jurisdiction = calculator.jurisdictions[0] as JurisdictionCode;
  return `/${jurisdiction}/${calculator.slug}/`;
}

/**
 * Whether a calculator's own page may be indexed.
 *
 * A tax tool is indexable only when every ruleset it depends on is published.
 * That single rule is what keeps unsourced pages out of the index without any
 * template or sitemap needing to know about tax data at all.
 */
export function isCalculatorIndexable(calculator: AnyCalculatorDefinition): boolean {
  if (calculator.status !== 'published') return false;
  if (calculator.indexability.indexableWithoutTaxData) return true;
  if (!calculator.indexability.requiresPublishedRuleset) return true;
  if (calculator.indexability.rulesetIds.length === 0) return false;
  return calculator.indexability.rulesetIds.every((id) => {
    const ruleset = findRuleset(
      calculator.jurisdictions[0] as JurisdictionCode,
      id.includes('scotland') ? 'scotland' : null,
    );
    return ruleset ? isPublishable(ruleset) : false;
  });
}

/** Human-readable reason a calculator is being withheld from the index. */
export function indexabilityBlockers(calculator: AnyCalculatorDefinition): string[] {
  if (isCalculatorIndexable(calculator)) return [];
  if (calculator.status !== 'published') return ['The calculator is still marked draft.'];

  const blockers: string[] = [];
  for (const jurisdiction of calculator.jurisdictions as readonly JurisdictionCode[]) {
    if ((jurisdiction as string) === 'global') continue;
    const ruleset = findRuleset(jurisdiction);
    if (!ruleset) {
      blockers.push(`No ruleset registered for ${jurisdiction}.`);
      continue;
    }
    if (ruleset.provenance.dataStatus !== 'populated') {
      blockers.push(`${jurisdiction}: rate tables are empty (${ruleset.provenance.dataStatus}).`);
    } else if (ruleset.status !== 'published') {
      blockers.push(`${jurisdiction}: ruleset status is "${ruleset.status}", not "published".`);
    }
  }
  return blockers.length > 0 ? blockers : ['Indexability requirements are not met.'];
}

export function indexableCalculators(): AnyCalculatorDefinition[] {
  return CALCULATORS.filter(isCalculatorIndexable);
}

export { contextFor };
export * from './types.ts';
