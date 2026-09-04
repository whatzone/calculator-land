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
