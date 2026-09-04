# Deployment

## Status

**Nothing has been deployed from here.** The build environment blocks outbound
access to Cloudflare, Vercel, and Netlify alike, and every CLI among them needs
an interactive browser login. There is no staging URL, and this document does
not claim one.

That does not block you. **All three hosts deploy by pulling from GitHub**, and
the code is already pushed. Connecting the repository in a host's dashboard
needs no CLI, no token pasted anywhere, and nothing from this environment.

---

## Choosing a host

The site is a directory of static files with no server, no database, and no
serverless functions, so every host below serves it identically. The difference
is entirely in operations.

|                     | Cloudflare Pages                                      | Vercel                      | Netlify                                   |
| ------------------- | ----------------------------------------------------- | --------------------------- | ----------------------------------------- |
| Config file         | `public/_headers`, `public/_redirects`                | `vercel.json`               | `netlify.toml` + `_headers`, `_redirects` |
| Already committed   | Yes                                                   | Yes                         | Yes                                       |
| Free-tier bandwidth | Unmetered                                             | 100 GB/month                | 100 GB/month                              |
| Free-tier builds    | 500/month                                             | 6,000 build-minutes/month   | 300 build-minutes/month                   |
| Trailing slashes    | Native                                                | Set in `vercel.json` (done) | Native                                    |
| Best for            | An ad-funded site whose whole cost model is bandwidth | Preview deployments and DX  | `_headers` compatibility with Cloudflare  |

**Recommendation: Cloudflare Pages**, for one reason that matters more than any
other here. This site's business model is display advertising, which means
success looks like a large volume of cheap pageviews. Cloudflare does not meter
bandwidth; Vercel and Netlify both do, and both bill for overage. A programmatic
SEO site that works is precisely the traffic shape that gets expensive on a
metered plan.

Vercel is the better developer experience and its per-branch preview
deployments are genuinely nicer. If you would rather have that, nothing about
the site resists it — `vercel.json` is committed and correct.

You are not locked in either way. All three configs are generated from
`src/config/hosting.ts`, so switching host is a dashboard change, not a code
change.

---

## Deploying by connecting GitHub — no CLI needed

This is the path that works today, on any of the three.

### Vercel

1. <https://vercel.com/new> → import `whatzone/calculator-land`.
2. Framework preset: **Astro** (detected automatically).
3. Build command `npm run build`, output directory `dist` — both already set in
   `vercel.json`, so leave them alone.
4. Environment variables, **Production scope only**:
   ```
   SITE_URL=https://yourdomain.example
   SITE_NAME=YourBrand
   SITE_CONTACT_EMAIL=hello@yourdomain.example
   SITE_ALLOW_INDEXING=true
   ```
   Do **not** set `SITE_ALLOW_INDEXING` on Preview. Preview deployments must
   stay noindex, and leaving it unset is what achieves that.
5. Deploy. Vercel builds from the branch and gives you a URL.

### Netlify

1. <https://app.netlify.com/start> → import the repository.
2. Build command and publish directory come from `netlify.toml`.
3. Site configuration → Environment variables: the same four as above, scoped to
   production. `netlify.toml` already pins deploy previews and branch deploys to
   `SITE_ALLOW_INDEXING=false`.
4. Deploy.

### Cloudflare Pages

1. Dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Build command `npm run build`, output directory `dist`.
3. Environment variables: the same four, on the Production environment only.
   `wrangler.toml` already sets the preview environment to `false`.
4. Deploy.

### Verify, on any host

Before announcing anything, check the deployment:

- the home page renders and the mortgage calculator computes;
- on a **preview** URL, `/robots.txt` says `Disallow: /` and every page's
  `<meta name="robots">` says `noindex,follow`;
- on **production**, `robots.txt` allows crawling and names the sitemap;
- `/sitemap-pages.xml` lists only pages that passed the gate — while rate
  tables are unpopulated, no salary or tax calculator page may appear in it;
- headers are present: `curl -sI https://yourdomain.example | sort`.

If a preview URL is indexable, stop: something is overriding the indexing
switch, and a staging copy of a financial site in the index is a real problem.

---

## Host configuration is generated, not hand-written

`src/config/hosting.ts` is the single source of truth for security headers,
cache rules, and redirects. `npm run host:config` regenerates all four files
from it:

```
public/_headers    Cloudflare Pages and Netlify
public/_redirects  Cloudflare Pages and Netlify
vercel.json        Vercel
netlify.toml       Netlify build settings
```

`npm run host:check` verifies the committed files still match, and
`tests/integration/hosting.test.ts` runs that check as part of the suite. Editing
a generated file by hand fails the build.

This exists because three copies of a Content-Security-Policy is three chances
for one to be quietly wrong, and a CSP that blocks the calculator script
produces a page that looks completely finished and does nothing at all.

---

## Deploying from the command line instead

If you would rather not connect the repository, each host has a CLI. Each needs
an interactive login, which is why none of them could be used from here.

```bash
npm ci
npm run gate            # must pass before anything is deployed

# Cloudflare
npx wrangler login
npx wrangler pages project create clearfigures --production-branch main
npx wrangler pages deploy dist --project-name=clearfigures

# Vercel
npx vercel login
npx vercel --prod

# Netlify
npx netlify login
npx netlify deploy --prod --dir=dist
```

---

## Going to production

These steps apply on every host; only the menu names differ.

### 1. Set the real identity

Environment variables, **production scope only**:

```
SITE_URL=https://yourdomain.example        # no trailing slash
SITE_NAME=YourBrand
SITE_CONTACT_EMAIL=hello@yourdomain.example
SITE_ALLOW_INDEXING=true
```

The indexability audit refuses to allow indexing while `SITE_URL` is still the
placeholder, so a half-configured production deploy fails the gate rather than
publishing the wrong canonical host.

Leave preview and branch environments without `SITE_ALLOW_INDEXING`. That is
what keeps them noindex, and it is the default in `wrangler.toml` and
`netlify.toml`.

### 2. Add the domain

| Host             | Where                            |
| ---------------- | -------------------------------- |
| Cloudflare Pages | Custom domains → Set up a domain |
| Vercel           | Project → Settings → Domains     |
| Netlify          | Domain management → Add a domain |

Add both the apex and `www`, then redirect whichever is not canonical to the one
that is. Pick one and stay with it — serving both is a duplicate-content problem
that no canonical tag fully solves.

HTTPS and certificate renewal are automatic on all three. HSTS comes from the
generated header config.

### 3. Deploy

A push to `main` deploys automatically once the repository is connected. To
deploy by hand, see the CLI commands above — but run `npm run gate` first.

### 4. Verify before announcing

- `/robots.txt` now allows crawling and names the sitemap.
- `/sitemap-index.xml` lists three child sitemaps.
- `/sitemap-pages.xml` contains only pages that passed the gate.
- No tax calculator or salary page appears in any sitemap while rate tables are
  unpopulated. If one does, stop and run `npm run seo:audit`.
- Canonical links point at the real domain, not `pages.dev`, `vercel.app`, or
  `netlify.app`.
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

Connecting the repository in a host dashboard is the simplest option and needs
nothing from GitHub Actions: the host watches the branch itself. Use that unless
you specifically want the gate to run before the host builds.

`.github/workflows/deploy.yml` is the alternative, deploying to Cloudflare after
the release gate passes on `main`. Adapting it to Vercel or Netlify means
swapping the last step for `vercel deploy --prod` or `netlify deploy --prod`
with that host's token.

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
