# Decision log

Every entry records what was decided, why, and what would change it. Entries are
never rewritten; a superseded decision gets a new entry that references it.

---

## D-001 — Rate tables ship empty, and every tax page is held out of the index

**Date:** 2026-09-03 · **Status:** Active · **Owner:** engineering

**Context.** The build environment's network egress policy blocks every official
tax-authority domain — `gov.uk`, `revenue.ie`, `ato.gov.au`, `ird.govt.nz`,
`canada.ca` — and every third-party tax reference besides. Confirmed on
2026-09-03 by direct HTTPS request and by the fetch tool; only the npm registry
and GitHub are reachable. A web-search tool was available but returns
third-party summaries, which the project's rules exclude as a source of rules.

**Decision.** Build the complete platform, and ship every jurisdiction ruleset
with empty rate tables at `status: 'draft'` and
`dataStatus: 'awaiting-official-source'`.

**Why.** The alternative was to populate the tables from model knowledge or from
search summaries and present the result as sourced. That would have broken the
project's first rule — never invent a rate, threshold, credit, contribution,
formula, source, or check date — and would have shipped confident wrong numbers
about people's pay. A tax calculator that is wrong is worse than one that is
absent, because the reader has no way to tell.

**Consequences, all enforced by code rather than by convention.**

- The engines are complete and fully tested, but refuse to compute from an
  unpopulated ruleset and return an explicit `unsupported` notice instead.
- The Zod ruleset schema rejects `status: 'published'` on a ruleset with no
  populated data, no sources, or no checked-on date. Publishing unsourced
  figures is not a mistake anyone can make by editing one field.
- The indexability gate withholds all 127 affected pages: 102 curated salary
  pages, 20 tax calculator pages, and 5 country hubs.
- `npm run tax:audit` reports every gap on every run; `--strict` makes them
  build failures.

**What would change it.** Network access to the official domains, or a person
working through `docs/TAX-DATA-UPDATE-RUNBOOK.md` on a machine that has it. No
code change is needed: populate `rules`, fill in `sources` with checked-on
dates, flip two status fields, and 127 pages become publishable.

**Alternatives rejected.**

| Option                                            | Why not                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Populate from model knowledge, label "unverified" | A labelled wrong number is still a wrong number, and labels are not read.                |
| Populate from web-search summaries                | Third-party sources are explicitly excluded as a source of rules.                        |
| Stop and deliver nothing                          | Everything except the rate tables was buildable, and none of it is wasted.               |
| Ship engines with no ruleset files at all         | Loses the source register, the tax-period definitions, and the runbook's starting point. |

---

## D-002 — Working brand and placeholder identity

**Date:** 2026-09-03 · **Status:** Active

The owner had not supplied a brand, domain, or contact address. `ClearFigures`,
`https://clearfigures.pages.dev`, and `hello@example-clearfigures.invalid` are
used as placeholders, all resolved from `src/config/site.ts` and overridable by
environment variable. `SITE.isPlaceholder*` flags drive a visible notice on the
pages where the placeholder actually matters (contact, corrections, about).

The indexability audit refuses to allow indexing while `SITE_URL` is still the
placeholder, so a misconfigured production deploy fails the gate rather than
publishing the wrong canonical host.

---

## D-003 — Astro static output, no framework on the client

**Date:** 2026-09-03 · **Status:** Active

Astro 7 in `output: 'static'`, TypeScript strict, plain CSS with design tokens,
and hand-written TypeScript for the calculator form. No UI framework, no
Tailwind, no client-side router.

The measured client bundle is 14.5 KB gzipped against a 60 KB budget, and CSS is
3.3 KB against 30 KB. A framework would have consumed most of that budget to
render a form that native HTML already renders, on a site whose primary content
is a table of numbers.

Trailing slashes are enforced (`trailingSlash: 'always'`) so `/uk/` and `/uk`
can never both be crawlable.

---

## D-004 — TypeScript 5.9 rather than 7.0

**Date:** 2026-09-03 · **Status:** Active

TypeScript 7.0.2 was available. 5.9.3 was chosen because the Astro toolchain,
`typescript-eslint`, and the editor tooling around them have far more exposure
to it. Revisit once `typescript-eslint` ships first-class 7.x support.

Likewise ESLint 9 rather than 10, for `typescript-eslint` compatibility.

---

## D-005 — Decimal money, never floating point

**Date:** 2026-09-03 · **Status:** Active

Every monetary value is a `big.js` decimal from entry to display. Binary
floating point cannot represent 0.1, and a tax calculation performs dozens of
multiplications and divisions across bands, tapers, and caps. A test asserts
directly that `0.1 + 0.2` is exactly `0.3` in this layer and is not in the
native one.

Rounding mode and stage are recorded per jurisdiction in the ruleset, not fixed
in the engine, because authorities differ on both.

