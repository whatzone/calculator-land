# Tax data update runbook

This is the procedure for putting a tax rule on this site. It is also the
procedure for bringing a jurisdiction live for the first time, because those are
the same job.

**Nothing here is optional and nothing here is automated.** A script may tell
you a rule needs checking. Only a person may decide what the rule is.

---

## The one rule

> A rate, threshold, credit, contribution, formula, or date may only be entered
> from the official source that publishes it, read by a person, on a recorded
> date.

Not from another calculator. Not from a news article, a summary site, an
accountancy firm's blog, or a search result. Not from memory. Not from a model.

Another calculator may be used **afterwards**, as a rough sanity check on a
figure you have already sourced. If it disagrees, the official source wins and
you investigate why.

---

## Bringing a jurisdiction live

### 1. Find the official pages

Start from the authority, not from a search engine:

| Jurisdiction   | Authority                            | What you need                                                                                                                                                                                               |
| -------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| United Kingdom | HMRC (gov.uk); Student Loans Company | Income tax rates and personal allowance, the allowance taper, National Insurance class 1 employee rates and thresholds, student loan Plan 1/2/4/5 and postgraduate thresholds and rates                     |
| Scotland       | Scottish Government / HMRC           | Scottish income tax bands and rates. NI is UK-wide — do not re-source it                                                                                                                                    |
| Ireland        | Revenue; gov.ie for PRSI             | Income tax bands, personal and employee tax credits, USC bands, PRSI class A                                                                                                                                |
| Australia      | ATO                                  | Resident income tax rates, Medicare levy rate and thresholds, applicable offsets, and the study and training loan repayment scale — **confirm which method is in force for the year**, not only the numbers |
| Canada         | CRA; Revenu Québec for Quebec        | Federal rates and basic personal amount, provincial rates and credits, CPP/QPP rates and maximums, EI/QPIP rates and maximums, and publication T4127 for the payroll formulas                               |

The candidate URLs already recorded in each ruleset file are a starting point,
not an answer. Every one carries `checkedOn: null`, which means nobody has
confirmed it. Confirm it, or replace it.

### 2. Confirm the tax period

Check you are looking at the **current, legally effective** period, not one
that has been announced but has not started. An announced future period may be
stored as a separate ruleset with its own effective dates; it must not be
published as current.

The period boundaries themselves (UK 6 April to 5 April, Australia 1 July to
30 June, Ireland and Canada calendar years) are structural and already
encoded.

### 2a. Check the rule shape exists before you start

The engine expresses rules through a fixed set of shapes. Before entering
anything, confirm the rule you are looking at fits one of them. If it does not,
**stop and extend the schema** — approximating it with the nearest shape is how
a calculator ends up confidently wrong.

| Shape            | Use it for                                   | Key fields                                                                                   |
| ---------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `incomeTaxBands` | Progressive income tax                       | `from`, `to`, `ratePercent`                                                                  |
| `allowances`     | Deducted from income _before_ bands          | `amount`, `taperThreshold`, `taperWithdrawnPerUnit`, `taperFloorAmount`                      |
| `credits`        | Deducted from tax _after_ bands              | `amount`, `kind`, `ratePercent`                                                              |
| `levies`         | A charge alongside income tax                | `ratePercent`, `basis`, `exemptBelow`, `phaseInTo`, `phaseInRatePercent`, `floor`, `ceiling` |
| `contributions`  | Social insurance with its own bands and caps | `bands`, `exemptBelow`, `maximumEarnings`, `maximumContribution`                             |
| `surtaxes`       | A charge on the **tax due**, not on income   | `bands` measured in units of tax                                                             |
| `loanRepayments` | Income-contingent student and study loans    | `selector`, `method`, `threshold`, `ratePercent`, `bands`                                    |

Four of these repay careful reading, because getting them wrong is silent:

**`levies.basis`.** `whole-income` charges the rate on all of income once you
are liable; `above-floor` charges only on the part above `floor`. Australia's
Medicare levy is the first kind. Modelling it as the second understates it at
every income, by an amount that grows with the threshold.

**`levies.phaseInTo` / `phaseInRatePercent`.** The shade-in band between "exempt"
and "fully liable", where a higher rate applies to the excess only. Omitting it
overstates the levy for everyone inside the band.

**`allowances.taperFloorAmount`.** Where the taper stops. The UK personal
allowance tapers to nothing, so this stays `0`. Canada's federal basic personal
amount tapers to a minimum and holds there; leaving this at `0` overstates tax
for high Canadian earners.

**`loanRepayments.method`.** Three shapes, none interchangeable:

| Method                 | Charges                                               | Used by                          |
| ---------------------- | ----------------------------------------------------- | -------------------------------- |
| `rate-above-threshold` | One rate on the income above the threshold            | UK student loans, all plans      |
| `banded-rate-on-total` | The band's rate on the **whole** of income            | Australian HELP to 30 June 2025  |
| `marginal-bands`       | Each band's rate on its own slice above the threshold | Australian HELP from 1 July 2025 |

The last two are the pair most easily confused, and confusing them is silent: at
A$100,000 the difference is thousands of dollars a year. Under
`banded-rate-on-total` one extra dollar at a band edge can cost hundreds — that
is not a bug in the model, it is what the old scale did, and it is asserted in
`tests/unit/student-loans.test.ts`. Under the other two the repayment never
steps.

For `marginal-bands`, the bands are measured **from the threshold**: a band
running 0 to 58,000 means the first 58,000 of income _above_ it, not the first
58,000 of income.

A `selector` on a loan scheme must match the value the form sends:
`plan-1`, `plan-2`, `plan-4`, `plan-5` and `postgraduate` for the UK; `help` for
Australia. A selected scheme with no matching entry produces a visible
unsupported notice, never a silent zero.

**Concurrent loans.** A UK postgraduate loan is repaid _alongside_ an
undergraduate plan, against its own threshold, so the engine takes an array of
selectors rather than one. Any jurisdiction where two schemes can run at once
works the same way.

### 2b. Understand the year table

Each market is **one file holding a table of tax years**, not one file per year.
`src/data/jurisdictions/uk/index.ts` declares a `UkYear` shape and a `UK_YEARS`
array, newest first, and a builder turns each entry into a ruleset. Ireland,
Australia and Canada follow the same pattern.

This matters for three reasons:

- adding next year is a single reviewed entry at the top of an array, not a new
  file to keep in sync;
- a year-on-year diff is readable, so a threshold that moved is obvious and a
  threshold that did not is visibly deliberate;
- anything genuinely shared across years — the source register, the assumption
  list, band structures that have not changed — is written once, so it cannot
  drift between years.

Each entry also carries a `confidence` of `settled`, `likely` or `uncertain`
(see `_years.ts`). That is not decoration: the wording it maps to is rendered on
every page built from that year, so a reader is told how much weight the figures
carry. Set it honestly. A completed year whose rules can no longer change is
`settled`; the newest year, whose thresholds may already have been uprated, is
`uncertain`.

Which year is _current_ is derived from the period dates, never from a flag, so
a year becomes current and stops being current on its own. Nothing needs
touching on 6 April.

### 3. Enter the data

Add or edit an entry in that year table under `src/data/jurisdictions/`. For
each figure:

- put it in the right structure — `incomeTaxBands`, `allowances`, `credits`,
  `levies`, or `contributions` — rather than inventing a shape;
- attach `sourceIds` pointing at the source register entry it came from;
- set `checkedOn` on that source to today's date, in ISO form;
- record the rounding policy the authority actually specifies, in
  `rules.rounding`, including its `note`.

Bands must be contiguous and ascending and the last must be unbounded above. The
audit checks this and will tell you if you have left a gap.

Leave `provenance.dataStatus` and `status` alone for now.

### 4. Write the tests

In `tests/unit/<jurisdiction>.test.ts`:

1. **Golden fixtures** from the authority's own worked examples, wherever they
   publish any. Cite the example in a comment.
2. **Hand-calculated fixtures** with the arithmetic written out in a comment, so
   a reviewer can check your working rather than trusting the total.
3. **Every threshold** tested immediately below, at, and immediately above.
4. **Every allowance, cap, taper, credit, levy floor, and maximum contribution.**
5. **Zero, low, median-like, high, and a very high but supported income.**
6. **Every supported region or province.**
7. **Rounding**, and each pay frequency the market displays.
8. **Property tests** only for invariants that genuinely hold in that
   jurisdiction. Do not assert monotonicity across a system containing a cliff,
   or non-negativity across one with refundable credits.
9. **Every unsupported combination**, asserting that it warns rather than
   returning a figure.

`tests/unit/engine.test.ts` is the model for what a hand-calculated fixture with
its workings looks like.

### 5. Run the gate

```bash
npm run gate
npm run tax:audit -- --strict
```

`--strict` treats an awaiting-source ruleset as a failure, which is what you
want once you believe the jurisdiction is done.

### 6. Review the diff

```bash
npm run manifest:build
git diff src/data/page-manifests/generated/page-manifest.json
```

Read it. It shows exactly which pages your change would make indexable. If a
page appears that you did not expect, find out why before continuing.

### 7. Get it reviewed

Someone other than the person who entered the data compares the ruleset against
the official source, figure by figure. This is the step that catches
transcription errors, and it is the one most worth not skipping.

