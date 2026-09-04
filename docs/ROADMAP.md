# Roadmap

Each phase has a gate. A phase does not start because the previous one shipped;
it starts because its gate is met.

---

## Phase 0 — Where things actually stand

**Complete.** The platform is built, tested, and buildable. 130 pages generate,
120 pass the quality gate, 207 unit and integration tests and 123 end-to-end
tests pass, and the client bundle is 15.3 KB gzipped.

**Live today, with unverified figures:** every calculator in four markets — the
UK including Scotland, Ireland, Australia, and Canada federal plus Ontario,
British Columbia and Alberta — each offering a choice of three tax years, plus
the mortgage and hourly tools and the trust and legal pages. 120 indexable
pages: 92 curated salary pages, 16 tax calculator pages, 4 country hubs, and the
global and editorial set.

**Still unsourced.** No figure on the site has been read from the authority that
publishes it, because the build environment cannot reach one. Every affected
page says so above its result, and the build fails if one does not. See D-001
for the block and D-016 for the decision to publish anyway, honestly labelled.

**Held back:** Quebec's 10 salary pages, for a structural reason rather than a
data one — the Quebec abatement reduces another layer's tax and the engine has
no construct for it.

**Withdrawn:** New Zealand, whose thresholds changed part-way through 2024-25,
leaving a year that could not be modelled honestly. See D-018.

**The single unblocking action:** work through
`docs/TAX-DATA-UPDATE-RUNBOOK.md` on a machine with access to the tax authority
websites, correcting in the order set out in `docs/RATE-AMBIGUITIES.md`. No code
change is required.

---

## Phase 1 — Four markets verified

**Gate to start:** access to the official sources.

- Source and verify all four jurisdictions, one at a time. Do not batch them —
  each needs its own review, and a reviewer who has just checked three countries
  is not checking the fourth carefully.
- Within a jurisdiction, verify the settled years first. A completed tax year
  verified once is verified forever; the current year has to be revisited every
  time an authority uprates something.
- Publish only what passes the gate. Resist the urge to relax it for one
  awkward figure.
- Verify analytics collects no financial input, on the live site.
- Set up Search Console and submit the sitemap once the domain is verified.
- Keep ads disabled. A site with no traffic history and no consent platform has
  nothing to monetise and everything to lose from a policy problem.

**Exit criteria**

| Measure                          | Target                                         |
| -------------------------------- | ---------------------------------------------- |
| Indexable pages                  | 115–130                                        |
| Jurisdictions verified           | 4                                              |
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
2. **Scaling page count ahead of demand.** 92 curated salary pages that each
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
