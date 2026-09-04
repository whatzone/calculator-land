# Rate ambiguities — the correction list

Every figure on this site was entered from general knowledge. **None of it has
been read from the authority that publishes it.** This file lists what I am
least sure about, so the corrections can be made in priority order rather than
by re-checking everything blind.

Confidence below is my own estimate of whether a figure is right, not a
statement of fact. Treat **every** row as needing verification; the ordering
just says where to start.

How to correct one: edit the year's entry in the table under
`src/data/jurisdictions/`, set the source's `checkedOn`, and follow
`docs/TAX-DATA-UPDATE-RUNBOOK.md`. When a whole jurisdiction has been checked,
set `provenance.dataStatus` to `populated`, add `checkedOn` and `checkedBy`, and
the health warning disappears from its pages automatically.

---

## Which years are offered

Each market is a table of tax years, and the calculator has a year selector.
`npm run tax:audit` prints this list, so it is always current in the terminal
even if this file falls behind.

| Market                      | Years offered             | Oldest year omitted because |
| --------------------------- | ------------------------- | --------------------------- |
| UK (England, Wales, NI)     | 2026/27, 2025/26, 2024/25 | —                           |
| UK (Scotland)               | 2026/27, 2025/26, 2024/25 | —                           |
| Ireland                     | 2026, 2025, 2024          | —                           |
| Australia                   | 2026-27, 2025-26, 2024-25 | —                           |
| Canada (federal + ON/BC/AB) | 2026, 2025, 2024          | —                           |
| Canada (Quebec)             | not published             | See the Quebec note below.  |

Every year carries one of three confidence levels, and the level is written into
the ruleset itself so it reaches the reader:

- **settled** — a completed tax year. The rules are fixed and can no longer
  change, so once checked they never need checking again. Still unverified.
- **likely** — a recent year whose rules are unlikely to have moved since.
- **uncertain** — the newest year. Thresholds are usually indexed at the start
  of a tax year, so these are the least certain figures on the site.

**Correct the settled years first.** They are the cheapest to fix permanently:
a completed year verified once is verified forever, whereas the newest year has
to be revisited each time an authority uprates something.

---

## Start here: the five most likely to be wrong

All are in the **newest** year of their market.

| #   | Figure                                             | Where                | Why it is doubtful                                                                                                                                                                                           |
| --- | -------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Ireland 2026 — standard rate band (€44,000)**    | `ireland/index.ts`   | Carried forward from 2025 unchanged. Ireland moves this most Budgets, so if Budget 2026 raised it, every 2026 Irish result is wrong.                                                                         |
| 2   | **Ireland 2026 — PRSI rate (4.1%)**                | `ireland/index.ts`   | Was on a schedule of stepped annual increases. 2026 may be higher.                                                                                                                                           |
| 3   | **Australia 2026-27 — lowest marginal rate (15%)** | `australia/index.ts` | Legislated to fall from 16% on 1 July 2026. Confirm it actually took effect before anything else in that year.                                                                                               |
| 4   | **Canada 2026 — all indexed amounts**              | `canada/index.ts`    | Brackets, basic personal amounts and the CPP/EI maximums are carried forward from 2025 and are indexed every year. The structure is right; the numbers are almost certainly out.                             |
| 5   | **Australia — the HELP method from 1 July 2025**   | `australia/index.ts` | Modelled as marginal above $67,000 from 2025-26, replacing the old whole-income band scale. That is a change of shape, so if it did not take effect the figures are wrong by thousands rather than slightly. |

---

## By jurisdiction

### United Kingdom — highest confidence

The personal allowance and the rest-of-UK thresholds have been frozen since
2021/22, which is why all three years hold identical figures. That is the
freeze, not a copy-paste error — and there is an e2e test asserting that
switching year does not change the rest-of-UK answer, so if the freeze ends and
someone updates only one year, the test fails.

| Figure                            | Value used (all three years) | Confidence  | Note                    |
| --------------------------------- | ---------------------------- | ----------- | ----------------------- |
| Personal allowance                | £12,570                      | High        | Frozen                  |
| Allowance taper                   | £1 per £2 over £100,000      | High        | Long-standing           |
| Basic / higher / additional rates | 20% / 40% / 45%              | High        | Unchanged for years     |
| Higher rate threshold             | £50,270                      | High        | Frozen                  |
| Additional rate threshold         | £125,140                     | High        |                         |
| NI main rate                      | 8%                           | Medium-high | Cut to 8% in April 2024 |
| NI thresholds                     | £12,570 / £50,270            | High        | Aligned with income tax |

**2024/25 caveat:** the NI main rate was cut to 8% at the start of that year,
having been 10% for the final quarter of 2023/24. Within 2024/25 itself 8% holds
for the whole year, so this is a note about the year before, not a defect.

### UK student loans — medium confidence, and they move every April

Rates have been stable for years; the thresholds are what move. All five are now
calculated. Plan 4 is offered in both regions, because which plan someone repays
is set by where and when they studied, not by where they live now.