---

## D-006 — Marginal rate is measured, not looked up

**Date:** 2026-09-03 · **Status:** Active

The marginal deduction rate is obtained by re-running the whole calculation at
`gross + 100` and comparing total deductions. Reading a headline band rate would
be wrong wherever an allowance taper, a levy floor, or a contribution ceiling
makes the true marginal rate diverge — which is precisely the situation readers
most need explained. A test on the synthetic tapered fixture confirms a measured
75% marginal rate where the headline band rate is 50%.

The same principle drives the bonus and pay-rise tools: both compute the year
twice and take the difference, rather than applying a rate to the increment.

---

## D-007 — Canadian federal and provincial rules are composed, not merged

**Date:** 2026-09-03 · **Status:** Active

One federal ruleset plus one ruleset per province, passed to the engine as
composed layers. Federal figures live in exactly one place, each layer appears
as its own deduction line, and a province can be published independently once
its own tests pass. Quebec carries explicit flags for QPP, QPIP, and the federal
abatement rather than being treated as a variant of the common pattern.

Scotland is modelled the same way — as its own ruleset, not a flag — because
Scottish income tax has a different number of bands, not different numbers in
the same bands.

---

## D-008 — Zod is kept out of the browser bundle

**Date:** 2026-09-03 · **Status:** Active

The first working client build was 47.5 KB gzipped, almost all of it Zod, pulled
in transitively because the analytics adapter derived its allow-lists from the
calculator registry and the jurisdiction adapters imported the ruleset registry
at module scope.

Three changes fixed it, and each is worth keeping on its own merits:

1. `ruleset-helpers.ts` holds the predicates with no runtime dependency, so the
   engine can ask "is this usable?" without importing a validation library.
2. Each jurisdiction has an `options.ts` containing pure profile handling, with
   the registry lookup left in `index.ts`. The browser imports the former.
3. Analytics closed-value sets are generated to a flat literal at build time by
   `scripts/build-page-manifest.ts`.

Rulesets reach the browser as pre-validated JSON embedded in the page. They were
checked by the schema at build time; re-validating them in the reader's browser
would cost a third of the JS budget to re-answer a settled question.

---

## D-009 — Ads disabled, placements reserved

**Date:** 2026-09-03 · **Status:** Active

`ADS_ENABLED` is `false` and no third-party ad script is loaded anywhere. Slots
render as labelled, fixed-size empty boxes so that enabling ads later cannot
introduce layout shift, and so every placement is visible during design review.

`ads.txt` is generated only from a real publisher line, and removed again if
that configuration goes away. A static route was tried first and rejected: it
would have served HTTP 200 with the body "Not found", which is worse than a 404.

Before personalised ads are enabled for UK or EEA visitors, a Google-certified
consent management platform must be configured. No CMP is bundled, and GA4 stays
off entirely rather than defaulting consent to granted.

---

## D-010 — The audit distinguishes an expected gap from a defect

**Date:** 2026-09-03 · **Status:** Active

`npm run tax:audit` classifies findings as `error` or `expected-gap`. The
documented awaiting-source state is reported loudly on every run but exits zero;
anything else fails. `--strict` promotes gaps to errors and is what CI runs once
a jurisdiction is meant to be live.

A pipeline that is permanently red teaches people to ignore it. The danger the
audit guards against — unverified figures reaching the index — is separately and
unconditionally blocked by `check-indexability.ts`, which does fail the build.

---

## D-011 — Accessibility fixes found by automated testing

**Date:** 2026-09-03 · **Status:** Active

Three genuine defects were caught by axe and fixed rather than waived:

- `--ink-subtle` measured 4.04:1 against the accent surface. Darkened to
  `#5c6979`, which measures at least 5.03:1 against every surface in the set.
- `.tool-card--disabled` used `opacity: 0.72`, which dragged its text below the
  contrast threshold. The pending state is now carried by a dashed border and a
  status pill — "not available yet" is exactly the state a reader most needs to
  be able to read.
- Horizontally scrollable tables were not keyboard-reachable. Every scroll
  container is now focusable and named.

---

## D-012 — Deployment is configured but was not performed

**Date:** 2026-09-03 · **Status:** Open — needs the owner

Cloudflare, Vercel, and Netlify are all unreachable from the build environment,
and every one of their CLIs requires an interactive browser login, so no
deployment was made and no staging URL exists. Claiming otherwise would be a
fabrication.

Superseded in part by D-013: the git-integration path removes the need for any
CLI, so this is no longer blocking the owner.

---

## D-013 — Three hosts, one generated configuration

**Date:** 2026-09-03 · **Status:** Active

