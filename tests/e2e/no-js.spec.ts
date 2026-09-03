import { expect, test } from '@playwright/test';

/**
 * With JavaScript disabled the site must still be useful, not merely present.
 * A prefilled page has to show its result in the static HTML, and every piece
 * of context a reader needs to judge that result has to be there too.
 */
test.describe('without JavaScript', () => {
  test('a global calculator still shows a worked result', async ({ page }) => {
    await page.goto('/mortgage-calculators/monthly-payment/');
    await expect(page.locator('[data-headline] .headline__value')).not.toBeEmpty();
    await expect(page.locator('table.data').first()).toBeVisible();
  });

  test('the amortisation schedule is in the static HTML', async ({ page }) => {
    await page.goto('/mortgage-calculators/monthly-payment/');
    const rows = page.locator('table.data tbody tr');
    expect(await rows.count()).toBeGreaterThan(10);
  });

  test('a prefilled salary page still carries its explanation and sources', async ({ page }) => {
    await page.goto('/uk/salary/50000-after-tax/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What this assumes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Official sources' })).toBeVisible();
  });

  test('the form is a real form that can still be submitted', async ({ page }) => {
    await page.goto('/mortgage-calculators/monthly-payment/');
    const form = page.locator('form[data-calculator]');
    await expect(form).toHaveAttribute('method', 'get');
    await expect(form.locator('button[type="submit"]')).toBeVisible();
  });

  test('navigation and legal pages are reachable', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'How it works' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'How these calculators work',
    );
  });
});
