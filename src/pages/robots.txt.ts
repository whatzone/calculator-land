/**
 * robots.txt.
 *
 * Disallows nothing on a production build beyond genuinely non-public routes.
 * On any build without SITE_ALLOW_INDEXING — every preview and branch deploy —
 * it disallows everything, so a staging URL cannot be crawled by accident.
 */
import type { APIRoute } from 'astro';
import { SITE } from '../config/site.ts';

export const GET: APIRoute = () => {
  const body = SITE.allowIndexing
    ? [
        'User-agent: *',
        'Allow: /',
        '',
        '# Query-string variants are for sharing a result, not for crawling.',
        'Disallow: /*?',
        '',
        `Sitemap: ${SITE.url}/sitemap-index.xml`,
        '',
      ].join('\n')
    : [
        '# Indexing is not enabled for this deployment (SITE_ALLOW_INDEXING is not "true").',
        '# This is a staging, preview, or local build.',
        'User-agent: *',
        'Disallow: /',
        '',
      ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
