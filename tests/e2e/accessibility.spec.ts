import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * One representative page per template. Running axe over all 146 pages would be
 * slow and would mostly re-test the same markup; a template is the unit that
 * actually varies.
 */
const TEMPLATES = [
  { name: 'home', path: '/' },
  { name: 'family hub', path: '/salary-tax-calculators/' },
  { name: 'country hub', path: '/uk/' },
  { name: 'directory', path: '/calculators/' },
  { name: 'global calculator', path: '/mortgage-calculators/monthly-payment/' },
  { name: 'tax calculator', path: '/uk/salary-calculator/' },
  { name: 'salary result', path: '/uk/salary/50000-after-tax/' },
  { name: 'content', path: '/methodology/' },
  { name: 'legal', path: '/privacy/' },
  { name: '404', path: '/404.html' },
];

for (const template of TEMPLATES) {
  test(`${template.name} has no automatically detectable accessibility violations`, async ({
    page,
  }) => {
    await page.goto(template.path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });
}

test('remains usable at 200% zoom', async ({ page }) => {
  // Emulating 200% zoom by halving the viewport is the standard proxy for
  // WCAG 1.4.4: the page must reflow rather than require horizontal scrolling.
  await page.setViewportSize({ width: 640, height: 512 });
  await page.goto('/mortgage-calculators/monthly-payment/');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('exposes a skip link as the first focusable element', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveClass(/skip-link/);
});
