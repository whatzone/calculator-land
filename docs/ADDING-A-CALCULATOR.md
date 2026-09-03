# Adding a calculator

The registry drives routing, navigation, sitemaps, breadcrumbs, structured data,
analytics, and the page manifest. Adding an ordinary calculator therefore
touches none of those.

## Scaffold

```bash
npm run create:calculator -- \
  --id uk-stamp-duty \
  --family property \
  --slug stamp-duty-calculator \
  --title "UK Stamp Duty Calculator" \
  --jurisdictions uk
```

It validates that the id and slug are unique and that the slug does not collide
inside any jurisdiction, then creates the engine, the registry entry, and the
test file, and prints the remaining checklist.

It registers the calculator as `draft`, which means built but never indexed and
never in a sitemap. It cannot create a publishable calculator — promoting one
needs sources, assumptions, limitations, and fixtures, and those are your job.

## Then

1. **Implement the calculation** in `src/lib/calculations/<scope>/<slug>.ts`.
   Money is `Money`, never a number. Rates and thresholds come from a ruleset,
   never as literals in the engine. Return an itemised breakdown, not a total.
   Where an input is not supported, return a warning rather than a guess.

2. **Define the fields** in the registry entry. The renderer, the client
   validator, and the tests all read the same definitions, so a field is
   described once. Put help text on anything a reader could misread — in a
   financial calculator the caveat is the product, not an afterthought.

3. **Source the constants.** Follow `docs/TAX-DATA-UPDATE-RUNBOOK.md`. If the
   calculator needs no tax rules — mortgage arithmetic, unit conversion — set
   `indexableWithoutTaxData: true` and say why in the entry's comment.

4. **Write the fixtures.** Golden cases from the authority's worked examples,
   hand-calculated cases with the workings in a comment, every threshold tested
   below/at/above, and every unsupported combination asserted to warn.

5. **Write the content.** `description`, `metaDescription`, `assumptions`, and
   `limitations` are all required and all must be specific. The gate rejects a
   published calculator with no assumptions or no limitations, and rejects any
   page whose rendered body still contains a `TODO(scaffold)` marker.

6. **Register it** in `CALCULATORS` in `src/lib/registry/index.ts`.

7. **Run the gate:** `npm run gate`

8. **Review the inventory diff:**

   ```bash
   git diff src/data/page-manifests/generated/page-manifest.json
   ```

   It shows precisely which pages your change makes indexable. An unexpected
   page in that diff is a problem to understand, not to accept.

9. **Publish** by changing `status` from `'draft'` to `'published'`.

## The presenter

`present` turns a result into a `ResultViewModel`. The order is fixed for a
reason and is enforced by the shared template rather than by each page: headline
figure, summary, chart, itemised breakdown, pay frequencies, notices,
assumptions.

If your calculator needs a chart, add it to `chart` **and** make sure every
segment already appears in `breakdownRows`. Nothing on this site may be
available only visually.

## When not to add one

The gate stops bad pages; it does not stop unnecessary ones. Before adding a
calculator, check it against the expansion criteria in
`docs/EDITORIAL-AND-SEO.md`. A calculator that answers the same question as an
existing one with a different label is not a new product, and shipping it makes
both harder to find.
