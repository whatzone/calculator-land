import { test, expect } from '@playwright/test';

/**
 * Mobile behaviour that only exists on a narrow screen.
 *
 * These run under every project, so each one first states the width it is
 * about. The desktop projects are not skipped — a rule that is supposed to
 * apply below 1040px should be asserted not to leak above it, and two of these
 * do exactly that.
 */

const PHONE = { width: 390, height: 844 };

test.describe('the pinned result bar', () => {
  test('appears once there is a figure, and carries it', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/uk/salary-calculator/');

    const bar = page.locator('[data-result-bar]');
    // Nothing has been entered, so there is nothing to pin.
    await expect(bar).toBeHidden();

    await page.fill('#field-grossAnnualIncome', '50000');
    await expect(bar).toBeVisible();

    // £50,000 with a £12,570 allowance leaves £39,520 — the same figure the
    // full result panel shows, because both read one view model.
    await expect(bar.locator('[data-bar-value]')).toContainText('39,520');
    await expect(page.locator('[data-headline] .headline__value')).toContainText('39,520');
  });

  test('stays in view while the form is scrolled', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/uk/salary-calculator/');
    await page.fill('#field-grossAnnualIncome', '50000');

    const bar = page.locator('[data-result-bar]');
    await expect(bar).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 1400));
    await expect(bar).toBeInViewport();
  });

  test('is not shown on a wide screen, where the answer is already beside the form', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/uk/salary-calculator/');
    await page.fill('#field-grossAnnualIncome', '50000');

    await expect(page.locator('[data-headline] .headline__value')).toContainText('39,520');
    await expect(page.locator('[data-result-bar]')).toBeHidden();
  });

  test('does not sit on top of the last thing on the page', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/uk/salary-calculator/');
    await page.fill('#field-grossAnnualIncome', '50000');
    await expect(page.locator('[data-result-bar]')).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(
      () =>
        Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) < 2,
    );
    const clear = await page.evaluate(() => {
      const bar = document.querySelector('[data-result-bar]')!.getBoundingClientRect();
      const last = document
        .querySelector('.site-footer__legal p:last-of-type')!
        .getBoundingClientRect();
      return bar.top - last.bottom;
    });
    expect(clear).toBeGreaterThanOrEqual(0);
  });
});

test.describe('recalculating without pressing a button', () => {
  test('updates the answer as the salary is typed', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/uk/salary-calculator/');

    // £30,000: taxable £17,430 at 20% is £3,486 of income tax, and
    // £17,430 at 8% is £1,394.40 of National Insurance, leaving £25,119.60.
    await page.fill('#field-grossAnnualIncome', '30000');
    await expect(page.locator('[data-headline] .headline__value')).toContainText('25,120');

    // £60,000: £7,540 + £3,892 of income tax, and £3,016 + £194.60 of
    // National Insurance, leaving £45,357.40.
    await page.fill('#field-grossAnnualIncome', '60000');
    await expect(page.locator('[data-headline] .headline__value')).toContainText('45,357');
  });

  test('follows a changed region without a submit', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/uk/salary-calculator/');
    await page.fill('#field-grossAnnualIncome', '50000');
    await expect(page.locator('[data-headline] .headline__value')).toContainText('39,520');

    await page.selectOption('#field-region', 'scotland');
    // Scotland taxes this income differently, so the figure must move.
    await expect(page.locator('[data-headline] .headline__value')).not.toContainText('39,520');
  });

  test('leaves the URL alone until the reader asks for the result', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/uk/salary-calculator/');

    await page.fill('#field-grossAnnualIncome', '50000');
    await expect(page.locator('[data-headline] .headline__value')).toContainText('39,520');
    // Rewriting history on every keystroke would fill the reader's back button
    // with half-typed salaries.
    expect(page.url()).not.toContain('?');

    await page.click('button[type="submit"]');
    expect(page.url()).toContain('?');
  });

  test('does not shout about a half-typed figure', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/uk/salary-calculator/');

    // A lone minus sign is not a salary, but it is a reasonable thing to have
    // typed one keystroke ago.
    await page.fill('#field-grossAnnualIncome', '-');
    await page.waitForTimeout(400);
    await expect(page.locator('#field-grossAnnualIncome')).not.toHaveAttribute(
      'aria-invalid',
      'true',
    );

    // Asking for it explicitly is a different matter.
    await page.click('button[type="submit"]');
    await expect(page.locator('#field-grossAnnualIncome')).toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe('reading a result on a phone', () => {
  test('stacks the summary rows instead of scrolling them sideways', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/uk/salary/50000-after-tax/');

    const overflow = await page.evaluate(() => {
      const region = document.querySelector('.table-scroll')!;
      return region.scrollWidth - region.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('spends less than half the first screen before the first input', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/uk/salary-calculator/');

    const top = await page.evaluate(() => {
      const field = document.querySelector('#field-grossAnnualIncome')!;
      return field.getBoundingClientRect().top + window.scrollY;
    });
    expect(top).toBeLessThan(PHONE.height / 2);
  });

  test('gives every navigation and footer link a thumb-sized target', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/uk/salary-calculator/');

    const small = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.site-nav a, .site-footer li a'))
        .map((el) => ({ text: el.textContent?.trim() ?? '', h: el.getBoundingClientRect().height }))
        .filter((item) => item.h > 0 && item.h < 44),
    );
    expect(small).toEqual([]);
  });
});
