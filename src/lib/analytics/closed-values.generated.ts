/**
 * GENERATED FILE — do not edit by hand.
 *
 * Written by scripts/build-page-manifest.ts on every build. It exists so the
 * analytics adapter can validate closed-set property values by membership
 * without importing the calculator registry, which would pull Zod and every
 * ruleset module into the browser bundle.
 */
import type { AnalyticsProperty } from '../../config/analytics.ts';

export const DERIVED_CLOSED_VALUES: Partial<Record<AnalyticsProperty, readonly string[]>> = {
  "tax_period": [
    "2024",
    "2024-25",
    "2024/25",
    "2025",
    "2025-26",
    "2025/26",
    "2026",
    "2026-27",
    "2026/27"
  ],
  "jurisdiction": [
    "australia",
    "canada",
    "global",
    "ireland",
    "new-zealand",
    "uk"
  ],
  "sub_jurisdiction": [
    "alberta",
    "british-columbia",
    "england-wales-ni",
    "ontario",
    "quebec",
    "scotland"
  ],
  "tool_id": [
    "australia-bonus",
    "australia-net-to-gross",
    "australia-pay-rise",
    "australia-salary",
    "canada-bonus",
    "canada-net-to-gross",
    "canada-pay-rise",
    "canada-salary",
    "global-hourly-to-salary",
    "global-mortgage-overpayment",
    "global-mortgage-payment",
    "ireland-bonus",
    "ireland-net-to-gross",
    "ireland-pay-rise",
    "ireland-salary",
    "new-zealand-bonus",
    "new-zealand-net-to-gross",
    "new-zealand-pay-rise",
    "new-zealand-salary",
    "uk-bonus",
    "uk-net-to-gross",
    "uk-pay-rise",
    "uk-salary"
  ],
  "calculator_family": [
    "general-finance",
    "mortgage",
    "salary-tax"
  ]
};
