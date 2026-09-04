# Rate ambiguities — the correction list

Every figure on this site was entered from general knowledge. **None of it has
been read from the authority that publishes it.** This file lists what I am
least sure about, so the corrections can be made in priority order rather than
by re-checking everything blind.

Confidence below is my own estimate of whether a figure is right, not a
statement of fact. Treat **every** row as needing verification; the ordering
just says where to start.

How to correct one: edit the ruleset under `src/data/jurisdictions/`, set the
source's `checkedOn`, and follow `docs/TAX-DATA-UPDATE-RUNBOOK.md`. When a whole
jurisdiction has been checked, set `provenance.dataStatus` to `populated`, add
`checkedOn` and `checkedBy`, and the health warning disappears from its pages
automatically.

---

## Start here: the five most likely to be wrong

| #   | Figure                                                    | Where                  | Why it is doubtful                                                                                                                                                               |
| --- | --------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Ireland — standard rate band (€44,000)**                | `ireland/index.ts`     | Ireland moves this most Budgets. If it rose for 2026, every Irish result is wrong.                                                                                               |
| 2   | **Ireland — PRSI rate (4.1%)**                            | `ireland/index.ts`     | Was on a schedule of stepped annual increases. 2026 may be higher.                                                                                                               |
| 3   | **Australia — everything**                                | `australia/index.ts`   | The 2026-27 income year began after the point my figures are known to. Thresholds are indexed annually.                                                                          |
| 4   | **Canada — all indexed amounts**                          | `canada/index.ts`      | Federal and provincial brackets, basic personal amounts, and the CPP/EI maximums are all indexed every year. The structure is likely right; the numbers are likely slightly out. |
| 5   | **New Zealand — ACC earners' levy (1.67%, cap $152,790)** | `new-zealand/index.ts` | Reset annually and often changed.                                                                                                                                                |

---

## By jurisdiction

### United Kingdom — highest confidence

| Figure                            | Value used              | Confidence  | Note                     |
| --------------------------------- | ----------------------- | ----------- | ------------------------ |
| Personal allowance                | £12,570                 | High        | Frozen for several years |
| Allowance taper                   | £1 per £2 over £100,000 | High        | Long-standing            |
| Basic / higher / additional rates | 20% / 40% / 45%         | High        | Unchanged for years      |
| Higher rate threshold             | £50,270                 | High        | Frozen                   |
| Additional rate threshold         | £125,140                | High        |                          |
| NI main rate                      | 8%                      | Medium-high | Cut to 8% in April 2024  |
| NI thresholds                     | £12,570 / £50,270       | High        | Aligned with income tax  |

**Omitted deliberately:** student loan repayments. Plan 1, 2, 4, 5 and
postgraduate thresholds change every April and I would have been guessing. The
option appears in the form and produces a visible "not carried" notice.

### Scotland — medium confidence

Six bands, changed more often than the rest of the UK. Values used: starter 19%
to £15,397, basic 20% to £27,491, intermediate 21% to £43,662, higher 42% to
£75,000, advanced 45% to £125,140, top 48% above.

**Check the band edges first** — Scotland has moved these repeatedly, and it
added the advanced band recently.

### Ireland — medium-low confidence

| Figure                      | Value used           | Confidence |
| --------------------------- | -------------------- | ---------- |
| Standard rate band (single) | €44,000              | **Low**    |
| Rates                       | 20% / 40%            | High       |
| Personal tax credit         | €2,000               | Medium     |
| Employee (PAYE) credit      | €2,000               | Medium     |
| USC bands                   | 0.5% / 2% / 3% / 8%  | Medium     |
| USC exemption               | €13,000              | Medium     |
| PRSI rate                   | 4.1%                 | **Low**    |
| PRSI threshold              | €18,304 (≈€352/week) | Medium     |

**Simplification:** the tapered PRSI credit for weekly earnings just above the
threshold is not modelled, so PRSI is slightly overstated near it.

### Australia — lowest confidence