**Context.** The owner asked whether Vercel or a similar host could be used. All
three candidate hosts are blocked from the build environment, but all three
deploy by pulling from GitHub — so connecting the already-pushed repository in a
dashboard needs nothing from this environment and no CLI login at all. The
egress block turned out not to be the obstacle it appeared to be.

**Decision.** Support Cloudflare Pages, Vercel, and Netlify, and generate all
four config files from a single source at `src/config/hosting.ts`.

**Why generated rather than written three times.** The three hosts read three
formats describing one policy. Three hand-maintained copies of a
Content-Security-Policy is three chances for one to be quietly wrong, and the
failure mode is nasty: a CSP that blocks the calculator script produces a page
that renders perfectly and calculates nothing. `npm run host:check` verifies the
committed files still match, and `tests/integration/hosting.test.ts` runs it, so
hand-editing a generated file fails the build.

**Host recommendation: Cloudflare Pages.** Not for developer experience —
Vercel is better there — but because the business model is display advertising,
which means success looks like a large volume of cheap pageviews. Cloudflare
does not meter bandwidth; Vercel and Netlify both do and bill for overage. A
programmatic SEO site that works is exactly the traffic shape that becomes
expensive on a metered plan.

The choice is reversible: switching host is a dashboard change, not a code
change.

**Detail worth keeping.** `vercel.json` sets `trailingSlash: true` and
`cleanUrls: false` to match Astro's `trailingSlash: 'always'`. Without it Vercel
would resolve both `/uk` and `/uk/`, which is precisely the duplicate-content
problem the URL policy exists to prevent. Cloudflare and Netlify handle this
natively.

---

## D-014 — Full reskin: a calm financial-utility aesthetic in two designed themes

**Date:** 2026-09-03 · **Status:** Active

**Context.** The owner asked for a simple but genuinely well-made aesthetic:
trustworthy and premium, warm off-whites in light and deep charcoal rather than
black in dark, one soft blue accent, crisp slightly editorial typography, large
confident numerical outputs, and no loud fintech styling, gradients,
glassmorphism, or excessive motion.

**Decision.** Rebuilt the token system and stylesheet from scratch around those
constraints, and added a theme toggle.

**Judgements worth recording.**

- **The palette was computed, not chosen by eye.** Every ink/surface pair was
  measured against WCAG AA before it was written. The tertiary ink went through
  two candidates; the first measured 4.24:1 against tinted surfaces.
- **The dark ground is blue-black, not black.** Pure black behind light text
  halates, which matters on a site that is mostly columns of figures.
- **The editorial quality comes from type scale, not a serif.** A first draft
  set lede paragraphs in a system serif. Rendered, it was Times, and it read
  dated rather than considered. Removed in favour of scale, tracking and measure
  on the system sans.
- **The theme script is a file, not an inline script.** The CSP permits
  same-origin scripts only, deliberately, so a pre-paint inline script was not
  an option. `public/theme-init.js` costs 1.1 KB gzipped and removes any flash
  of the wrong theme.
- **The toggle is hidden until its script runs.** A control that cannot work
  without JavaScript should not be offered to a reader who has none.

**Three defects this work surfaced, all fixed.**

1. Renaming the spacing scale left `var(--space-5)` in the ad component. A
   missing custom property does not throw, warn, or fail a build — it silently
   drops the declaration. `tests/integration/design-tokens.test.ts` now fails
   the build on any undeclared property, and also checks both themes define
   every colour, that no dark surface is pure black, and that no token is dead.
2. The itemised breakdown column was hard-coded to "A year". On the mortgage
   calculators those figures are totals over the full term, so the column
   overstated the period by a factor of the term. Column headings are now part
   of the view model.
3. The two-segment chart used adjacent steps of the ramp, which are nearly
   indistinguishable. Segments are now spread across the whole ramp.

**Storage.** The theme name is the only value the site writes, and only on an
explicit choice. Disclosed on `/cookies/` and pinned by two tests: using a
calculator writes nothing, and choosing a theme writes exactly one key holding
exactly one word.

**Verification.** Axe over ten templates in both themes — twenty runs, zero
violations. 164 unit and integration tests, 109 end-to-end tests. CSS 4.7 KB
gzipped against a 30 KB budget; JavaScript 15.7 KB against 60 KB.

---

## D-015 — Four rule shapes added, because data entry alone would not have worked

**Date:** 2026-09-03 · **Status:** Active

**Context.** Asked what it would take to get the calculators live, the obvious
answer was "source and enter the rates". Checking the engine against what the
five markets actually do showed that was wrong: four real rules could not be
expressed by any existing shape, so entering data would have produced confidently
wrong figures rather than correct ones.

**The four gaps, each verified in the code before being fixed.**