### 8. Publish

Only now, and only in this order:

```ts
provenance: {
  dataStatus: 'populated',
  checkedOn: '2026-09-03',        // the date you actually read the source
  checkedBy: 'name or handle',
  note: 'Checked against HMRC income tax rates and NI rates pages.',
},
status: 'published',
```

Then run `npm run gate` once more and add a dated entry to the change log in
`src/pages/tax-data-updates.astro`.

The schema will reject `published` if the data is not populated, if there is no
checked-on date, if there are no sources, if no source carries a checked date,
or if there are no income tax bands. You cannot shortcut this by editing one
field.

---

## The annual update

This is the job the year table exists for, and it should take an afternoon of
reading rather than a day of editing.

**What the audit tells you.** It no longer complains that a past year has
expired — past years are kept deliberately, and a shelf of them is the point.
What it errors on is **succession**: the _newest_ year held for a market has
ended and nothing follows it. That is the real staleness risk, and it is the
only one worth failing a build over. `npm run tax:audit` also prints the years
each market currently offers, which is the fastest way to see what is missing.

When a new tax year is announced:

1. **Do not edit last year's entry, and do not delete it.** Add a new entry at
   the top of the year array. Copy the previous entry as a starting point so the
   diff shows only what actually moved.
2. Work through steps 1–8 above for the new period, then set the new entry's
   `confidence` to `uncertain` and demote the previous one from `uncertain` to
   `likely`.
3. Demote any year that has now closed from `likely` to `settled`. A settled
   year, once verified, never needs verifying again — that is the payoff for
   keeping them.
4. **Do not create a new URL.** The tool pages are evergreen:
   `/uk/salary-calculator/` carries every year we hold and lets the reader pick
   one. Creating `/uk/salary-calculator-2027-28/` splits the page's history and
   its links for no benefit, and the year selector already answers the question
   that URL would.
5. Add a dated entry to the change log saying what changed and by how much.

**How far back to go.** A year earns its place by answering a question someone
actually has — checking a payslip, amending a return, comparing an offer against
last year. It does not earn its place by existing. Three years is the current
depth; adding a fourth is a decision, not a default, and adding one whose rules
cannot be modelled honestly is worse than leaving the gap — see **Mid-year
changes** below for where the line sits.

**Retiring a year.** Setting `status: 'retired'` removes it from the selector
while keeping the file for auditability. Do that when a year is wrong and cannot
be fixed — not merely because it is old.

**A year that is not held returns nothing.** `findRuleset` does not fall back to
a neighbouring year when asked for one it does not have, and there is a test
holding that line. Silent substitution would be the worst possible failure here:
a confident answer computed from the wrong year's rules.

---

## Mid-year changes

A rate that changes part-way through a tax year is the hardest case, because
neither the old nor the new figure is right for the year as a whole.

Model the split properly wherever you can: put the effective dates in the
ruleset and write a test for a salary spanning the change. That is always the
better answer.

Where you cannot — because the shape does not exist yet, or because the year is
already closed and nobody will read a split model — **use the closest single
annual figure and say so on the page.** The best available approximation, openly
disclosed, is a better product than refusing to answer, and a much better one
than a figure presented as exact. What is not acceptable is an averaged figure
shipped silently.

So the bar for a mid-year approximation is:

1. The ruleset carries a `note` saying what was approximated and **which way it
   errs** — understated or overstated, and for whom.
2. That note is rendered on every page built from the year, not just recorded in
   the source.
3. `docs/RATE-AMBIGUITIES.md` lists it, so it is visible next to everything else
   that needs checking.

The two live cases both meet that bar:

- **Canada 2025** uses a blended 14.5% lowest federal rate, because the rate was
  cut from 15% to 14% part-way through the year. Right for a full-year salary,
  overstated for income concentrated in the second half.
- **Ireland 2024** uses 4% PRSI for the whole year, when it rose to 4.1%
  part-way through, so PRSI is understated for the final quarter.

Neither blocks marking the year `populated` once its figures have been checked
against the source. The approximation is disclosed, not hidden, and that is the
standard.

---

## When a source disappears

`npm run seo:audit` and the monthly job check that source URLs still resolve.

A dead link means the authority reorganised its site. Find the new page, confirm
the figures are unchanged, and update the URL and its `checkedOn` date. Do not
assume the figures survived the move — check them.

A source that cannot be reached from your environment is reported as
**unchecked**, not broken. Do not record it as dead on that basis.

---

## What to do if you are not sure

Mark it unsupported.

An `unsupported` result explains what is missing and shows the reader the
official source. That is a worse product and a better answer than a number
nobody stands behind. The gate will keep the page out of the index until someone
resolves it, which is the correct outcome.
