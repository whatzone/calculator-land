/**
 * Design token integrity.
 *
 * Written after a real bug: renaming the spacing scale left one component
 * referencing `var(--space-5)`, which silently resolved to nothing and removed
 * the margin around every advertising placement. A missing custom property does
 * not throw, does not warn, and does not fail a build — it just quietly drops
 * the declaration, so it needs a test rather than vigilance.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokensCss = readFileSync('src/styles/tokens.css', 'utf8');
const globalCss = readFileSync('src/styles/global.css', 'utf8');

/** Custom properties declared in the token file. */
const declared = new Set(
  [...tokensCss.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1] as string),
);

/**
 * Properties a file declares locally, which are legitimate to reference there.
 * Two forms count: an ordinary `--name:` declaration, and Astro's
 * `define:vars={{ name }}`, which generates `--name` on a wrapper element.
 */
function locallyDeclared(source: string): Set<string> {
  const names = new Set(
    [...source.matchAll(/(--[A-Za-z0-9-]+)\s*:/g)].map((match) => match[1] as string),
  );

  for (const block of source.matchAll(/define:vars=\{\{([\s\S]*?)\}\}/g)) {
    for (const key of (block[1] ?? '').matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g)) {
      names.add(`--${key[1]}`);
    }
  }

  return names;
}

function referenced(source: string): string[] {
  return [...source.matchAll(/var\((--[A-Za-z0-9-]+)/g)].map((match) => match[1] as string);
}

const sourceFiles = [
  ...globSync('src/components/**/*.astro'),
  ...globSync('src/layouts/**/*.astro'),
  ...globSync('src/pages/**/*.astro'),
  ...globSync('src/scripts/**/*.ts'),
];

describe('design tokens', () => {
  it('declares every property the stylesheet references', () => {
    const missing = [...new Set(referenced(globalCss))].filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
  });

  it('declares every property a component references', () => {
    const problems: string[] = [];

    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      const local = locallyDeclared(source);
      for (const name of new Set(referenced(source))) {
        if (!declared.has(name) && !local.has(name)) {
          problems.push(`${file}: var(${name})`);
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it('defines every colour token in both themes', () => {
    // A token present in light but missing from dark would leave that value
    // frozen at its light-theme colour when the theme flips.
    const darkBlock = tokensCss.slice(tokensCss.indexOf("[data-theme='dark']"));
    const lightBlock = tokensCss.slice(tokensCss.indexOf(':root {'), tokensCss.indexOf('@media'));

    const colourish = (block: string) =>
      new Set(
        [...block.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*(#|rgb|color-mix)/gm)].map(
          (match) => match[1] as string,
        ),
      );

    const light = colourish(lightBlock);
    const dark = colourish(darkBlock);
    const missingFromDark = [...light].filter((name) => !dark.has(name));

    expect(missingFromDark).toEqual([]);
  });

  it('uses no pure black or pure white as a dark-theme surface', () => {
    // Pure black behind light text produces harsh halation, which is tiring
    // across long columns of figures.
    const darkBlock = tokensCss.slice(tokensCss.indexOf("[data-theme='dark']"));
    const surfaces = [...darkBlock.matchAll(/--(?:bg|surface[-\d]*)\s*:\s*(#[0-9a-f]{6})/gi)].map(
      (match) => (match[1] as string).toLowerCase(),
    );

    expect(surfaces.length).toBeGreaterThan(0);
    expect(surfaces).not.toContain('#000000');
  });

  it('keeps no dead tokens in the palette', () => {
    const usedAnywhere = new Set([
      ...referenced(globalCss),
      ...sourceFiles.flatMap((file) => referenced(readFileSync(file, 'utf8'))),
      ...referenced(tokensCss),
    ]);

    // Scale steps are declared as a complete set even where a step is not
    // currently used; an incomplete scale is worse than an unused step.
    const scalePrefixes = ['--s', '--text-', '--series-', '--leading-', '--tracking-', '--radius'];
    const dead = [...declared].filter(
      (name) => !usedAnywhere.has(name) && !scalePrefixes.some((prefix) => name.startsWith(prefix)),
    );

    expect(dead).toEqual([]);
  });
});