1. **Levies were rate-on-income-above-a-floor only.** Australia's Medicare levy
   is a rate on the _whole_ of taxable income once liable, with a shade-in band
   between exempt and fully liable. Setting `floor` to the threshold understates
   it at every income; setting it to zero charges people who are exempt. Neither
   is right. Added `basis`, `exemptBelow`, `phaseInTo`, `phaseInRatePercent`.

2. **Allowance tapers always ended at zero.** Canada's federal basic personal
   amount tapers to a minimum and holds there. Added `taperFloorAmount`,
   defaulting to zero so the UK behaviour is unchanged.

3. **No tax-on-tax construct existed.** Ontario charges surtaxes as a percentage
   of provincial tax above set amounts of _tax_. No income-based shape can
   express that. Added `surtaxes`, applied to the tax due for their own layer
   and itemised as their own deduction line.

4. **Loan repayments were dead code.** `requireScheme` returned the scheme when
   present, and nothing consumed it — so selecting a UK student loan, Australian
   HELP or New Zealand student loan deducted nothing, silently, even with data
   in place. A reader ticking "I have a student loan" and seeing no deduction
   would reasonably conclude they owe nothing. Added `loanRepayments` with two
   methods and `resolveLoanScheme`, which either computes or raises a visible
   notice.

**On the two loan methods.** `rate-above-threshold` charges on the excess (UK,
New Zealand). `banded-rate-on-total` picks a rate from a band and applies it to
the whole of income (Australia), so one extra pound at a band edge can cost
hundreds. They are not interchangeable, and a test pins the step change
specifically so nobody later "simplifies" one into the other.

**Verification.** 25 new tests, including a synthetic ruleset that exercises
every shape at once — tapered allowance with a floor, whole-income levy with a
shade-in, capped contribution, surtax, and loan repayment — with every expected
figure worked longhand in a comment. 189 unit and integration tests and 109
end-to-end tests pass.

**What this changes about going live.** Sourcing and entering the rates is now
genuinely the only remaining work for the tax calculators. Before this, it was
data entry _plus_ four engine changes that would have been discovered
mid-research, most likely after some figures had already been entered against
the wrong shape.

---

## D-016 — Publishing unverified rates, with the warning wired into the build

**Date:** 2026-09-03 · **Status:** Active · **Owner decision**

**Context.** The owner asked for working calculators using whatever rates could
be had, with the ambiguities flagged for correction. They had already been told
twice that the official sources were unreachable. This supersedes the practical
effect of D-001, though not its reasoning.

**Decision.** Populate the rulesets from model knowledge and publish, under a
third provenance state that is honest about where the figures came from.

**What was not done.** The obvious shortcut was to set `dataStatus: 'populated'`
and `checkedOn: '2026-09-03'` and be finished. That would have been a
fabrication — asserting a check that nobody performed — and it is the one thing
this project said it would never do. Instead:

- `dataStatus` gained a third value, `unverified`, between empty and verified;
- the schema **rejects** an unverified ruleset that carries a `checkedOn` date,
  so the assertion cannot be made by accident or in haste;
- the schema rejects `status: 'verified-against-source'` on unverified data;
- an unverified ruleset must carry a note of at least 60 characters explaining
  where its figures came from and what is uncertain;
- source entries keep `checkedOn: null`, and the site renders "not yet checked"
  against each one.

**How the warning is guaranteed to reach the reader.** `DataStatusNotice`
renders **above** the result — an earlier arrangement put it below, which meant
most readers would have seen the figure and never the caveat.
`scripts/check-indexability.ts` reads the built HTML and fails the build if any
page using unverified figures ships without the notice. That check was verified
by removing the marker and watching 117 pages fail.

**What is live.** 135 of 145 pages: the UK including Scotland, Ireland,
Australia, New Zealand, and Canada federal plus Ontario, British Columbia and
Alberta.

**What is held back, and why it is a different reason.** Quebec's ten salary
pages. Not stale data — unmodellable rules. Quebec collects its own provincial
tax, runs QPP instead of CPP, adds QPIP, and reduces federal tax by the Quebec
abatement, and that last is a reduction of _another layer's_ tax, for which the
engine has no construct. Publishing it in the shape used for other provinces
would be wrong by thousands of dollars rather than slightly out of date.

**Deliberate omissions, each declared on-page.** UK student loans and Australian
HELP (thresholds move every year and would have been guesses); the Ontario
Health Premium; New Zealand's Independent Earner Tax Credit; Ireland's tapered
PRSI credit.

**Where the figures were checked.** Every jurisdiction's output was verified by
hand against longhand arithmetic before commit — UK £50,000 to £39,519.60,
Ireland €50,000 to €7,200 tax plus €1,046 USC plus €2,050 PRSI, Australia
$50,000 to $5,270 after the low income tax offset, Ontario $120,000 including a
$1,064.49 surtax. That confirms the _engine_ composes correctly. It says nothing
about whether the input rates are current, which is exactly the gap the notice
describes.

