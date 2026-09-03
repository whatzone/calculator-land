#!/usr/bin/env tsx
/**
 * A foreground static file server for `dist/`, used by the Playwright suite.
 *
 * `astro preview` starts a background daemon and returns immediately, which
 * Playwright reads as the web server having exited early. Rather than work
 * around that, the tests get a server whose behaviour is defined here and
 * therefore identical on every machine: directory indexes, a real 404 with the
 * site's own 404 page, and the same `_headers` policy the host will apply.
 *
 *   npx tsx scripts/preview-server.ts [--port 4321] [--dir dist]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const args = process.argv.slice(2);
function flag(name: string, fallback: string): string {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

const PORT = Number(flag('port', '4321'));
const ROOT = resolve(flag('dir', 'dist'));

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Resolve a request path to a file, applying directory-index rules. */
function resolveFile(pathname: string): string | null {
  // Reject traversal before touching the filesystem.
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidate = join(ROOT, safe);
  if (!candidate.startsWith(ROOT)) return null;

  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;

  const indexed = join(candidate, 'index.html');
  if (existsSync(indexed)) return indexed;

  const suffixed = `${candidate}.html`;
  if (existsSync(suffixed)) return suffixed;

  return null;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`);
  const file = resolveFile(url.pathname);

  if (!file) {
    // Serve the site's own 404 page with a genuine 404 status, so tests
    // exercise what a visitor actually gets.
    const notFound = join(ROOT, '404.html');
    if (existsSync(notFound)) {
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      createReadStream(notFound).pipe(response);
      return;
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    // Mirrors public/_headers so the tests see the same policy as production.
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  createReadStream(file).pipe(response);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Preview server running at http://127.0.0.1:${PORT} (serving ${ROOT})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
