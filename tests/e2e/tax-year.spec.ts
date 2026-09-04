import { expect, test } from '@playwright/test';

/**
 * Tax year selection.
 *
 * The rules differ between years, so the calculator has to answer with the
 * rules of the year the reader asked for — and refuse rather than substitute
 * when it has none for that year.
 */
test.describe('choosing a tax year', () => {
  test('offers the current year first, labelled as current', async ({ page }) => {
    await page.goto('/uk/salary-calculator/');
    const select = page.locator('#field-taxPeriod');
    await expect(select).toBeVisible();

    const first = select.locator('option').first();
    await expect(first).toHaveText(/current/);
    await expect(select).toHaveValue((await first.getAttribute('value')) ?? '');
  });

  test('marks previous years as previous', async ({ page }) => {
    await page.goto('/uk/salary-calculator/');
    const options = await page.locator('#field-taxPeriod option').allTextContents();
    expect(options.length).toBeGreaterThan(1);
    expect(options.slice(1).every((text) => /previous year/.test(text))).toBe(true);
  });

  test('recalculates against the chosen year', async ({ page }) => {
    // Scotland changed its starter and basic band edges between 2024/25 and
    // 2025/26, so the same salary gives a different answer in each.
    await page.goto('/uk/salary-calculator/');
    await page.selectOption('#field-region', 'scotland');
    await page.fill('#field-grossAnnualIncome', '30000');

    await page.selectOption('#field-taxPeriod', '2025/26');
    await page.click('button[type="submit"]');
    const newer = await page.locator('[data-headline] .headline__value').textContent();

    await page.selectOption('#field-taxPeriod', '2024/25');
    await page.click('button[type="submit"]');
    const older = await page.locator('[data-headline] .headline__value').textContent();

    expect(newer).not.toBe(older);
  });

  test('keeps the same answer where a year genuinely did not change', async ({ page }) => {
    // The rest-of-UK thresholds are frozen, so these years must agree. This is
    // the counterpart to the test above: it catches a selector that appears to
    // work but is really just returning the default every time.
    await page.goto('/uk/salary-calculator/');
    await page.fill('#field-grossAnnualIncome', '30000');

    await page.selectOption('#field-taxPeriod', '2026/27');
    await page.click('button[type="submit"]');
    const current = await page.locator('[data-headline] .headline__value').textContent();

    await page.selectOption('#field-taxPeriod', '2024/25');
    await page.click('button[type="submit"]');
    const previous = await page.locator('[data-headline] .headline__value').textContent();

    expect(previous).toBe(current);
  });

  test('states the chosen year on the result and in the health warning', async ({ page }) => {
    await page.goto('/uk/salary-calculator/');
    await page.fill('#field-grossAnnualIncome', '30000');
    await page.selectOption('#field-taxPeriod', '2024/25');
    await page.click('button[type="submit"]');

    // Both have to move: the result names the year that produced it, and the
    // health warning must not attach the wrong year's caveat to the figure.
    await expect(page.locator('[data-result]')).toContainText('2024/25');
    await expect(page.locator('[data-provenance="unverified"]')).toContainText('2024/25');
  });

  test('refuses a tax year it holds no rules for, rather than substituting one', async ({
    page,
  }) => {
    await page.goto('/uk/salary-calculator/');
    await page.fill('#field-grossAnnualIncome', '30000');

    // Force an unheld year past the selector, as a stale shared link would.
    await page.evaluate(() => {
      const select = document.querySelector<HTMLSelectElement>('#field-taxPeriod');
      if (!select) return;
      const option = document.createElement('option');
      option.value = '1999/00';
      select.append(option);
      select.value = '1999/00';
    });
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-result]')).toContainText('No rules are held');
    await expect(page.locator('[data-result]')).not.toContainText('Take-home pay');
  });
});
