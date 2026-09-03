/**
 * Sitemap index. Split by page family from the start so that growth does not
 * require restructuring, and so a family can be diagnosed on its own in Search
 * Console.
 */
import type { APIRoute } from 'astro';
import { SITE } from '../config/site.ts';
import { CONTENT_LAST_MODIFIED } from '../lib/seo/manifest.ts';

const FAMILIES = ['pages', 'calculators', 'salary'] as const;

export const GET: APIRoute = () => {
  const entries = SITE.allowIndexing
    ? FAMILIES.map(
        (family) =>
          `  <sitemap><loc>${SITE.url}/sitemap-${family}.xml</loc><lastmod>${CONTENT_LAST_MODIFIED}</lastmod></sitemap>`,
      ).join('\n')
    : '';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
