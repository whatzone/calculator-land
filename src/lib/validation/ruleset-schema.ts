/**
 * Ruleset schema.
 *
 * A ruleset is the complete, versioned, dated statement of one jurisdiction's
 * rules for one tax period, together with its provenance. The schema is written
 * so that an unverified ruleset is *structurally* incapable of being published:
 * `status: 'published'` fails validation unless the data is populated, sourced,
 * and dated. That check is the reason a missing official source degrades the
 * site to noindex instead of degrading it to a confident wrong answer.
 */
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)');

const numeric = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)]);

export const sourceReferenceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url(),
  /** Null until a human has actually opened the page and compared the figures. */
  checkedOn: isoDate.nullable(),
});

export const bandSchema = z.object({
  label: z.string().min(1),
  from: numeric,
  to: numeric.nullable(),
  ratePercent: numeric,
});

export const allowanceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  amount: numeric,
  taperThreshold: numeric.nullable().default(null),
  taperWithdrawnPerUnit: numeric.nullable().default(null),
  /**
   * The amount the taper stops at. The UK personal allowance tapers to nothing;
   * Canada's federal basic personal amount tapers down to a floor and stays
   * there. Defaulting to zero preserves the UK behaviour.
   */
  taperFloorAmount: numeric.default(0),
  sourceIds: z.array(z.string()).default([]),
});

/**
 * A levy charged alongside income tax.
 *
 * `basis` matters more than it looks. Australia's Medicare levy is a rate on
 * the *whole* of taxable income once you are liable, not a rate on the income
 * above the threshold — modelling it the second way understates it at every
 * income. The shade-in fields describe the band between "exempt" and "fully
 * liable", where a different, higher rate applies to the excess only.
 */
export const levySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  ratePercent: numeric,
  /** 'whole-income' charges the rate on all income once liable. */
  basis: z.enum(['above-floor', 'whole-income']).default('above-floor'),
  /** Only used by the 'above-floor' basis. */
  floor: numeric.default(0),
  ceiling: numeric.nullable().default(null),
  /** No levy at all at or below this income. */
  exemptBelow: numeric.default(0),
  /** Upper edge of the shade-in band. Null means there is no shade-in. */
  phaseInTo: numeric.nullable().default(null),
  /** Rate applied to income above `exemptBelow` while inside the shade-in. */
  phaseInRatePercent: numeric.nullable().default(null),
  sourceIds: z.array(z.string()).default([]),
});

/**
 * A contribution scheme with bands, a floor, and a cap — the shape that covers
 * National Insurance, PRSI, CPP/QPP, EI/QPIP, and ACC alike.
 */
export const contributionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  bands: z.array(bandSchema).default([]),
  exemptBelow: numeric.default(0),
  maximumContribution: numeric.nullable().default(null),
  maximumEarnings: numeric.nullable().default(null),
  sourceIds: z.array(z.string()).default([]),
});

export const creditSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  amount: numeric,
  /** 'refundable' credits can exceed the tax due; 'non-refundable' cannot. */
  kind: z.enum(['refundable', 'non-refundable']),
  /** Non-refundable credits in some systems are a % of a base amount. */
  ratePercent: numeric.nullable().default(null),
  sourceIds: z.array(z.string()).default([]),
});

/**
 * A surtax: tax charged on tax, not on income.
 *
 * Ontario charges its surtax as a percentage of provincial income tax above
 * fixed amounts of tax. No income-based shape can express that, which is why it
 * needs its own.
 */
export const surtaxSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Bands measured in units of tax already due, not units of income. */
  bands: z.array(bandSchema).default([]),
  sourceIds: z.array(z.string()).default([]),
});

/**
 * An income-contingent loan repayment: UK student loans, Australian HELP,
 * New Zealand student loans.
 *
 * The two methods are genuinely different arithmetic and must not be
 * interchanged. `rate-above-threshold` charges a rate on the income above the
 * threshold. `banded-rate-on-total` picks a rate from a band and applies it to
 * the whole of the income — so crossing a band boundary produces a step change
 * in the amount repaid, which the first method never does.
 */
export const loanRepaymentSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Matched against the value of the profile option that selects this scheme. */
  selector: z.string().min(1),
  method: z.enum(['rate-above-threshold', 'banded-rate-on-total']),
  threshold: numeric.default(0),
  ratePercent: numeric.default(0),
  /** Used by 'banded-rate-on-total'; each band's rate applies to all income. */
  bands: z.array(bandSchema).default([]),
  sourceIds: z.array(z.string()).default([]),
});

/** The rule payload. Every collection defaults to empty, never to a guess. */
export const rulesSchema = z.object({
  incomeTaxBands: z.array(bandSchema).default([]),
  allowances: z.array(allowanceSchema).default([]),
  credits: z.array(creditSchema).default([]),
  levies: z.array(levySchema).default([]),
  contributions: z.array(contributionSchema).default([]),
  surtaxes: z.array(surtaxSchema).default([]),
  loanRepayments: z.array(loanRepaymentSchema).default([]),
  /** Jurisdiction-specific extras (student loans, KiwiSaver, HELP, etc.). */
  optionalSchemes: z.record(z.string(), z.unknown()).default({}),
  /** Rounding policy applied at each documented stage. */
  rounding: z
    .object({
      taxableIncome: z.enum(['none', 'down-to-unit', 'half-up-to-unit']).default('none'),
      taxDue: z
        .enum(['none', 'down-to-unit', 'half-up-to-unit', 'half-up-to-minor'])
        .default('half-up-to-minor'),
      note: z.string().default(''),
    })
    .default({ taxableIncome: 'none', taxDue: 'half-up-to-minor', note: '' }),
});