| Figure                   | Value used                               | Confidence                                                                   |
| ------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------- |
| Tax-free threshold       | $18,200                                  | High                                                                         |
| Lowest marginal rate     | **15%**                                  | **Low** — legislated to fall from 16% on 1 July 2026; confirm it took effect |
| Bands                    | $45,000 / $135,000 / $190,000            | Medium                                                                       |
| Rates                    | 30% / 37% / 45%                          | Medium-high                                                                  |
| Medicare levy            | 2%                                       | High                                                                         |
| Medicare lower threshold | $27,222                                  | **Low** — indexed annually                                                   |
| Medicare shade-in upper  | $34,027                                  | **Low** — indexed annually                                                   |
| Low income tax offset    | $700, tapering from $37,500 then $45,000 | Medium                                                                       |

**Omitted deliberately:** HELP and study loan repayments. Their bands change
every July.

### New Zealand — medium-high confidence

| Figure                      | Value used                             | Confidence  |
| --------------------------- | -------------------------------------- | ----------- |
| Bands                       | $15,600 / $53,500 / $78,100 / $180,000 | Medium-high |
| Rates                       | 10.5% / 17.5% / 30% / 33% / 39%        | High        |
| ACC earners' levy           | 1.67%                                  | **Low**     |
| ACC maximum liable earnings | $152,790                               | **Low**     |
| Student loan                | 12% above $24,128                      | Medium      |

**Omitted deliberately:** the Independent Earner Tax Credit, which would reduce
tax for some middle incomes. Its abatement rules need checking before it can be
added.

### Canada — medium confidence on structure, low on amounts

Everything indexed annually. The **structure** — five federal brackets,
provincial tax on top, personal amounts as credits at the lowest rate, CPP with
a second ceiling, Ontario's surtax on tax — I am reasonably confident about. The
**amounts** are very likely slightly out.

| Figure                           | Value used                               | Confidence             |
| -------------------------------- | ---------------------------------------- | ---------------------- |
| Federal lowest rate              | 14%                                      | Medium                 |
| Federal brackets                 | $57,375 / $114,750 / $177,882 / $253,414 | **Low** — indexed      |
| Federal basic personal amount    | $16,129, tapering to $14,538             | **Low** — indexed      |
| CPP rate / ceiling / exemption   | 5.95% / $71,300 / $3,500                 | **Low** — reset yearly |
| CPP2                             | 4% between $71,300 and $81,200           | **Low**                |
| EI                               | 1.64% to $65,700                         | **Low**                |
| Ontario brackets and 5.05–13.16% | as listed in the ruleset                 | Medium                 |
| Ontario surtax                   | 20% over $5,554, 56% over $7,108         | Medium                 |
| BC brackets, 5.06–20.5%          | as listed                                | Medium                 |
| Alberta brackets, 8–15%          | as listed                                | Medium                 |

**Omitted deliberately:** the Ontario Health Premium, charged through the return.
It would add up to a few hundred dollars a year for Ontario earners.

**Quebec is not published at all.** Not because the data is missing, but because
the rules cannot be modelled correctly yet: Quebec collects its own provincial
tax, runs QPP instead of CPP, adds QPIP, and reduces federal tax by the Quebec
abatement. That last one is a reduction of _another layer's_ tax, which the
engine has no construct for. Publishing it in the shape used for other provinces
would be wrong by thousands of dollars, not slightly stale. Its ten salary pages
are withheld and its calculators show the "not live" notice.

---

## Simplifications that apply everywhere

1. **Annualised, not per-period.** Every figure assumes the salary was held for
   a whole tax year. Real payroll withholds period by period, and contributions
   like CPP and NI stop mid-year once an annual maximum is reached.
2. **One ordinary employment.** No second jobs, benefits in kind, investment
   income, or self-employment.
3. **Standard tax codes.** Individually issued codes are not modelled.
4. **Single, no dependants** wherever civil status changes the answer. Ireland
   refuses non-single profiles outright rather than approximating.
5. **Rounding policy unconfirmed** in every jurisdiction. Several authorities
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
- bonus and pay-rise figures computed as real year-on-year differences;
- decimal money throughout, never floating point.

If a result looks wrong, it is far more likely to be a stale number in a ruleset
than a fault in the calculation. That is what makes this correctable: fixing a
figure is editing one line of data, and the tests will tell you if you break the
shape while doing it.
