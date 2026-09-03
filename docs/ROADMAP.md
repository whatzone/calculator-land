# Roadmap

Each phase has a gate. A phase does not start because the previous one shipped;
it starts because its gate is met.

---

## Phase 0 — Where things actually stand

**Complete.** The platform is built, tested, and buildable. 146 pages generate,
18 pass the quality gate, 147 unit and integration tests and 85 end-to-end tests
pass, and the client bundle is 14.5 KB gzipped.

**Blocked.** Every tax rate table is empty. The build environment could not
reach any tax authority, and populating the tables from anything other than an
official source is prohibited. See D-001.

**Live today:** the mortgage payment, mortgage overpayment, and hourly-to-salary
calculators, plus the trust and legal pages — 18 indexable pages.

**Held back:** 127 pages, comprising 102 curated salary pages, 20 tax calculator
pages, and 5 country hubs.

**The single unblocking action:** work through
`docs/TAX-DATA-UPDATE-RUNBOOK.md` on a machine with access to the tax authority
websites. No code change is required.

---

## Phase 1 — Five markets live

**Gate to start:** access to the official sources.

- Source and publish all five jurisdictions, one at a time. Do not batch them —
  each needs its own review, and a reviewer who has just checked four countries
  is not checking the fifth carefully.
- Publish only what passes the gate. Resist the urge to relax it for one
  awkward figure.
- Verify analytics collects no financial input, on the live site.
- Set up Search Console and submit the sitemap once the domain is verified.
- Keep ads disabled. A site with no traffic history and no consent platform has
  nothing to monetise and everything to lose from a policy problem.

**Exit criteria**

| Measure                          | Target                                         |
| -------------------------------- | ---------------------------------------------- |
| Indexable pages                  | 130–145                                        |
| Jurisdictions published          | 5                                              |
| Golden fixtures per jurisdiction | ≥ 3 from official worked examples              |
| Release gate                     | Green, including `tax:audit --strict`          |
| Search Console                   | Verified, sitemap submitted                    |
| Lighthouse (lab)                 | ≥ 95 performance, ≥ 95 accessibility, ≥ 95 SEO |

---

## Phase 2 — Evidence-led depth

**Gate to start:** 6–10 weeks of Search Console data, or supplied external
keyword evidence. Not sooner. Acting on three weeks of data means acting on
noise.

- Add salary amounts only where impressions show distinct demand for that
  specific figure.
- Add Canadian provinces beyond the initial four only once their engine tests
  pass _and_ demand or strategic value is shown.
- Add prior-year calculators only where a real query exists and the prior engine
  stays tested.
- Improve pages with poor CTR by fixing the intent mismatch, not by lengthening
  the copy. The query-intent view in `docs/MEASUREMENT.md` is built for exactly
  this.
- Pursue links through genuinely useful artefacts: embeddable calculation
  citations, a journalist resource, transparent datasets, country update
  reports.

**Exit criteria:** organic clicks growing month on month; index coverage above
90% of submitted pages; calculator completion rate above 60%; at least five
earned referring domains.

---

## Phase 3 — More countries

**Gate to start:** phase 2 exit criteria met, and demonstrated capacity to
maintain what already exists through one full annual update cycle.

Evaluation order, each scored against `docs/EDITORIAL-AND-SEO.md`:

1. **United States** — only with a tested federal/state architecture and an
   explicit decision on local taxes. Half a US calculator is worse than none.
2. **Singapore** — clean sources, contained rules.
3. **South Africa** — good source availability.
4. **United Arab Emirates** — employment and payroll rules. A page saying
   "there is no personal income tax" is not a calculator and must not be
   published as one.
5. **Germany**, 6. **Netherlands**, 7. **France** — gated on local-language
   content and social-contribution expertise, not on engineering capacity.
   Machine-translating the English templates is explicitly excluded.

Every country passes `docs/COUNTRY-ONBOARDING.md` in full.

---

## Phase 4 — High-value finance

**Gate to start:** phase 3 under way and the existing set maintained through an
annual update without slipping.

- Country-specific mortgage affordability, only where lender conventions can be
  described accurately rather than approximated.
- Property purchase taxes: stamp duty, land transfer tax, and equivalents.
- Remortgage comparison, extending the existing overpayment engine.
- Self-employed and contractor take-home pay.
- Employer total-cost calculators.
- Pension contribution and salary-sacrifice scenarios.
- Cross-country salary comparison, with an explicit exchange-rate date and
  source, and cost-of-living kept strictly separate from tax.

Each family needs a shared engine, source provenance, tests, and a finite
curated index. No combinatorial page generator, in any phase, for any reason.

---

## What would make this fail

Worth writing down while it is still avoidable.

1. **Publishing unsourced figures under deadline pressure.** The gate exists to
   make this hard. Do not add an override.
2. **Scaling page count ahead of demand.** 102 curated salary pages that each
   say something specific will outperform 10,000 that do not, and will not take
   the site down with them.
3. **Letting rulesets expire.** The audit warns at 60 days and the monthly job
   raises an issue. An expired ruleset silently serving last year's rates is the
   most damaging failure available to this product.
4. **Enabling ads before consent infrastructure.** A policy suspension is
   recoverable; a regulator is not.
5. **Adding countries faster than they can be maintained.** Five accurate
   markets beat twelve stale ones, and staleness is invisible until someone is
   harmed by it.