**The correction path.** `docs/RATE-AMBIGUITIES.md` ranks every figure by how
likely it is to be wrong. Correcting one is editing a line of data; when a
jurisdiction is fully checked, setting `dataStatus: 'populated'` with a
`checkedOn` date removes its warning automatically.

---

## D-017 — Each market is a table of tax years, and the reader picks one

**Date:** 2026-09-04 · **Status:** Active · **Owner:** engineering

**Context.** D-016 shipped one ruleset per market: the current year, and only
the current year. Two problems followed. A reader checking an old payslip or
amending a return had nowhere to go. And the annual update was shaped as "copy
the file, edit the copy", which is the shape that lets two years drift apart
silently. Separately, the home page was marking every calculator "not available
yet" because it tested `dataStatus !== 'populated'` — a test that was correct
when the only alternative to populated was empty, and wrong the moment
`unverified` existed.

**Decision.** Restructure each jurisdiction as a **year table**: one file
declaring a year shape and an array of year entries, newest first, with a
builder that turns each entry into a ruleset. Expose the year as a form control
on every salary calculator. Fix the home page to ask whether a ruleset is
_calculable_ rather than whether it is _verified_.

**Why a table rather than a file per year.**

- Adding next year is one reviewed entry at the top of an array. That is the
  smallest possible diff for the job that must happen every April, July,
  January and so on.
- A year-on-year diff is readable. A threshold that moved is obvious, and a
  threshold that did not is visibly deliberate rather than possibly forgotten.
  Three identical UK years is the threshold freeze made legible, and there is a
  test asserting that switching year does not change the rest-of-UK answer, so
  the day the freeze ends, a half-done update fails rather than ships.
- Genuinely shared material — the source register, the assumption list, band
  structures that have not changed, Ontario's surtax thresholds — is written
  once and cannot drift between years.

**What is derived rather than declared.** Which year is _current_ comes from
comparing today against the period's start and end dates, never from a flag
somebody has to remember to move. A year becomes current, and stops being
current, on its own. Nothing needs touching on 6 April.

**Confidence is per year, and it reaches the reader.** Each entry carries
`settled`, `likely` or `uncertain`, mapped in `_years.ts` to wording rendered on
every page built from that year. This is the honest form of the D-016 warning:
"unverified" is true of everything, but a completed year whose rules can no
longer change and the newest year whose thresholds may already have been uprated
do not deserve the same sentence. It also orders the correction work — a settled
year verified once is verified forever.

**A missing year returns nothing.** `findRuleset` does not fall back to a
neighbouring year when asked for one it does not hold. Silent substitution is
the worst available failure here: a confident answer computed from the wrong
year's rules, with a label saying otherwise. New Zealand 2024-25 is the live
case — its thresholds changed on 31 July 2024 and the composite rates for that
split year could not be derived reliably, so the option simply does not exist.

**What the audit checks now.** The per-ruleset expiry check had to go: it
started erroring on seventeen archived years that are past their end date
_on purpose_. It is replaced by a succession check, which errors only when the
**newest** year held for a market has ended with nothing following it. That is
the actual staleness risk. The audit also prints the years each market offers,
so the annual gap is visible in one line rather than inferred.

**No new URLs.** `/uk/salary-calculator/` carries every year we hold and lets
the reader choose. `/uk/salary-calculator-2024-25/` would split the page's
history and its links to answer a question a select element already answers, and
it is exactly the near-identical-page pattern the project forbids.

**Cost.** Twenty-seven rulesets instead of nine, embedded per page for the
client-side recalculation. The heaviest page is Canada, carrying twelve
rulesets; measured, they add 3.7 KB gzipped, and the JS budget holds at 15.5 KB.

**Depth.** Three years per market, except New Zealand at two. A year earns its
place by answering a question someone has, not by existing. A fourth year is a
decision, not a default.

**What would change this.** If a market ever needed genuinely different _rule
shapes_ between years — not different numbers, but a construct one year has and
another does not — the builder-per-market pattern would strain, and that market
would be split into per-year modules behind the same lookup. Nothing in the five
current markets needs that.

---

## D-018 — New Zealand withdrawn rather than shipped with a hole in its year range

**Date:** 2026-09-04 · **Status:** Active · **Owner:** product
**Supersedes:** the New Zealand parts of D-001 and D-016.

**Context.** D-017 gave every market a table of tax years and a selector. New
Zealand could only fill two of the three slots: its income tax thresholds
changed on 31 July 2024, so the 2024-25 year runs on composite rates that could
not be derived reliably. The market shipped with 2026-27 and 2025-26 and a
visible gap where the third year should be.

