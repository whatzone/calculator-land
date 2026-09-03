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

test('writes nothing to storage', async ({ page }) => {
  await page.goto('/mortgage-calculators/monthly-payment/');
  await page.fill('#field-principal', '150000');
  await page.click('button[type="submit"]');

  const stored = await page.evaluate(() => ({
    local: window.localStorage.length,
    session: window.sessionStorage.length,
  }));
  expect(stored).toEqual({ local: 0, session: 0 });
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
