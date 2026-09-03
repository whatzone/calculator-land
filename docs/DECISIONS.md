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

`api.cloudflare.com` is unreachable from the build environment and Wrangler
authentication requires an interactive browser login, so no deployment was made
and no staging URL exists. Claiming otherwise would be a fabrication.

What is committed: `wrangler.toml`, `public/_headers` with a reviewed CSP,
`public/_redirects`, and a GitHub Actions workflow that deploys on a green gate.
`docs/DEPLOYMENT.md` gives the exact commands. The owner needs to run
`npx wrangler login` once, or add `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` as repository secrets.