**Decision.** Remove New Zealand from the site entirely — its rulesets, its
engine, its ten salary pages, its four calculators, its country hub, its
redirect, and the NZD currency option on the global mortgage tools.

**Why.** The owner's standard is that the site should carry only what can be
fully confirmed. A market that cannot be covered consistently across the years
it offers fails that standard in a way a single stale figure does not: the
reader is not looking at a number that might be out of date, they are looking at
a selector that silently cannot answer a question the other four markets can.
Withdrawing is also cheaper than the alternative, which is a per-market
explanation of why one year is missing, repeated on every New Zealand page.

**What was deliberately not done.** No fallback, no "nearest year", no
approximation of the split year. D-017 established that a year we do not hold
returns nothing; the same principle applied one level up says a market we cannot
hold properly is not offered.

**NZD went too.** The mortgage and hourly calculators are currency-agnostic
arithmetic and would have worked fine with a New Zealand dollar option. It was
removed anyway, so that "New Zealand" does not appear anywhere on a site that no
longer covers New Zealand. This is the one part of the removal that is purely a
consistency judgement rather than a correctness one, and it is a two-line
reversal if the owner wants the currency back.

**Effect.** Four markets. 130 pages, 120 indexable, down from 145 and 135.
Twenty-five rulesets, down from twenty-seven. 207 unit and integration tests and
123 e2e tests still pass — nothing tested New Zealand specifically, which is
itself worth noting: the per-jurisdiction suites test rule _shapes_ through
whichever market exercises them, so removing a market removed no coverage.

**What would change this.** Sourcing the 31 July 2024 change properly, either as
a split-year model in the engine or as an officially published composite rate
for 2024-25. New Zealand would then come back as a market that can fill every
year it offers.

---

## D-019 — A disclosed mid-year approximation is acceptable; a silent one is not

**Date:** 2026-09-04 · **Status:** Active · **Owner:** product
**Refines:** the "Mid-year changes" rule in the update runbook.

**Context.** Two years carry a rate that changed part-way through: the Canadian
federal cut from 15% to 14% during 2025, and Irish PRSI rising from 4% to 4.1%
during 2024. The runbook's original rule said do not average, and treated both
as defects blocking publication of those years.

**Decision.** Keep the split model as the preferred answer, but allow a single
annual figure where the split cannot be modelled — provided the approximation is
disclosed on the page, states which way it errs, and is listed in
`docs/RATE-AMBIGUITIES.md`. It no longer blocks marking a year verified.

**Why.** The rule as written would have forced one of two worse outcomes:
refusing to answer for a whole year that most readers can be answered correctly
for, or shipping the approximation quietly to avoid the block. The failure being
guarded against was never averaging as such — it was a reader being given an
approximate figure they believed was exact. Disclosure addresses that directly,
and the site already has the machinery: a ruleset note that renders above the
result, and a build check that fails if it does not.

**The bar.** Three things, all of them: the ruleset note says what was
approximated and who it errs against; that note reaches the page; the case is
listed in the ambiguity register. An approximation meeting none of these is the
thing the original rule was right to forbid.

**Who it errs against, in the two live cases.** Canada 2025 overstates tax for
someone whose income fell in the second half of the year and understates it for
the first half. Ireland 2024 understates PRSI for the final quarter. Both are
correct for a salary held evenly across the year, which is what every figure on
this site already assumes.

---

## D-020 — The calculator is one screen: form beside answer, caveats folded

**Date:** 2026-09-04 · **Status:** Active · **Owner:** design

**Context.** The owner's report: the UK salary page "seems cluttered", the form
and the result should be on one screen, and "multiple warnings and disclaimers…
feels like it's ruining it". Measured on the built page at 1440×900 before any
change: the page was **5,394px tall** and the result began at **y=1,809** — two
full screens below the form. Between the two sat the provenance warning as three
paragraphs, then a separate "what this leaves out" disclosure. After the result
came an ad, an assumptions list, a limitations list, a sources block, and a
second privacy note. Six blocks of caveat around one number.

**Decision.** Four changes, in order of effect.

1. **Two columns above 1040px.** Form on the left, sticky under the header;
   answer on the right. Below that it stacks form-then-answer, which is the
   right order on a phone. The page container widens from 1140px to 1280px to
   make room.
2. **The right-hand ad rail comes off calculator pages.** It was taking 300px of
   the width the two columns needed. The post-result slot stays, so these pages
   keep an ad placement; they lose one. This is the only part of the change that
   costs anything, and it is reversible — the rail returns by restoring
   `withRail` on the three calculator routes.
3. **The provenance warning is compressed, not weakened.** The claim a reader
   must not miss is one sentence and stays at the top of the answer column,
   non-dismissible, with the same `data-provenance="unverified"` marker the
   build checks for. The reasoning behind it moves into a disclosure inside the
   same box. Nothing was deleted.
