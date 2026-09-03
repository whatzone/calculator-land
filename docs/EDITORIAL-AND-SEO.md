# Editorial and SEO

## The principle

A page exists because someone needs it, not because a URL could exist. Every
indexable page must run a real calculation, answer a distinct question, expose
its assumptions, and say something specific to its own subject.

This is not a stylistic preference. Thin programmatic pages are the failure mode
of exactly this kind of site, and the way they fail is slow: they rank briefly,
attract no engagement, and drag down the pages that deserved to rank.

## What we do not build

- Near-identical pages made by swapping a city, region, currency, or word.
- Every salary between two numbers. The list is curated and reviewed.
- Comparison pages generated combinatorially from a list of places.
- Pages whose only content is a calculator with generated prose around it.
- Crawlable search results, tag archives, or filter permutations.

Query parameters are for sharing a result. They canonicalise to the tool page
and never become indexable URLs — `robots.txt` disallows `/*?` and every page's
canonical link points at the clean path.

## URL policy

Readable, permanent, no year in the path:

```
/uk/salary-calculator/
/uk/salary/50000-after-tax/
/uk/scotland/salary/50000-after-tax/
/canada/ontario/salary/100000-after-tax/
/mortgage-calculators/overpayment/
```

**A tax year change never creates a new URL.** The tool page is evergreen and
shows whichever period is current. Splitting `/uk/salary-calculator-2027-28/`
off would fragment the page's links and history for no reader benefit. Prior-year
calculators are added only where they answer a real query _and_ the prior engine
is retained and tested.

Trailing slashes are enforced, so there is no `/uk` and `/uk/` duplicate pair.

## Titles and descriptions

Generated from the registry and the manifest, so they cannot drift from the
page. Patterns:

- `£50,000 After Tax in Scotland (2026/27) | ClearFigures`
- `UK Salary Calculator 2026/27 | ClearFigures`
- `Mortgage Overpayment Calculator | ClearFigures`

Uniqueness of both title and meta description is asserted by an integration test
across the whole manifest, not checked by eye.

## Structured data

`Organization`, `WebSite`, and `BreadcrumbList` on every page. `WebApplication`
only where a calculator genuinely runs on that page — which, while a
jurisdiction is unsourced, means the global tools only.

No review ratings, no aggregate scores, no invented authors, no FAQ markup for
answers that are not fully visible on the page. Marking up something we do not
have is a fabrication, whatever it might do for a rich result.

## What makes a salary page indexable

It must carry, generated from the calculation rather than written around it:

- the prefilled calculator and a static result in the HTML;
- gross and net annual, monthly, and weekly pay;
- the itemised deduction table;
- average and marginal deduction rates;
- how much of the next locally sensible increment is kept;
- which thresholds this income has crossed and which is next, with the distance;
- the default-profile assumptions and the limitations;
- direct official sources and the date they were checked;
- links to the full calculator, neighbouring amounts, methodology, and the
  country hub.

If a page cannot produce those, it is not published. Right now none can, because
the rate tables are empty — which is the system working as designed.

## The curated amount list

`src/data/salary-amounts.ts` holds every programmatic salary page the site will
build: 102 across five markets, including a full Scottish set and four Canadian
provinces. It is a typed literal, so adding one is an explicit reviewed change.

To add an amount you need Search Console evidence of distinct demand at that
figure — impressions for that specific number, not a hunch that round numbers
are popular.

## Expansion scoring

Score a proposed page family 1–5 on each. A written decision is required before
adding more than 25 indexable URLs in one batch.

| Criterion                         | 1                           | 5                                     |
| --------------------------------- | --------------------------- | ------------------------------------- |
| Demonstrated search demand        | No evidence                 | Strong Search Console impressions     |
| Ad value potential                | Very low CPC                | High commercial intent                |
| Distinct user value               | Duplicates an existing page | Answers something nothing else does   |
| Strength of official sources      | No authoritative source     | Clear, stable, official publication   |
| Implementation complexity         | Months of work              | Fits the existing engine              |
| Annual maintenance burden         | Changes constantly          | Rarely changes                        |
| Risk of materially wrong guidance | Could mislead badly         | Low stakes if slightly off            |
| Likelihood of thin content        | Would be near-duplicate     | Substantially unique                  |
| Internal link fit                 | Orphaned                    | Sits naturally in an existing journey |

Two rules of thumb: a total below 27 means improve existing pages instead; any
single score of 1 on sources or on wrong-guidance risk is disqualifying
regardless of the total.

## Internal linking

Links follow the journey a reader is actually on: from a salary page to
neighbouring amounts, to the full calculator, to methodology, to sources. Not a
block of every amount on the site.

`neighbouringAmounts()` returns a small window either side of the current
figure, because "what about a bit more" is the real next question.

## Link building

Genuine only. Useful embeddable citations, journalist resources, transparent
datasets, and country update reports. No paid links, no exchanges, no automated
outreach. A financial site's credibility is its entire product, and buying links
trades that for traffic that does not convert.

## hreflang

Not used, and deliberately so. Five English-language editions for five countries
are not an `hreflang` cluster, and marking them as one tells search engines
something untrue about the relationship between the pages.

When a genuine translated edition exists, implement valid reciprocal clusters
including `x-default`. Not before.

## Sitemaps

Split by family — pages, calculators, salary — from the start, so growth needs
no restructuring and a family can be diagnosed on its own in Search Console.

`lastmod` reflects the date a ruleset was checked or the content changed, never
the deployment time. Telling search engines that 145 pages changed because
someone fixed a typo in a footer is how a site teaches them to ignore its
sitemap.
