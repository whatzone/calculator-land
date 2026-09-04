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

/**
 * Both themes are checked. They are separate designs with separate palettes,
 * not one derived from the other, so passing in light says nothing about dark.
 */
for (const scheme of ['light', 'dark'] as const) {
  for (const template of TEMPLATES) {
    test(`${template.name} has no accessibility violations in the ${scheme} theme`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(template.path);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(
        results.violations.map(
          (violation) =>
            `${violation.id}: ${violation.help} — first at ${violation.nodes[0]?.target.join(' ')}`,
        ),
      ).toEqual([]);
    });
  }
}

test('the theme toggle switches the theme and the choice survives navigation', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');

  const toggle = page.locator('[data-theme-toggle]');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-label', /dark/i);

  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-label', /light/i);

  // Applied before paint on the next page, not after a flash of the other theme.
  await page.goto('/methodology/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

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
