# Country onboarding checklist

Every item must be ticked before a country is published. This is a checklist,
not a summary — work through it in order.

## Scaffold

```bash
npm run create:jurisdiction -- \
  --code singapore --name Singapore --adjective Singaporean \
  --currency SGD --locale en-SG \
  --period 2027 --start 2027-01-01 --end 2027-12-31
```

Creates a ruleset with empty rate tables at `status: 'draft'` and
`dataStatus: 'awaiting-official-source'`. That is the only state it can create.

## Checklist

### Sources

- [ ] The tax authority is identified, and it is the body that actually sets the
      rules — not a ministry that summarises them.
- [ ] A direct URL is recorded for each of: income tax rates, allowances or
      credits, and every social contribution.
- [ ] Where a sub-national body sets its own rates, its own authority is
      recorded separately.
- [ ] Every source has been opened and read by a person, and carries a
      `checkedOn` date.

### Scope

- [ ] `supportedProfile` states exactly whose situation this models — residency,
      employment type, civil status, and anything else that changes the answer.
- [ ] `assumptions` lists every simplification a reader would need to know.
- [ ] `exclusions` lists what is not modelled, in the reader's terms rather than
      the tax code's.
- [ ] Any profile outside the supported one returns an explicit unsupported
      result. Not an approximation, not a nearest match.

### Engine

- [ ] Rules are expressed in the existing structures — bands, allowances,
      credits, levies, contributions. If none fits, extend the schema for
      everyone rather than adding a special case for one country.
- [ ] Rounding policy is recorded per stage, with a note naming the authority's
      rule.
- [ ] Sub-jurisdictions are separate rulesets where their structure differs, not
      flags. See D-007.
- [ ] Contribution ceilings, floors, and caps are modelled, not approximated.

### Tests

- [ ] Golden fixtures from the authority's own worked examples, cited.
- [ ] Hand-calculated fixtures with the workings in a comment.
- [ ] Every band boundary tested immediately below, at, and immediately above.
- [ ] Every allowance, taper, cap, credit, and levy floor tested.
- [ ] Zero, low, median-like, high, and very-high-but-supported incomes.
- [ ] Every supported region or province.
- [ ] Rounding and every pay frequency the market displays.
- [ ] Property tests **re-justified** for this jurisdiction. Monotonicity fails
      wherever there is a cliff; do not copy the synthetic fixtures' invariants
      without checking each one.
- [ ] Every unsupported combination asserted to warn rather than return a figure.
- [ ] Cross-checked against the authority's own calculator where one exists,
      with the date and the tolerance recorded.

### Language and terminology

- [ ] Local terms are used, not translated ones. "Take-home pay" in the UK,
      "net pay" elsewhere; "National Insurance", "PRSI", "CPP" — never a
      generic substitute.
- [ ] Currency, number, and date formatting go through `Intl` with the page
      locale. No hand-formatted currency anywhere.
- [ ] Pay frequencies match local convention: fortnightly in Australia,
      bi-weekly in Canada.
- [ ] For a non-English market, real translation and local social-contribution
      expertise are in place. Machine-translating the English templates is not
      an acceptable substitute and is explicitly out of scope until then.

### Content and legal

- [ ] Country guide written, specific to the market rather than a template fill.
- [ ] Assumptions and limitations render beside the result, not only in a legal
      page.
- [ ] The disclaimer covers anything unusual about this market.
- [ ] A named person has reviewed the content, and it is recorded who.

### Measurement

- [ ] The jurisdiction code is added to the analytics taxonomy — automatic, via
      the generated closed-value sets, but verify it appears.
- [ ] Salary amounts added to `src/data/salary-amounts.ts` as an explicit,
      reviewed list. Not a generated range.

### SEO

- [ ] Titles and descriptions are distinct from every other market's.
- [ ] Internal links follow a real journey, not a keyword list.
- [ ] `hreflang` is added **only** if there is a genuine translated edition.
      Two English-language editions for two countries are not an `hreflang`
      cluster, and marking them as one is a mistake that is hard to undo.

### Maintenance

- [ ] `expiresOn` is set to the real end of the tax period.
- [ ] A named owner is responsible for the annual update.
- [ ] The change log has a dated entry.

## Publish

Only when every box is ticked:

```bash
npm run gate
npm run tax:audit -- --strict
git diff src/data/page-manifests/generated/page-manifest.json   # read it
```

Then set `dataStatus: 'populated'` and `status: 'published'`.

## Candidate order

From `docs/ROADMAP.md` phase 3, in evaluation order: United States (needs a
tested federal/state architecture and a decision on local taxes), Singapore,
South Africa, United Arab Emirates (employment and payroll rules — a zero
personal-income-tax page is not a calculator), then Germany, Netherlands, and
France.

The last three are gated on local-language content and social-contribution
expertise, not on engineering capacity.
