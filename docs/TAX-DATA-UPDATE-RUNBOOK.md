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

| Jurisdiction   | Authority                     | What you need                                                                                                                                                                 |
| -------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| United Kingdom | HMRC (gov.uk)                 | Income tax rates and personal allowance, the allowance taper, National Insurance class 1 employee rates and thresholds, student loan plan thresholds and rates                |
| Scotland       | Scottish Government / HMRC    | Scottish income tax bands and rates. NI is UK-wide — do not re-source it                                                                                                      |
| Ireland        | Revenue; gov.ie for PRSI      | Income tax bands, personal and employee tax credits, USC bands, PRSI class A                                                                                                  |
| Australia      | ATO                           | Resident income tax rates, Medicare levy rate and thresholds, applicable offsets, study and training loan repayment rates                                                     |
| New Zealand    | Inland Revenue                | Individual income tax rates, ACC earners' levy rate and maximum liable earnings, KiwiSaver rates, student loan repayment rate and threshold                                   |
| Canada         | CRA; Revenu Québec for Quebec | Federal rates and basic personal amount, provincial rates and credits, CPP/QPP rates and maximums, EI/QPIP rates and maximums, and publication T4127 for the payroll formulas |

The candidate URLs already recorded in each ruleset file are a starting point,
not an answer. Every one carries `checkedOn: null`, which means nobody has
confirmed it. Confirm it, or replace it.

### 2. Confirm the tax period

Check you are looking at the **current, legally effective** period, not one
that has been announced but has not started. An announced future period may be
stored as a separate ruleset with its own effective dates; it must not be
published as current.

The period boundaries themselves (UK 6 April to 5 April, Australia 1 July to
30 June, New Zealand 1 April to 31 March, Ireland and Canada calendar years) are
structural and already encoded.

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

**`loanRepayments.method`.** `rate-above-threshold` charges a rate on the excess
(UK, New Zealand). `banded-rate-on-total` picks a rate from a band and applies
it to the _whole_ of income (Australia), so one extra pound of income at a band
edge can cost hundreds. These are not interchangeable and must not be
substituted for each other.

A `selector` on a loan scheme must match the value the form sends:
`plan-1`, `plan-2`, `plan-4`, `plan-5`, `postgraduate` for the UK; `help` for
Australia; `student-loan` for New Zealand. A selected scheme with no matching
entry produces a visible unsupported notice, never a silent zero.

### 3. Enter the data

Edit the jurisdiction file under `src/data/jurisdictions/`. For each figure:

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

Each ruleset carries an `expiresOn` date. The audit warns 60 days before it and
errors after it, and the monthly CI job raises an issue.

When a new tax year is announced:

1. **Do not edit the current ruleset.** Copy it to a new file for the new
   period, so the old rules stay available for auditability.
2. Work through steps 1–8 above for the new period.
3. Set the previous ruleset's `status` to `'retired'`. Keep the file.
4. Update the URL-facing period label. **Do not create a new URL.** The tool
   pages are evergreen: `/uk/salary-calculator/` shows whichever period is
   current. Creating `/uk/salary-calculator-2027-28/` splits the page's history
   and its links for no benefit.
5. Add a dated entry to the change log saying what changed and by how much.

Prior-year calculators are added only when they answer a real question and the
prior engine is retained and tested — not by default.

---

## Mid-year changes

A rate that changes part-way through a tax year is the hardest case, because
neither the old nor the new figure is right for the year as a whole.

Do not average them. Either model the split properly, with the effective dates
in the ruleset and tests for a salary spanning the change, or mark the affected
calculation unsupported until you can. An averaged figure is wrong for everyone.

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
