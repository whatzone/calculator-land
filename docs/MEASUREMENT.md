# Measurement

## The rule that overrides everything else

No value a visitor types into a calculator, and no value derived from one, may
leave the browser.

Not the salary, bonus, pension percentage, mortgage balance, interest rate,
deposit, postcode, civil status, or student loan status. Not the result. Not a
bracket reconstructed from the result. Not in an event name, not in a property,
not as a rounded band.

This is enforced in `src/lib/analytics/track.ts` and tested in
`tests/unit/analytics.test.ts` and `tests/e2e/privacy.spec.ts`, which watches
the network while a figure is entered and asserts it appears in no request.

## Layers

| Layer                    | Purpose                                             | State                                       |
| ------------------------ | --------------------------------------------------- | ------------------------------------------- |
| Cloudflare Web Analytics | Page traffic, broad referrers, cookie-light         | Configured, off until a token is set        |
| Google Analytics 4       | Product analytics and campaign attribution          | Configured, off until an ID **and** consent |
| Google Search Console    | Queries, impressions, CTR, position, index coverage | After the domain exists                     |
| Ad network reporting     | RPM, viewability, revenue by page                   | After ads are enabled                       |

No bespoke analytics backend and no warehouse. Free native dashboards until
traffic volume creates a proven need — which it will not at launch.

## Events

The complete set. Anything else is dropped by the adapter, in code.

| Event                          | When                                |
| ------------------------------ | ----------------------------------- |
| `calculator_viewed`            | A calculator page loads             |
| `calculation_completed`        | A calculation runs, valid or not    |
| `advanced_options_opened`      | The advanced group is expanded      |
| `pay_frequency_changed`        | The frequency selector changes      |
| `print_or_share_selected`      | Print or share is used              |
| `source_or_methodology_viewed` | An official source link is followed |

## Properties

The complete allow-list. A property not named here is stripped before dispatch.

| Property            | Example         | Notes                        |
| ------------------- | --------------- | ---------------------------- |
| `tool_id`           | `uk-salary`     | Closed set from the registry |
| `calculator_family` | `salary-tax`    | Closed set                   |
| `jurisdiction`      | `uk`            | Closed set                   |
| `sub_jurisdiction`  | `scotland`      | Closed set                   |
| `tax_period`        | `2026/27`       | Closed set from the rulesets |
| `page_template`     | `salary-result` | Open; heuristic-filtered     |
| `interaction_type`  | `submit`        | Closed set                   |
| `is_prefilled_page` | `true`          | Closed set                   |
| `validation_state`  | `valid`         | Closed set                   |

Closed sets are generated from our own registries at build time into
`src/lib/analytics/closed-values.generated.ts`, so they cannot drift. A value
that is a member of one is safe by construction: it came from our data, not from
a visitor.

Values on closed-set properties are validated by membership; anything
unrecognised becomes `other`. That is what stops a salary passed in by mistake
from being forwarded. Open properties get a heuristic that rejects
currency-shaped values and long digit runs.

Membership rather than heuristic matters: an early version rejected the
legitimate tax period `2026/27` for containing a four-digit year.

## Acquisition dimensions

Standard platform behaviour, nothing custom: landing page, referring domain,
default channel group, source/medium, campaign, UTM parameters, organic search
engine, coarse country, device category, browser class, and new versus returning
where consent permits.

Not collected: raw IP addresses, exact geolocation, persistent cross-site
identifiers, full referrer URLs copied into our own storage, or any device
fingerprint.

## KPIs

**Weekly operating view** — users, sessions, engaged sessions; calculator
view-to-completion rate; advanced-option usage; source and methodology
engagement; Core Web Vitals field data once available.

**Monthly SEO view** — organic clicks, impressions, CTR, average position;
sessions by source/medium, channel, campaign, landing page, country, device;
index coverage and excluded-page reasons; return-visitor rate.

**After ads** — page RPM, viewability, revenue, and revenue per organic landing
page. Joined by page path and slot identifier, never by anything the visitor
entered.

## Looker Studio

One free dashboard, three sources.

**Page performance** — Search Console (page) joined to GA4 (landing page) on the
page path. Columns: impressions, clicks, CTR, position, sessions, engaged
sessions, calculation completion rate. Sorted by impressions.

**Query intent** — Search Console query dimension, filtered to queries with
impressions above a threshold and CTR below the site median. That intersection
is where a title or description is failing a reader, and it is the highest-value
list on the dashboard.

**Tool funnel** — GA4 events, `calculator_viewed` to `calculation_completed`,
broken down by `tool_id` and `jurisdiction`. A low completion rate on a tool
means the form is confusing, not that the tool is unwanted.

**Index coverage** — Search Console coverage over time against the page count in
`src/data/page-manifests/generated/page-manifest.json`. The gap between "pages
we publish" and "pages Google indexes" is the number worth watching in the first
90 days.

## Setup

1. **Cloudflare Web Analytics** — enable on the Pages project, copy the token
   into `CF_ANALYTICS_TOKEN`. No consent banner needed.
2. **Search Console** — add the domain property, verify by DNS TXT, submit
   `/sitemap-index.xml`. Only after the domain resolves; do not record it as
   active until ownership is verified.
3. **GA4** — create the property, set `GA4_MEASUREMENT_ID`. It will not load
   until a consent platform is configured and a positive choice recorded.
4. **Consent** — required before GA4 or personalised ads for UK/EEA visitors.
   Set `CMP_PROVIDER`. Nothing is bundled, and consent is never assumed.
