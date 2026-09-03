/**
 * Per-family sitemaps.
 *
 * The list comes from `sitemapPages()`, which returns nothing at all unless
 * indexing is enabled and the page passed the quality gate. A draft page cannot
 * be listed here even by mistake.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { absoluteUrl } from '../config/site.ts';
import { sitemapPages, type PageManifestEntry } from '../lib/seo/manifest.ts';

const FAMILY_TEMPLATES: Record<string, PageManifestEntry['template'][]> = {
  pages: ['home', 'family-hub', 'country-hub', 'content', 'legal', 'directory'],
  calculators: ['calculator'],
  salary: ['salary-result'],
};

export const getStaticPaths: GetStaticPaths = () =>
  Object.keys(FAMILY_TEMPLATES).map((family) => ({ params: { family } }));

export const GET: APIRoute = ({ params }) => {
  const family = String(params['family'] ?? '');
  const templates = FAMILY_TEMPLATES[family] ?? [];
  const pages = sitemapPages().filter((entry) => templates.includes(entry.template));

  const urls = pages
    .map(
      (entry) =>
        `  <url><loc>${absoluteUrl(entry.path)}</loc><lastmod>${entry.lastModified}</lastmod></url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