4. **One caveat block instead of three.** The calculator's assumptions, its
   limitations, and the jurisdiction's exclusions were three overlapping lists;
   they are now one section below the result, folded shut, with the count on the
   summary. The duplicate privacy sentence is gone — the form already says it.

**Measured after.** 5,394px → **2,859px**; result at y=1,809 → **y=491**. The
form and the whole summary table are visible together on a 900px screen.

**A consequence worth naming.** With the two side by side, a calculator opened
with an empty form showed "£0" as its answer, which reads as broken rather than
empty. That zero was always there — it was simply two screens down where nobody
saw it. The result panel now shows a prompt until there is something to
calculate, sized to the space a real answer takes so filling the form in does
not make the page jump.

**Why the warning was compressed rather than moved or softened.** D-016 requires
it to be impossible to miss and impossible to remove by accident. Length is not
what makes a warning read: at three paragraphs it reads as boilerplate and the
eye skips it, which is the failure mode D-016 was written to prevent. One
sentence in an amber box directly above the number is harder to skip than three
paragraphs above the fold. The enforcement is untouched —
`check-indexability.ts` still fails the build on any page carrying unverified
figures without the notice, and the e2e test still asserts its wording.

**Printing.** Folding sections shut created a real risk that a printed result
would lose its own assumptions. The print button opens every `<details>` before
printing and closes them afterwards; a closed `<details>` is hidden by the
browser in a way no print stylesheet can reliably override.

**Verified.** 207 unit and integration tests, 123 e2e tests including axe on
desktop, mobile and no-JavaScript. The design-token test caught a token that
does not exist (`--ink-subtle`, removed during the contrast work in D-011) and
the 320px overflow test caught an unconstrained grid column — both fixed before
this shipped. CSS 4.7 → 5.2 KB gzipped against a 30 KB budget; JS unchanged.

**What would change this.** Ads going live. If the rail turns out to be worth
materially more than the post-result slot, the two columns can move to a 1440px
container with the rail restored above 1400px, at the cost of a third
breakpoint.

---

## D-021 — Mobile first, and the answer is what gets pinned

**Date:** 2026-09-04 · **Status:** Active · **Owner:** design
**Supersedes:** the sticky input column in D-020.

**Context.** The owner: "we have never optimised for mobile… I really would
like to optimise for mobile first, desktop second." That was correct. D-020
fixed the desktop calculator page and left the phone exactly as it was.
Measured on a 390×844 screen before this change:

|                                           | Before                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| First screen spent before the first input | 55% (input at y≈500)                                                      |
| Result on the salary calculator           | y=1,616 — two screens down                                                |
| Header, permanently sticky                | 119px                                                                     |
| Navigation                                | 561px of links in a 358px strip; two of five unreachable, nothing said so |
| Tap targets under 44px, home page         | 27                                                                        |
| Result tables                             | horizontal scroll                                                         |

**Decision.** Six changes, each measured.

1. **Unpin the header, pin the answer.** Nothing in the header is sticky on a
   phone any more; scrolling up for navigation is a gesture people already
   have. In its place `ResultBar.astro` fixes the headline figure to the bottom
   of the screen from the moment there is one, and doubles as the jump to the
   full breakdown.
2. **Recalculate as the form is edited**, debounced 250ms for typing and
   immediate for selects. This is the change most likely to affect how long
   anyone stays: adjusting a salary and watching the figure move is a thing
   people do repeatedly; tapping Calculate and scrolling two screens is a thing
   people do once.
3. **Stack two-column tables** rather than scrolling them sideways.
4. **Halve the chrome above the first input** — smaller title, two-line
   description, no "Your details" heading, tighter header.
5. **44px tap targets** on navigation and footer links; 24px, the AA minimum,
   on breadcrumbs.
6. **Selects shrink to fit; text inputs never do.** Below 16px iOS Safari zooms
   on focus and does not zoom back, so inputs hold at 17px. Selects have no
   such behaviour, so they take the smaller size rather than cut "England,
   Wales & Northern Ireland" mid-word.

**Measured after:** first input at 415px, under half a screen; the answer
visible while typing with no scroll at all; 119px of sticky header replaced by
a 72px bar carrying the figure; tap targets under 44px down from 27 to one
inline prose link, which the AA rule exempts.

**A quiet recalculation is not a submission.** It must not report a validation
error against a figure one keystroke old, must not fill the back button with
half-typed salaries, and must not count as a completed calculation in
analytics. Pressing the button still does all three. Both halves are asserted.

**What this cost.** The sticky input column from D-020 is gone. The salary form
is ~830px tall — more than most laptop viewports — so a sticky column could
never be scrolled to its own end, and its Calculate button sat permanently
below the fold. It also raced: the e2e suite caught clicks landing on a moving
target. Side by side already achieves what stickiness was reaching for. That
D-020 called it "sticky, so they stay put while the breakdown is read" was
right about the goal and wrong about the mechanism.

