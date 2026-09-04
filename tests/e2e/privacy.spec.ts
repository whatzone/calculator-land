import { expect, test } from '@playwright/test';

/**
 * The promise that entered figures never leave the browser is the site's most
 * important claim. These tests watch the network to check it holds.
 */
test('no network request carries an entered figure', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(`${request.url()} ${request.postData() ?? ''}`));

  await page.goto('/mortgage-calculators/monthly-payment/');
  await page.fill('#field-principal', '987654');
  await page.fill('#field-annualRatePercent', '4.37');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(500);

  // The figure may legitimately appear in the page's own URL, which is a
  // share link the user controls and which is never fetched.
  const offSite = requests.filter((entry) => !entry.startsWith(page.url().split('?')[0] ?? ''));
  for (const entry of offSite) {
    expect(entry, `leaked in: ${entry}`).not.toContain('987654');
    expect(entry, `leaked in: ${entry}`).not.toContain('4.37');
  }
});

test('sets no cookies', async ({ page, context }) => {
  await page.goto('/mortgage-calculators/monthly-payment/');
  await page.fill('#field-principal', '150000');
  await page.click('button[type="submit"]');
  expect(await context.cookies()).toEqual([]);
});

test('using a calculator writes nothing to storage', async ({ page }) => {
  await page.goto('/mortgage-calculators/monthly-payment/');
  await page.fill('#field-principal', '150000');
  await page.fill('#field-annualRatePercent', '4.25');
  await page.click('button[type="submit"]');

  const stored = await page.evaluate(() => ({
    local: window.localStorage.length,
    session: window.sessionStorage.length,
  }));
  expect(stored).toEqual({ local: 0, session: 0 });
});

test('choosing a theme stores the theme name and nothing else', async ({ page }) => {
  // The theme preference is the only thing this site ever writes to storage,
  // and only when the reader explicitly asks for it. This test pins both halves
  // of that claim: what is written, and that nothing financial goes with it.
  await page.goto('/mortgage-calculators/monthly-payment/');
  await page.fill('#field-principal', '777777');
  await page.click('button[type="submit"]');
  await page.click('[data-theme-toggle]');

  const entries = await page.evaluate(() =>
    Object.entries({ ...window.localStorage }).map(([key, value]) => [key, String(value)]),
  );

  expect(entries).toHaveLength(1);
  const [key, value] = entries[0] as [string, string];
  expect(key).toBe('clearfigures-theme');
  expect(['light', 'dark']).toContain(value);

  const everything = JSON.stringify(entries);
  expect(everything).not.toContain('777777');
  expect(await page.evaluate(() => window.sessionStorage.length)).toBe(0);
});

test('logs no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  for (const path of [
    '/',
    '/uk/',
    '/uk/salary/50000-after-tax/',
    '/mortgage-calculators/overpayment/',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  expect(errors).toEqual([]);
});
