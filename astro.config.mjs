// @ts-check
import { defineConfig } from 'astro/config';
import { SITE } from './src/config/site.ts';

// Static output only. No SSR, no database, no server sessions in v1.
// Trailing slashes are enforced so that /uk/ and /uk are never both crawlable.
export default defineConfig({
  site: SITE.url,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
  devToolbar: { enabled: false },
  vite: {
    build: {
      // Keep first-party JS well inside the 60 KB compressed budget.
      target: 'es2022',
      cssCodeSplit: true,
    },
  },
});
