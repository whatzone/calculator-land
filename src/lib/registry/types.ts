/**
 * The calculator contract.
 *
 * A registered calculator is the single source of truth for its routes, form
 * fields, validation, metadata, structured data, breadcrumbs, related links,
 * analytics identifiers, sitemap entries, indexability, and smoke tests.
 * Adding an ordinary calculator should therefore require no edits to route
 * templates, sitemap code, navigation, analytics, or structured-data code.
 */
import type { ZodTypeAny } from 'zod';
import type {
  CalculationContext,
  CurrencyCode,
  JurisdictionCode,
} from '../calculations/common/types.ts';

export type CalculatorFamily =
  'salary-tax' | 'mortgage' | 'property' | 'employment' | 'general-finance';

export const CALCULATOR_FAMILIES: readonly CalculatorFamily[] = [
  'salary-tax',
  'mortgage',
  'property',
  'employment',
  'general-finance',
];

export const FAMILY_LABELS: Record<CalculatorFamily, string> = {
  'salary-tax': 'Salary & tax',
  mortgage: 'Mortgage',
  property: 'Property',
  employment: 'Employment',
  'general-finance': 'General finance',
};

/** A form control. The renderer, the client validator, and the tests read this. */
export interface CalculatorFieldDefinition {
  readonly name: string;
  readonly label: string;
  readonly type: 'money' | 'percent' | 'number' | 'select' | 'checkbox' | 'radio';
  readonly required: boolean;
  readonly defaultValue?: string | number | boolean;
  /** Help text rendered beside the control, not hidden behind a tooltip. */
  readonly help?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  /** Fields inside the collapsed "advanced options" group. */
  readonly advanced?: boolean;
  /** Prefix/suffix shown inside the control, e.g. a currency symbol or %. */
  readonly prefix?: string;
  readonly suffix?: string;
  readonly autocomplete?: string;
  readonly inputMode?: 'numeric' | 'decimal' | 'text';
}

export interface SourceReference {
  readonly id: string;
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  readonly checkedOn: string | null;
}

export interface ContentReference {
  readonly id: string;
  readonly text: string;
}

/**
 * Why a calculator's pages may or may not be indexed.
 * `requiresPublishedRuleset` is what keeps unsourced tax pages out of the index
 * without anyone having to remember to exclude them.
 */
export interface IndexabilityRule {
  readonly requiresPublishedRuleset: boolean;
  /** Rulesets that must all be published before any of this tool's pages index. */
  readonly rulesetIds: readonly string[];
  /** Set true only for tools whose correctness does not depend on tax data. */
  readonly indexableWithoutTaxData: boolean;
}

/** One row of the presented result. */
export interface ResultRow {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly emphasis?: 'primary' | 'secondary' | 'muted';
}

/** What a result page renders. Produced by `present`, consumed by templates. */
export interface ResultViewModel {
  readonly headline: { readonly label: string; readonly value: string; readonly caption?: string };
  readonly summaryRows: readonly ResultRow[];
  readonly breakdownRows: readonly ResultRow[];
  /**
   * Column headings for the breakdown table. A salary breakdown is per year; a
   * mortgage breakdown is a total over the term. Labelling both "A year" would
   * misstate the mortgage figures by a factor of the term.
   */
  readonly breakdownHeadings?: { readonly item: string; readonly value: string };
  readonly frequencyRows: readonly ResultRow[];
  readonly notices: readonly {
    readonly severity: 'info' | 'warning' | 'unsupported';
    readonly message: string;
  }[];
  readonly assumptions: readonly string[];
  readonly supported: boolean;
  /** Chart segments. Always duplicated by `breakdownRows` for accessibility. */
  readonly chart?: readonly {
    readonly label: string;
    readonly value: number;
    readonly percent: number;
  }[];
}

export interface CalculatorDefinition<Input = unknown, Result = unknown> {
  readonly id: string;
  readonly family: CalculatorFamily;
  /** Path segment, not a full URL. Routes are composed from jurisdiction + slug. */
  readonly slug: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
  /** Metadata description. Distinct from `description`, which is body copy. */
  readonly metaDescription: string;
  readonly jurisdictions: readonly JurisdictionCode[] | readonly ['global'];
  readonly currency?: CurrencyCode;

  readonly inputSchema: ZodTypeAny;
  readonly fields: readonly CalculatorFieldDefinition[];

  readonly calculate: (input: Input, context: CalculationContext) => Result;
  readonly present: (result: Result, context: CalculationContext) => ResultViewModel;

  readonly assumptions: readonly ContentReference[];
  readonly sources: readonly SourceReference[];
  readonly limitations: readonly string[];
  readonly relatedCalculatorIds: readonly string[];
  readonly indexability: IndexabilityRule;
  readonly analytics: { readonly toolId: string; readonly category: string };
  readonly testFixtures: readonly string[];

  /** Publication state. `draft` tools are built but never indexed or linked. */
  readonly status: 'draft' | 'published';
}

export type AnyCalculatorDefinition = CalculatorDefinition<never, never>;