| Plan         | Rate     | 2026/27 and 2025/26 | 2024/25 | Confidence for the current year                 |
| ------------ | -------- | ------------------- | ------- | ----------------------------------------------- |
| Plan 1       | 9% above | £26,065             | £24,990 | Medium — uprated most years                     |
| Plan 2       | 9% above | £28,470             | £27,295 | Medium                                          |
| Plan 4       | 9% above | £32,745             | £31,395 | Medium                                          |
| Plan 5       | 9% above | £25,000             | £25,000 | Medium-high — fixed for several years by design |
| Postgraduate | 6% above | £21,000             | £21,000 | Medium-high — unchanged for years               |

**Check 2026/27 first.** Those thresholds are carried forward from 2025/26
unchanged, and most of them are uprated each April.

**A postgraduate loan is charged on top of an undergraduate plan**, not instead
of one, so the form offers a plan and a separate postgraduate tick. Someone on
Plan 2 with a postgraduate loan at £50,000 repays £1,937.70 plus £1,740.

### Scotland — medium confidence, and the band edges move

Six bands, changed more often than the rest of the UK.

| Band         | 2026/27 and 2025/26 | 2024/25     | Rate |
| ------------ | ------------------- | ----------- | ---- |
| Starter      | to £2,827           | to £2,306   | 19%  |
| Basic        | to £14,921          | to £13,991  | 20%  |
| Intermediate | to £31,092          | to £31,092  | 21%  |
| Higher       | to £62,430          | to £62,430  | 42%  |
| Advanced     | to £125,140         | to £125,140 | 45%  |
| Top          | above               | above       | 48%  |

(Edges are on **taxable** income, after the personal allowance.)

**Check 2026/27 first** — it is carried forward from 2025/26 unchanged, and
Scotland uprates the starter and basic edges most years. 2024/25 is the year the
advanced band was introduced.

### Ireland — medium-low confidence

| Figure                      | 2026 and 2025        | 2024                | Confidence for 2026 |
| --------------------------- | -------------------- | ------------------- | ------------------- |
| Standard rate band (single) | €44,000              | €42,000             | **Low**             |
| Rates                       | 20% / 40%            | 20% / 40%           | High                |
| Personal tax credit         | €2,000               | €1,875              | Medium              |
| Employee (PAYE) credit      | €2,000               | €1,875              | Medium              |
| USC bands                   | 0.5% / 2% / 3% / 8%  | 0.5% / 2% / 4% / 8% | Medium              |
| USC second band top         | €27,382              | €25,760             | Medium              |
| USC exemption               | €13,000              | €13,000             | Medium              |
| PRSI rate                   | 4.1%                 | 4%                  | **Low**             |
| PRSI threshold              | €18,304 (≈€352/week) | €18,304             | Medium              |

**2024 caveat:** PRSI rose from 4% to 4.1% part-way through 2024. A single annual
rate cannot express that, so 4% is used and PRSI is slightly understated for the
final quarter of that year.

**Simplification (all years):** the tapered PRSI credit for weekly earnings just
above the threshold is not modelled, so PRSI is slightly overstated near it.

### Australia — lowest confidence in the newest year

| Figure                   | 2026-27                                  | 2025-26 | 2024-25 | Confidence for 2026-27 |
| ------------------------ | ---------------------------------------- | ------- | ------- | ---------------------- |
| Tax-free threshold       | $18,200                                  | $18,200 | $18,200 | High                   |
| Lowest marginal rate     | **15%**                                  | 16%     | 16%     | **Low**                |
| Bands                    | $45k/$135k/$190k                         | same    | same    | Medium                 |
| Rates above the lowest   | 30% / 37% / 45%                          | same    | same    | Medium-high            |
| Medicare levy            | 2%                                       | 2%      | 2%      | High                   |
| Medicare lower threshold | $27,222                                  | $27,222 | $26,000 | **Low** — indexed      |
| Medicare shade-in upper  | $34,027                                  | $34,027 | $32,500 | **Low** — indexed      |
| Low income tax offset    | $700, tapering from $37,500 then $45,000 | same    | same    | Medium                 |

2024-25 is the first year of the revised stage three rates. The 2026-27 Medicare
thresholds are carried forward from 2025-26 and are indexed annually, so they are
almost certainly slightly out even if the rate cut is confirmed.

### Australian HELP — the method changed, not just the numbers

This is the least certain thing on the site, because getting it wrong is
structural rather than a stale figure.

| Year             | Method                        | Threshold | Rates                             |
| ---------------- | ----------------------------- | --------- | --------------------------------- |
| 2026-27, 2025-26 | Marginal above a threshold    | $67,000   | 15% on the next $58,000, then 17% |
| 2024-25          | Band rate on **whole** income | $54,435   | 1% rising to 10% across 19 bands  |

**What to check, in order.** First that the marginal system took effect from
1 July 2025 at all — that is a change of shape, and if it did not happen the
2025-26 and 2026-27 figures are wrong by thousands of dollars, not by a little.
Then the threshold and the two marginal rates. Then the 2024-25 band table,
which has nineteen edges and is the most transcription-prone table on the site.

**Confidence: low** for 2025-26 and 2026-27, **medium** for 2024-25.

