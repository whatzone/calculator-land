import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

/**
 * Some environments ship a Chromium build that does not match the one this
 * Playwright version would download, and have no network access to fetch the
 * matching one. Where such a build is present, point at it; everywhere else
 * (a developer machine, CI) this resolves to undefined and Playwright uses its
 * own managed browser as normal.
 */
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = existsSync(PREINSTALLED_CHROMIUM) ? PREINSTALLED_CHROMIUM : undefined;
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    launchOptions,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    {
      name: 'no-javascript',
      use: { ...devices['Desktop Chrome'], javaScriptEnabled: false },
      testMatch: /no-js\.spec\.ts/,
    },
  ],
  webServer: {
    // Not `astro preview`: in Astro 7 it starts a background daemon and returns,
    // which Playwright reads as the server having exited early. This one runs in
    // the foreground and defines its own 404 and directory-index behaviour, so
    // the suite behaves identically on every machine.
    command: `npx tsx scripts/preview-server.ts --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
