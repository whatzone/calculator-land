/**
 * JSON-LD.
 *
 * Only markup the visible content genuinely supports is emitted. There are no
 * review ratings, no invented authors, and no aggregate scores, because we have
 * none of those things and marking them up would be a fabrication.
 */
import { SITE, absoluteUrl } from '../../config/site.ts';
import type { AnyCalculatorDefinition } from '../registry/types.ts';

type Json = Record<string, unknown>;

export function organizationSchema(): Json {
  return {
    '@type': 'Organization',
    '@id': `${SITE.url}/#organization`,
    name: SITE.name,
    url: `${SITE.url}/`,
    description: SITE.valueProposition,
  };
}

export function websiteSchema(): Json {
  return {
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    name: SITE.name,
    url: `${SITE.url}/`,
    publisher: { '@id': `${SITE.url}/#organization` },
    inLanguage: 'en-GB',
  };
}

export interface Crumb {
  readonly name: string;
  readonly path: string;
}

export function breadcrumbSchema(crumbs: readonly Crumb[]): Json | null {
  if (crumbs.length < 2) return null;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * WebApplication is emitted only for a calculator page that actually runs a
 * calculator on that page — which, while a jurisdiction is unsourced, means the
 * global tools only.
 */
export function calculatorSchema(
  calculator: AnyCalculatorDefinition,
  path: string,
  isFunctional: boolean,
): Json | null {
  if (!isFunctional) return null;
  return {
    '@type': 'WebApplication',
    '@id': `${absoluteUrl(path)}#calculator`,
    name: calculator.title,
    url: absoluteUrl(path),
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Works without JavaScript; enhanced when JavaScript is available.',
    description: calculator.description,
    isAccessibleForFree: true,
    publisher: { '@id': `${SITE.url}/#organization` },
  };
}

/** Compose a single graph so there is one JSON-LD block per page. */
export function buildGraph(nodes: readonly (Json | null)[]): string {
  const graph = nodes.filter((node): node is Json => node !== null);
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}