**Simplification:** repayments are calculated on salary alone. The ATO assesses
them on _repayment income_, which adds back reportable fringe benefits, super
contributions and investment losses, so a real repayment can be higher than
shown. This is stated on the page.

### Canada — medium confidence on structure, low on amounts

Everything indexed annually. The **structure** — five federal brackets,
provincial tax on top, personal amounts as credits at the lowest rate, CPP with a
second ceiling, Ontario's surtax on tax — I am reasonably confident about. The
**amounts** are very likely slightly out in 2026 and 2025.

| Figure                         | 2026                             | 2025      | 2024                     | Confidence for 2026    |
| ------------------------------ | -------------------------------- | --------- | ------------------------ | ---------------------- |
| Federal lowest rate            | 14%                              | 14.5%     | 15%                      | Medium                 |
| Federal first bracket top      | $57,375                          | $57,375   | $55,867                  | **Low** — indexed      |
| Federal basic personal amount  | $16,129 → $14,538                | same      | $15,705 → $14,156        | **Low** — indexed      |
| CPP rate / ceiling / exemption | 5.95% / $71,300 / $3,500         | same      | 5.95% / $68,500 / $3,500 | **Low** — reset yearly |
| CPP2 second ceiling            | $81,200                          | $81,200   | $73,200                  | **Low**                |
| EI                             | 1.64% to $65,700                 | same      | 1.66% to $63,200         | **Low**                |
| Ontario brackets, 5.05–13.16%  | as listed                        | as listed | lower edges              | Medium                 |
| Ontario surtax                 | 20% over $5,554, 56% over $7,108 | same      | same                     | Medium                 |
| BC brackets, 5.06–20.5%        | as listed                        | as listed | as listed                | Medium                 |
| Alberta brackets               | 8–15%                            | 8–15%     | 10–15%                   | Medium                 |

**2025 caveat:** the lowest federal rate was cut from 15% to 14% part-way through
2025, giving a 14.5% effective rate for the year as a whole. That blended rate is
used, which is right for a full-year salary and wrong for anyone whose income
fell entirely in one half of the year. The note says so on the page.

**Alberta 2024** has no 8% band — it was introduced later — so its lowest rate
is 10% in that year.

**Omitted deliberately:** the Ontario Health Premium, charged through the return.
It would add up to a few hundred dollars a year for Ontario earners.

**Quebec is not published at all,** in any year. Not because the data is missing,
but because the rules cannot be modelled correctly yet: Quebec collects its own
provincial tax, runs QPP instead of CPP, adds QPIP, and reduces federal tax by
the Quebec abatement. That last one is a reduction of _another layer's_ tax,
which the engine has no construct for. Publishing it in the shape used for other
provinces would be wrong by thousands of dollars, not slightly stale. Its ten
salary pages are withheld and its calculators show the "not live" notice.

---

### Ireland and Canada carry no student loan deduction

Not an omission. Neither deducts student loan repayments through payroll the way
the UK and Australia do — Irish student contributions are paid up front, and
Canadian student loans are repaid on a fixed schedule directly to the lender,
not as a share of income withheld by an employer. There is nothing to model.

---

## Simplifications that apply everywhere

1. **Annualised, not per-period.** Every figure assumes the salary was held for
   a whole tax year. Real payroll withholds period by period, and contributions
   like CPP and NI stop mid-year once an annual maximum is reached.
2. **One rate set per year.** Where an authority changed a rate part-way through
   a year, the closest single annual figure is used and the ruleset's note says
   which way it errs, so a reader is told rather than misled. This is a
   deliberate choice: the best available approximation, disclosed, beats
   refusing to answer. The two live cases are Irish PRSI in 2024 (4% used, so
   the final quarter is understated) and the Canadian federal rate cut in 2025
   (a blended 14.5%, right for a full-year salary and wrong for income
   concentrated in one half of the year).
3. **One ordinary employment.** No second jobs, benefits in kind, investment
   income, or self-employment.
4. **Standard tax codes.** Individually issued codes are not modelled.
5. **Single, no dependants** wherever civil status changes the answer. Ireland
   refuses non-single profiles outright rather than approximating.
6. **Rounding policy unconfirmed** in every jurisdiction. Several authorities
   round particular steps down; the engine currently rounds to the minor unit.

---

## What is structurally sound regardless

The arithmetic is tested independently of the rates, so these are not in doubt:

- progressive bands apply only to the slice of income inside them;
- allowance and credit tapers, including tapers that stop at a floor;
- levies charged on whole income, with shade-in bands;
- contributions with floors, ceilings and second ceilings;
- surtaxes charged on tax rather than on income;
- marginal rates measured by re-running the calculation, not read off a table;
- the three income-contingent loan methods, which are genuinely different
  arithmetic and are tested against each other so they cannot be substituted;
- bonus and pay-rise figures computed as real year-on-year differences;
- year selection: a request for a year that is not held returns nothing rather
  than falling back to a different year's rates;
- decimal money throughout, never floating point.

If a result looks wrong, it is far more likely to be a stale number in a ruleset
than a fault in the calculation. That is what makes this correctable: fixing a
figure is editing one line of data, and the tests will tell you if you break the
shape while doing it.