export const RULESET_STATUSES = [
  'draft',
  'verified-against-source',
  'published',
  'retired',
] as const;
export const DATA_STATUSES = ['awaiting-official-source', 'populated'] as const;

export const rulesetSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'lowercase kebab-case'),
    jurisdiction: z.enum(['uk', 'ireland', 'australia', 'new-zealand', 'canada']),
    subJurisdiction: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .nullable()
      .default(null),
    subJurisdictionLabel: z.string().nullable().default(null),

    taxPeriod: z.object({
      label: z.string().min(1),
      startDate: isoDate,
      endDate: isoDate,
    }),

    currency: z.enum(['GBP', 'EUR', 'AUD', 'NZD', 'CAD', 'USD']),
    locale: z.string().min(2),

    status: z.enum(RULESET_STATUSES),

    provenance: z.object({
      dataStatus: z.enum(DATA_STATUSES),
      /** Date a human compared this ruleset against the official source. */
      checkedOn: isoDate.nullable(),
      checkedBy: z.string().nullable().default(null),
      /** Why the data is in its current state. Required when awaiting a source. */
      note: z.string().default(''),
    }),

    sources: z.array(sourceReferenceSchema).default([]),

    supportedProfile: z.object({
      description: z.string().min(1),
      residency: z.string().min(1),
      employmentType: z.string().min(1),
    }),

    assumptions: z.array(z.string()).default([]),
    exclusions: z.array(z.string()).default([]),
    changeNotes: z.array(z.string()).default([]),

    /** After this date the ruleset must be re-checked; the audit warns first. */
    expiresOn: isoDate,

    rules: rulesSchema,
  })
  .superRefine((ruleset, ctx) => {
    const publishable =
      ruleset.status === 'published' || ruleset.status === 'verified-against-source';

    if (publishable && ruleset.provenance.dataStatus !== 'populated') {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: `Ruleset "${ruleset.id}" claims status "${ruleset.status}" but its data status is "${ruleset.provenance.dataStatus}". Unpopulated data can never be published.`,
      });
    }

    if (publishable && ruleset.provenance.checkedOn === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['provenance', 'checkedOn'],
        message: `Ruleset "${ruleset.id}" cannot be published without a date on which a human checked it against the official source.`,
      });
    }

    if (publishable && ruleset.sources.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['sources'],
        message: `Ruleset "${ruleset.id}" cannot be published without at least one official source.`,
      });
    }

    if (publishable && ruleset.sources.every((source) => source.checkedOn === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['sources'],
        message: `Ruleset "${ruleset.id}" cannot be published until at least one source carries a checked-on date.`,
      });
    }

    if (publishable && ruleset.rules.incomeTaxBands.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['rules', 'incomeTaxBands'],
        message: `Ruleset "${ruleset.id}" cannot be published with no income tax bands.`,
      });
    }

    if (
      ruleset.provenance.dataStatus === 'awaiting-official-source' &&
      ruleset.provenance.note.trim() === ''
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['provenance', 'note'],
        message: `Ruleset "${ruleset.id}" is awaiting an official source and must explain why.`,
      });
    }

    if (new Date(ruleset.taxPeriod.endDate) <= new Date(ruleset.taxPeriod.startDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['taxPeriod'],
        message: `Ruleset "${ruleset.id}" has a tax period that ends on or before it starts.`,
      });
    }
  });

export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type RulesetBand = z.infer<typeof bandSchema>;
export type Allowance = z.infer<typeof allowanceSchema>;
export type Levy = z.infer<typeof levySchema>;
export type Surtax = z.infer<typeof surtaxSchema>;
export type LoanRepayment = z.infer<typeof loanRepaymentSchema>;
export type Contribution = z.infer<typeof contributionSchema>;
export type Credit = z.infer<typeof creditSchema>;
export type Rules = z.infer<typeof rulesSchema>;
export type Ruleset = z.infer<typeof rulesetSchema>;
export type RulesetStatus = (typeof RULESET_STATUSES)[number];
export type DataStatus = (typeof DATA_STATUSES)[number];

/** Parse and throw with a readable message. Used at module load and in audits. */
export function parseRuleset(input: unknown): Ruleset {
  const result = rulesetSchema.safeParse(input);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid ruleset:\n${detail}`);
  }
  return result.data;
}

// The predicates live in ./ruleset-helpers.ts so that the calculation engine can
// use them without pulling Zod into the browser bundle. Re-exported here so
// callers that already validate against this module keep one import.
export { isCalculable, isPublishable, isExpired } from './ruleset-helpers.ts';