**Two mistakes the tests caught before this shipped.** Stacking every
`table.data` rather than only two-column ones turned the all-calculators page
from 10,583px to 17,127px — hence the `data--pairs` class. And the first draft
of the "half a screen" test failed against my own layout, which is what forced
the chrome above the fold down rather than leaving it at "better than it was".

**Not done, deliberately.** No bottom tab bar: it would compete with the result
bar for the one piece of pinned space a phone has, and the site's navigation is
shallow enough that a scroll strip covers it. No autofocus on the salary field:
opening a page by throwing up a keyboard is hostile.

**What would change this.** Real analytics. Every claim above about behaviour —
that people adjust more when the figure moves live, that the bar is used to
reach the breakdown — is reasoned, not observed. `result_bar_opened` is
instrumented so the second one, at least, becomes a fact rather than an
argument.

---

## D-022 — Student loans are calculated, because withholding them was the inconsistency

**Date:** 2026-09-04 · **Status:** Active · **Owner:** engineering
**Supersedes:** the student-loan and HELP exclusions in D-016.

**Context.** The owner: "Why haven't you calculated the student loan
contributions for each plan? That's fundamental for the UK." Correct, and the
reasoning that led there does not survive inspection.

D-001 blocked every rate because no official source was reachable. D-016 then
published income tax bands, National Insurance rates, Medicare thresholds, CPP
ceilings and provincial brackets — all entered from general knowledge and
labelled unverified. Student loan thresholds were held back on the grounds that
they "change every April and could not be sourced". So does the personal
allowance. So do the Medicare thresholds. The same rule was applied to one kind
of figure and not another, and the effect was not caution: it was a take-home
figure overstated by up to £2,250 a year for the roughly one in four UK earners
repaying a student loan, with the shortfall explained in a sentence most readers
would never open.

The engine has supported `loanRepayments` since D-015. The tables were simply
empty.

**Decision.** Populate them, to the same standard and with the same labelling as
every other figure on the site.

- **UK:** Plans 1, 2, 4 and 5 at 9% above their own thresholds, and the
  postgraduate loan at 6% above its own, across all three years.
- **Australia:** HELP across all three years.
- **Ireland and Canada:** nothing, because neither withholds student loan
  repayments through payroll. That is a fact about those systems, not a gap.

**Two things this exposed that were more than data entry.**

_A postgraduate loan is charged on top of an undergraduate plan, not instead of
one._ The form offered both in a single select, which forced a choice that does
not exist and understated take-home pay for everyone holding both — a common
combination. It is now a plan select plus a separate tick. The engine already
took an array of selectors, so only the form and the profile mapping changed.

_Australia changed the shape of HELP, not just its numbers._ Until 30 June 2025
a rate was read from a nineteen-band table and applied to the **whole** of
income, so one extra dollar at a band edge could cost hundreds. From 1 July 2025
it is marginal above a threshold. No existing method could express the second
without approximating, and approximating here is worth thousands of dollars a
year at A$100,000, so `marginal-bands` was added to the schema and the engine
alongside the two that existed. Both eras are modelled as they actually worked;
the method is stored per year, because that is what changed.

**Confidence.** UK thresholds: medium, and the 2026/27 set is carried forward
unchanged so it is the first thing to check. Australian HELP: **the least
certain figures on the site**, because the risk is structural — if the marginal
system did not take effect on 1 July 2025, two years are wrong by thousands
rather than slightly. Both are in `docs/RATE-AMBIGUITIES.md`, and HELP is now
row 5 of the correct-these-first table.

**What is asserted rather than assumed.** `tests/unit/student-loans.test.ts`
carries 16 tests with the arithmetic written out longhand: every plan at
£50,000, the threshold edge (£1 above Plan 2's threshold repays 9p), concurrent
undergraduate and postgraduate repayment, the year-on-year threshold move, Plan
4 working in both UK regions, and — the important one — the three methods given
the same income, the same threshold and the same rates producing three
different answers. That last test exists so nobody can quietly swap one for
another.

**What is still not modelled.** UK repayments are annualised like National
Insurance, so a mid-year salary change gives a different real total, and a loan
cleared part-way through the year keeps being deducted. Australian repayments
are calculated on salary alone, where the ATO uses repayment income — which adds
back reportable fringe benefits, super contributions and investment losses — so
a real repayment can be higher. Both are stated on the page.

**The general lesson.** "I could not source it" was true of every figure on this
site. Once the owner decided that unverified-and-labelled beats absent, that
decision applied to all of it. Applying it selectively produced the worst
outcome available: a number that looks complete and is not.
