import { expect, test } from '@playwright/test';

/**
 * The mortgage calculator is the exemplar for interactive behaviour: it is
 * fully functional today, so it can be exercised end to end without depending
 * on tax data that has not been sourced.
 */
test.describe('mortgage payment calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mortgage-calculators/monthly-payment/');
  });

  test('shows a result in the static HTML before any interaction', async ({ page }) => {
    await expect(page.locator('[data-headline] .headline__value')).not.toBeEmpty();
  });

  test('recalculates in place without a page load', async ({ page }) => {
    const before = await page.locator('[data-headline] .headline__value').textContent();

    await page.fill('#field-principal', '300000');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-headline] .headline__value')).not.toHaveText(before ?? '');
    // A larger loan must produce a larger payment; this catches a wired-up form
    // that silently ignores its inputs.
    const after = await page.locator('[data-headline] .headline__value').textContent();
    expect(Number((after ?? '').replace(/[^\d.]/g, ''))).toBeGreaterThan(
      Number((before ?? '').replace(/[^\d.]/g, '')),
    );
  });

  test('announces the result to assistive technology', async ({ page }) => {
    await expect(page.locator('[data-result]')).toHaveAttribute('aria-live', 'polite');
  });

  test('reports invalid input rather than calculating on it', async ({ page }) => {
    await page.fill('#field-principal', 'not a number');
    await page.click('button[type="submit"]');

    const error = page.locator('[data-error-for="principal"]');
    await expect(error).toBeVisible();
    await expect(page.locator('#field-principal')).toHaveAttribute('aria-invalid', 'true');
  });

  test('refuses a negative amount', async ({ page }) => {
    await page.fill('#field-principal', '-5000');
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-error-for="principal"]')).toBeVisible();
  });

  test('accepts a figure typed with separators and a currency symbol', async ({ page }) => {
    await page.fill('#field-principal', '£250,000');
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-error-for="principal"]')).toBeHidden();
    await expect(page.locator('[data-headline] .headline__value')).not.toBeEmpty();
  });

  test('handles a zero interest rate without dividing by zero', async ({ page }) => {
    await page.fill('#field-principal', '120000');
    await page.fill('#field-annualRatePercent', '0');
    await page.fill('#field-termYears', '10');
    await page.click('button[type="submit"]');
    // 120,000 over 120 months is exactly 1,000 a month.
    await expect(page.locator('[data-headline] .headline__value')).toContainText('1,000');
  });

  test('keeps the shared URL pointing at the canonical page', async ({ page }) => {
    await page.fill('#field-principal', '275000');
    await page.click('button[type="submit"]');
    expect(page.url()).toContain('?');

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).not.toContain('?');
    expect(canonical).toContain('/mortgage-calculators/monthly-payment/');
  });

  test('is operable by keyboard alone', async ({ page }) => {
    await page.locator('#field-principal').focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('180000');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-headline] .headline__value')).not.toBeEmpty();
  });
});

test.describe('the site as a whole', () => {
  test('holds tax calculator pages out of the index', async ({ page }) => {
    await page.goto('/uk/salary-calculator/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
    await expect(page.locator('.notice--unsupported')).toBeVisible();
  });

  test('explains, rather than guesses, on an unsourced salary page', async ({ page }) => {
    await page.goto('/uk/salary/50000-after-tax/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('after tax');
    await expect(page.locator('.notice--unsupported').first()).toContainText(
      'not been verified against the official source',
    );
  });

  test('serves exactly one h1 and one canonical per page', async ({ page }) => {
    for (const path of [
      '/',
      '/calculators/',
      '/methodology/',
      '/mortgage-calculators/overpayment/',
    ]) {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    }
  });

  test('reserves ad space without loading any ad script', async ({ page }) => {
    await page.goto('/mortgage-calculators/monthly-payment/');
    const slot = page.locator('[data-ad-slot="post-result"]');
    await expect(slot).toHaveAttribute('data-ad-live', 'false');

    const scripts = await page
      .locator('script[src]')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src));
    for (const src of scripts) {
      expect(src).not.toContain('googlesyndication');
      expect(src).not.toContain('doubleclick');
    }
  });

  test('returns a usable 404 page', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist/');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('does not exist');
  });
});

test.describe('responsive layout', () => {
  for (const width of [320, 375, 768, 1280]) {
    test(`does not scroll horizontally at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/mortgage-calculators/monthly-payment/');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test('keeps interactive targets at least 44px tall', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/mortgage-calculators/monthly-payment/');

    for (const selector of ['button[type="submit"]', '#field-principal', '#field-currency']) {
      const box = await page.locator(selector).boundingBox();
      expect(box?.height ?? 0, selector).toBeGreaterThanOrEqual(43.5);
    }
  });
});
