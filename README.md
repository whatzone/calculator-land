# ClearFigures

Transparent salary, tax, and mortgage calculators. Every deduction itemised,
every rule linked to the authority that publishes it, and every assumption shown
next to the result rather than buried in a legal page.

> **Read this first.** The tax rates on this site have **not been checked
> against the authorities that publish them**. They were entered from general
> knowledge because the official websites were unreachable from the build
> environment. The calculations are tested and sound; the specific figures may
> be out of date.
>
> This is a deliberate, owner-approved state, and it is enforced rather than
> assumed: no ruleset can claim a check that did not happen, every affected page
> renders a provenance notice above its result, and the build fails if one does
> not. `docs/RATE-AMBIGUITIES.md` lists what is least certain, in the order it
> should be corrected. `docs/DECISIONS.md` (D-016) records the reasoning.

## Quick start

```bash
npm ci
npm run dev          # http://localhost:4321
npm run gate         # the full release gate
```

## What works today

Every calculator is live in every market except Quebec: salary, net-to-gross,
bonus and pay rise across the UK (including Scotland), Ireland, Australia and
Canada (federal plus Ontario, British Columbia and Alberta), and the mortgage
and hourly tools everywhere. 120 of 130 pages are indexable.

Each salary calculator offers a choice of **tax year** — three per market — and
recalculates against the year you pick.

**Every rate on the site is unverified.** The figures were entered from general
knowledge, not read from the authority that publishes them, because the build
environment cannot reach any official tax domain. That is not a caveat buried in
a footer: each affected page renders a notice above its result, and the build
fails if one ships without it. `docs/RATE-AMBIGUITIES.md` ranks every figure by
how likely it is to be wrong, so the corrections can be made in priority order.

**Quebec is held back for a different reason** — not stale data, but rules the
engine cannot yet express. Its ten salary pages are withheld from the index.

## Commands

| Command                       | What it does                                                      |
| ----------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                 | Development server                                                |
| `npm run build`               | Manifest, build, then the indexability and link audits            |
| `npm run gate`                | Format, lint, typecheck, test, tax audit, build                   |
| `npm run test`                | Unit and integration tests (207)                                  |
| `npm run test:e2e`            | Playwright: desktop, mobile, no-JavaScript, axe (123)             |
| `npm run tax:audit`           | Years offered, sources, succession. `-- --strict` to fail on gaps |
| `npm run seo:audit`           | Indexability and internal links, against the built output         |
| `npm run create:calculator`   | Scaffold a calculator                                             |
| `npm run create:jurisdiction` | Scaffold a jurisdiction                                           |

## Architecture in one paragraph

Rules live as versioned data with their provenance. A pure decimal engine turns
them into itemised results. A calculator registry is the single source of truth
for routes, fields, metadata, structured data, analytics, and sitemaps. A
build-time page manifest decides what may be indexed and records why anything is
withheld. Templates read all of it and contain no business logic.

Full detail: `docs/ARCHITECTURE.md`.

## Supported markets

| Market         | Tax years offered         | Regions                                        | State           |
| -------------- | ------------------------- | ---------------------------------------------- | --------------- |
| United Kingdom | 2026/27, 2025/26, 2024/25 | England/Wales/NI, Scotland (separate rulesets) | Unverified      |
| Ireland        | 2026, 2025, 2024          | —                                              | Unverified      |
| Australia      | 2026-27, 2025-26, 2024-25 | —                                              | Unverified      |
| Canada         | 2026, 2025, 2024          | Federal + Ontario, BC, Alberta                 | Unverified      |
| Canada, Quebec | —                         | —                                              | Awaiting source |

Scotland and Quebec are modelled as their own rulesets rather than as flags,
because their rules differ in structure and not only in numbers.

Each market is one file holding a **table of tax years**, so adding next year is
a single reviewed entry at the top of an array rather than a new file to keep in
sync. Which year is current is derived from the period dates, not from a flag. A
request for a year we do not hold returns nothing rather than falling back to a
neighbouring year's rates. `npm run tax:audit` prints the current coverage.

New Zealand was launched and then withdrawn: its income tax thresholds changed
part-way through 2024-25, which left a year that could not be modelled honestly
as a single rate set, and a market we cannot cover consistently is better absent
than partial. See D-018.

## Budgets, measured

|                                     | Budget | Actual  |
| ----------------------------------- | ------ | ------- |
| Calculator client bundle, gzipped   | 60 KB  | 15.3 KB |
| First-party CSS, gzipped            | 30 KB  | 5.2 KB  |
| Render-blocking third-party scripts | 0      | 0       |
| Automated accessibility violations  | 0      | 0       |

## Privacy

Calculator inputs never leave the browser. The analytics adapter drops any
property outside its allow-list, validates closed-set values against sets
generated from our own registries, and is tested by watching the network while a
figure is entered. No cookies are set. No ad script is loaded.

## Documentation

|                                   |                                          |
| --------------------------------- | ---------------------------------------- |
| `docs/ARCHITECTURE.md`            | How the system is put together           |
| `docs/CALCULATION-METHODOLOGY.md` | The engine, for whoever maintains it     |
| `docs/TAX-DATA-UPDATE-RUNBOOK.md` | **How to bring a jurisdiction live**     |
| `docs/COUNTRY-ONBOARDING.md`      | The checklist a new country must pass    |
| `docs/ADDING-A-CALCULATOR.md`     | The calculator workflow                  |
| `docs/DEPLOYMENT.md`              | Cloudflare Pages, rollback, headers, ads |
| `docs/MEASUREMENT.md`             | Events, properties, KPIs, dashboards     |
| `docs/EDITORIAL-AND-SEO.md`       | What gets published, and what does not   |
| `docs/ROADMAP.md`                 | Phases, gates, and how this could fail   |
| `docs/DECISIONS.md`               | Every decision, with its reasoning       |

## Deployment

Not deployed from here — the build environment blocks outbound access to every
host, and each CLI needs an interactive login. **That does not block you:**
Cloudflare Pages, Vercel, and Netlify all deploy by pulling from GitHub, and the
code is pushed. Connect the repository in a host dashboard and it builds; no CLI
and no token pasted anywhere.

Config for all three is committed and generated from one source
(`src/config/hosting.ts` → `_headers`, `_redirects`, `vercel.json`,
`netlify.toml`), so switching host is a dashboard change rather than a code
change. A test fails the build if the generated files drift apart.

Cloudflare Pages is the recommendation, for one reason: this site is funded by
display advertising, so success means a large volume of cheap pageviews.
Cloudflare does not meter bandwidth; the other two do. See `docs/DEPLOYMENT.md`.

## Licence and status

Private, pre-launch. The brand, domain, and contact address are placeholders
resolved from `src/config/site.ts`. No tax professional has reviewed this site.
