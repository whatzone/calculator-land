# Calculation methodology

The engineering counterpart to the public `/methodology/` page. This one is for
whoever maintains the engine.

## Money

`src/lib/calculations/common/money.ts` wraps `big.js`. `Big.DP = 20` so that
repeated division — a 52-week split, then a re-multiplication — never drifts by
anything approaching a penny.

Plain numbers are permitted only for display, chart geometry, and JSON. If you
find yourself writing `+`, `*`, or `/` on a monetary value, you have a bug.

Rounding modes are named for their tax context, not their maths:
`HALF_UP` (the default for display), `HALF_EVEN`, `DOWN` (several authorities
round tax down to the whole unit), and `UP`. The mode and the stage are recorded
per jurisdiction in `rules.rounding`, because authorities differ on both.

## Progressive bands

`applyBands` taxes only the slice of income inside each band and returns a
working per band. Bands arrive as data; the function knows no rate.

`validateBands` requires bands to be contiguous, ascending, non-overlapping, and
unbounded above at the top. A ruleset failing this cannot be published, and the
audit names the specific gap.

## Allowances, credits, levies, contributions

These are four different things and the engine models them separately:

- **Allowance** — deducted from income _before_ bands apply. May taper:
  `taperAllowance(allowance, income, threshold, withdrawnPerUnit)`, where the
  UK's "£1 for every £2" is `withdrawnPerUnit: 0.5`.
- **Credit** — deducted from tax _after_ bands apply. Non-refundable credits are
  floored at zero; refundable ones are not. The distinction is in the data.
- **Levy** — a flat rate over a floor, optionally to a ceiling.
- **Contribution** — its own bands, its own floor, often a ceiling on earnings
  or a cap on the contribution itself.

Do not model one as another because the arithmetic happens to match at some
income. It will stop matching at a threshold.

## Marginal rate

Measured, never looked up:

```ts
measureMarginalRate(gross, (probe) => deductionsAt(options, probe).total);
```

The probe is 100 currency units — small enough not to skip a band, large enough
to stay well clear of rounding noise.

This matters most where it differs from the headline rate. Inside an allowance
taper, each extra unit is taxed _and_ removes allowance that is then also taxed;
the synthetic tapered fixture measures 75% where the band rate is 50%. A
lookup-based implementation would report 50% and be confidently wrong exactly
where a reader most needs the truth.

The same principle drives `calculateBonus` and `calculatePayRise`: both compute
the whole year twice and take the difference.

## Net to gross

No closed-form inverse exists once tapers and caps are involved, so
`solveGrossForNet` bisects — bounded, iteration-capped, and verified by feeding
the answer back through the forward calculation.

Two behaviours worth preserving:

- **Tidying.** Bisection lands on values like `60000.01` when `60000` is equally
  correct. `finalise` tries the tidiest candidates first and returns the first
  that still reproduces the target within tolerance. Every candidate is verified.
- **Refusal.** If the bracket collapses without meeting tolerance, a cliff sits
  exactly at that net figure and no gross produces it. The caller is told, not
  handed the closest miss.

## Annualisation

Everything is computed on a full tax year, then divided. Real payroll withholds
period by period, often cumulatively, and some contributions stop mid-year at an
annual maximum.

Every result therefore carries `isAnnualisedEstimate: true` and every page says
so. This is not a hedge — it is the difference between our figure and a payslip,
and readers who do not know it will think we are wrong.

## Refusing to answer

`runSalaryCalculation` returns `supported: false` with an explicit notice when:

- the ruleset is not calculable — unpopulated, retired, or has no bands;
- a composed layer is not calculable;
- gross pay is negative.

Jurisdiction adapters add their own refusals: Ireland refuses non-single civil
statuses, Australia refuses a profile that does not claim the tax-free
threshold, and `requireScheme` refuses any optional scheme the ruleset does not
carry data for.

An unsupported result is not an error state to be swallowed. It renders
prominently, and the page it appears on cannot be indexed.

## Property tests

`tests/unit/properties.test.ts` asserts invariants against the synthetic
fixtures, which were built deliberately without cliffs or refundable credits:

- net plus deductions equals gross;
- deductions never exceed gross;
- neither net nor deductions is ever negative;
- marginal rate is within 0–100%;
- earning more never reduces take-home pay;
- the same input always gives the same result;
- average rate never exceeds marginal rate.

**Re-justify every one of these before applying them to a real jurisdiction.**
Monotonicity fails in any system with a cliff. Non-negativity of deductions
fails with a refundable credit. A property test asserting something untrue of
the tax system is worse than no property test, because it will be "fixed" by
breaking the engine.

## Mortgages

Standard annuity formula, with `r = 0` handled explicitly as `P / n` rather than
allowed to divide by zero.

The schedule is built by simulating each period against the running balance, not
by splitting a total. That is what lets the final payment absorb accumulated
rounding and land the balance on exactly zero — and it is also why a payment too
small to cover the interest is detected on the first period and reported, rather
than looping to the iteration guard.

The final-payment adjustment applies only at the last scheduled period and only
when the residual is no larger than one payment. A genuine underpayment still
extends the term, as it should.
