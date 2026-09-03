# Deployment

## Status

**Nothing has been deployed.** `api.cloudflare.com` is unreachable from the
environment this repository was built in, and Wrangler authentication needs an
interactive browser login. There is no staging URL, and this document does not
claim one.

Everything needed to deploy is committed. The commands below are what to run.

---

## What you need first

| Item                  | Why                      | Status                            |
| --------------------- | ------------------------ | --------------------------------- |
| Cloudflare account    | Hosting                  | Owner has, or creates free        |
| A domain              | Canonical URL            | Not supplied — placeholder in use |
| Contact email address | Legal pages, corrections | Not supplied — placeholder in use |
| Search Console access | Organic data             | After the domain exists           |

Nothing below asks for a password, a token, or a private key in conversation.
Wrangler authenticates through your own browser; CI uses a repository secret you
set yourself.

---

## First deployment, to staging

```bash
npm ci
npm run gate          # must pass before anything is deployed
npx wrangler login    # opens your browser; nothing is typed here
npx wrangler pages project create clearfigures --production-branch main
npx wrangler pages deploy dist --project-name=clearfigures
```

Wrangler prints a `*.pages.dev` URL. Open it over HTTPS and check:

- the home page renders and the mortgage calculator computes;
- `/robots.txt` says `Disallow: /` — a staging deployment must not be crawlable;
- `/sitemap-pages.xml` contains no `<url>` entries;
- any page's `<meta name="robots">` says `noindex,follow`.

All four follow from `SITE_ALLOW_INDEXING` being unset. If any of them is wrong,
stop: something is overriding the indexing switch.

---

## Going to production

### 1. Set the real identity

In the Cloudflare Pages project, under Settings → Environment variables, for the
**Production** environment only:

```
SITE_URL=https://yourdomain.example        # no trailing slash
SITE_NAME=YourBrand
SITE_CONTACT_EMAIL=hello@yourdomain.example
SITE_ALLOW_INDEXING=true
```

The indexability audit refuses to allow indexing while `SITE_URL` is still the
placeholder, so a half-configured production deploy fails the gate rather than
publishing the wrong canonical host.

Leave the Preview environment's `SITE_ALLOW_INDEXING` at `false`.

### 2. Add the domain

Cloudflare Pages → Custom domains → Set up a domain. Add both the apex and
`www`, then create a redirect rule from whichever is not canonical to the one
that is. Pick one and stay with it — serving both is a duplicate-content
problem that no canonical tag fully solves.

HTTPS and HSTS are handled by Cloudflare; `public/_headers` already sets
`Strict-Transport-Security`.

### 3. Deploy

```bash
npm run gate
npx wrangler pages deploy dist --project-name=clearfigures --branch=main
```

### 4. Verify before announcing

- `/robots.txt` now allows crawling and names the sitemap.
- `/sitemap-index.xml` lists three child sitemaps.
- `/sitemap-pages.xml` contains only pages that passed the gate.
- No tax calculator or salary page appears in any sitemap while rate tables are
  unpopulated. If one does, stop and run `npm run seo:audit`.
- Canonical links point at the real domain, not `pages.dev`.
- Security headers are present: `curl -sI https://yourdomain.example | sort`.

### 5. Search Console

Only after the domain resolves:

1. Add the property (domain property, via DNS TXT, is preferable to URL prefix).
2. Alternatively set `SEARCH_CONSOLE_VERIFICATION` and redeploy for the meta tag.
3. Verify ownership.
4. Submit `https://yourdomain.example/sitemap-index.xml`.

Do not record Search Console as active until ownership is actually verified.

---

## Continuous deployment

`.github/workflows/deploy.yml` deploys after the release gate passes on `main`,
or on demand with an environment choice.

Repository secrets:

| Secret                  | Where to get it                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages, right sidebar                               |

Repository variables: `SITE_URL`, `SITE_NAME`, `SITE_CONTACT_EMAIL`, and any
analytics or ad identifiers. `SITE_ALLOW_INDEXING` is set by the workflow itself
and is `true` only for a production deployment — it is not something a variable
can turn on by accident.

---

## Rollback

Cloudflare Pages keeps every deployment.

**Fastest:** dashboard → Deployments → the last good one → Rollback. Live in
seconds, no build required.

**From git:**

```bash
git revert <bad-commit>
npm run gate
npx wrangler pages deploy dist --project-name=clearfigures --branch=main
```

**If the problem is a wrong tax figure**, do both: roll back immediately, then
set that ruleset's `status` back to `'draft'`. The gate will pull its pages out
of the index and out of the sitemap on the next deploy, which is what you want
while you investigate — a wrong figure that stays indexed keeps being found.

---

## Environment variables

See `.env.example` for the annotated list. Every default is the safe one: no
indexing, no analytics, no ads.

The three that change behaviour rather than content:

- `SITE_ALLOW_INDEXING` — anything but `true` makes the whole site noindex and
  empties the sitemap.
- `ADS_ENABLED` — no ad script loads while this is `false`, regardless of what
  else is configured.
- `GA4_MEASUREMENT_ID` — GA4 loads only when this is set _and_ a consent choice
  permits it.

---

## Security headers

`public/_headers` sets a reviewed CSP, `Referrer-Policy`,
`X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`, HSTS, and
COOP.

The CSP currently allows exactly one third-party origin:
`static.cloudflareinsights.com`. **When you enable something new, add its origin
and then test that the calculator still works.** A CSP that silently blocks the
calculator script produces a page that looks fine and does nothing — which is
worse than no ads at all.

Documented additions:

- GA4: `https://www.googletagmanager.com https://www.google-analytics.com` in
  `script-src`, and `https://www.google-analytics.com` in `connect-src`.
- An ad network: its documented origins, which will be several. Add them
  explicitly; do not relax to `*`.

There is no `X-Robots-Tag` in the global header block, deliberately. Indexing is
controlled per page by the meta robots tag so that previews are noindex and
production is not; a blanket header would override that permanently.

---

## Enabling advertising

In order, and not before:

1. Obtain an approved publisher account.
2. Configure a Google-certified consent management platform, and set
   `CMP_PROVIDER`. Personalised ads for UK and EEA visitors require this.
3. Set `AD_PUBLISHER_ID` and the three slot identifiers.
4. Set `ADS_TXT_LINES` to the exact line your network gives you. `ads.txt` is
   generated only from a real line, and removed if the configuration goes away.
5. Add the network's origins to the CSP and re-test the calculators.
6. Set `ADS_ENABLED=true`.
7. Re-run the Playwright suite. `tests/e2e/calculator.spec.ts` asserts that ad
   slots reserve space; update it to assert the new live behaviour rather than
   deleting it.

Slot dimensions are already reserved, so enabling ads must not shift the layout.
If it does, something is wrong with the slot configuration, not the CSS.
