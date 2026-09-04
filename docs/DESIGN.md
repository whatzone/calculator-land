# Design language

A calm, modern financial utility. The reference points are a well-made public
information service and a considered financial product — not a fintech landing
page. Everything below exists to keep numbers legible and claims honest.

## Principles

1. **The answer is the hero.** On any calculator page the largest thing is the
   figure the reader came for. Everything else is support.
2. **Two themes, both designed.** Light and dark are separate palettes, not one
   derived from the other. Both are tested independently.
3. **Colour carries meaning or nothing.** One soft blue for interaction and key
   data. Green and red only where they mean something. No decorative colour.
4. **Restraint over effect.** No gradients, no glassmorphism, no motion beyond a
   120ms state change. Depth comes from a hairline and a very soft shadow.
5. **Nothing visual-only.** Every chart segment appears as a table row.
6. **The phone is the design target.** Every layout decision is made for a
   390px screen first and adapted upward, not the other way round. See below.

## Colour

| Role           | Light                    | Dark                 |
| -------------- | ------------------------ | -------------------- |
| Page ground    | `#faf8f5` warm off-white | `#13161b` blue-black |
| Surface        | `#ffffff`                | `#191d23`            |
| Raised / inset | `#f3f0eb`                | `#212630`            |
| Primary ink    | `#1b1e23`                | `#e7e9ed`            |
| Secondary ink  | `#4c525b`                | `#b0b7c2`            |
| Tertiary ink   | `#666c76`                | `#949ba6`            |
| Accent         | `#2b5fb0`                | `#7fa9ee`            |
| Positive       | `#1c6b45`                | `#5fc292`            |
| Negative       | `#a33227`                | `#f0918a`            |

The dark ground is deliberately blue-black rather than `#000`. Pure black behind
light text produces halation that makes long columns of figures tiring, which is
most of what this site is.

Every ink and surface pair was measured before it was written. The tertiary ink
went through two candidates: the first measured 4.24:1 against the tinted
surfaces and was replaced. Nothing in the palette sits below 4.5:1 against any
surface it can appear on.

## Type

A system sans throughout — nothing to download, nothing to shift, no request to
a font host the CSP would have to allow.

The editorial quality comes from scale, tracking and measure rather than from a
typeface. An earlier draft set lede paragraphs in a system serif; it rendered as
Times on most machines and read dated rather than considered, so it was removed.

| Role          | Size                                    | Notes                                  |
| ------------- | --------------------------------------- | -------------------------------------- |
| Result figure | `clamp(2.75rem, 2rem + 3.6vw, 4.25rem)` | 600 weight, −0.035em, tabular          |
| Page title    | `clamp(1.9rem, 1.5rem + 1.5vw, 2.5rem)` | 600 weight, −0.032em                   |
| Lede          | 1.375rem                                | 400 weight, −0.012em, secondary ink    |
| Body          | 1.0625rem                               | 1.65 line height, 66ch measure         |
| Label         | 0.75rem                                 | 640 weight, uppercase, 0.08em tracking |

Every number anywhere on the site is `tabular-nums`, so figures in a column line
up and a changing result does not jitter.

## Space and shape

A 4px scale from `--s1` (4px) to `--s9` (96px). Radii are gentle: 6px on small
controls, 10px on inputs and buttons, 14px on cards. Shadows are almost absent —
`--shadow-sm` for a resting card, `--shadow` reserved for the calculator form,
which is the one element that should sit above the page.

## Components

**The calculator form** is the visual focus of its page: a raised card with the
site's only real shadow, generous field spacing, and a full-width primary
button. Field help text sits visibly beneath its control, never behind a
tooltip — in a tax calculator the caveat is the product.

**The result** opens with a 2px accent rule, a small uppercase label, and the
figure at display size in accent blue. Below it: summary, chart, itemised
breakdown, then the same figure by pay frequency.

**Tables** have no vertical rules and no zebra striping. Hairline row
separators, uppercase column labels, right-aligned tabular figures.

**The chart** is a single 10px stacked bar in one hue stepped by lightness, so
it reads as one quantity divided rather than as unrelated categories. Segment
colours are spread across the full ramp rather than taken in sequence, because
two adjacent steps are nearly indistinguishable. Take-home pay is the one
segment with a semantic colour.

**Advertising slots** render as labelled, dashed, correctly sized empty boxes.
Reserving the space now means enabling ads later cannot shift the layout, and it
keeps every placement visible during design review.

## Theme switching

`public/theme-init.js` runs synchronously in the head and applies a stored
preference before first paint, so a chosen theme never flashes the other one. It
is a separate file rather than an inline script because the CSP permits
same-origin scripts only — there is no inline executable script on the site.

The toggle is `hidden` in the markup and revealed by that script, so a reader
without JavaScript is not offered a control that cannot work. With no stored
choice the site follows the operating system.

The theme name is the only value this site ever writes to storage, and only when
the reader explicitly asks. `tests/e2e/privacy.spec.ts` asserts both halves of
that: using a calculator writes nothing, and choosing a theme writes exactly one
key containing exactly one word.

## What is enforced rather than trusted

- `tests/integration/design-tokens.test.ts` fails the build if a component
  references a custom property that does not exist. This was written after a
  token rename left `var(--space-5)` behind, which silently resolved to nothing
  and removed the margin around every ad placement — a missing custom property
  does not throw, warn, or fail a build on its own.
- The same file checks every colour token exists in both themes, that no dark
  surface is pure black, and that the palette carries no dead tokens.
- `tests/e2e/accessibility.spec.ts` runs axe over ten templates in **both**
  themes — twenty runs. Passing in light says nothing about dark.
- `tests/e2e/mobile.spec.ts` asserts the mobile rules as behaviour rather than
  as intent: the first input inside half a screen, the result bar present
  below 1040px and absent above it, stacked tables not scrolling sideways,
  every navigation and footer link at 44px, and the bar never covering the
  last line of the page.
- Budgets: 5.8 KB of CSS and 15.6 KB of JavaScript, gzipped, against 30 KB and
  60 KB.

## Mobile first, in specifics

The site was built desktop-first and adapted down, and it showed. Measured on a
390×844 screen before the change: 55% of the first screen spent before the
first input, the answer 1,616px down, five navigation links in a strip that
could only hold three with nothing to say the rest were there, 27 tap targets
under 44px on the home page alone, and every result table scrolling sideways.

The rules now, in the order they were applied:

**Nothing in the header is pinned.** On a phone the element worth permanent
space is the answer, not the navigation. The header scrolls away; the nav
becomes a scroll strip masked at both edges so the links past the fold read as
"more this way" rather than as the end of the list.

**The answer is pinned instead.** `ResultBar.astro` fixes the headline figure
to the bottom of the screen from the moment there is one. It is the same view
model the result panel renders — not a second source of truth — and it doubles
as the jump to the full breakdown. Hidden by default in the markup, so a reader
without JavaScript never sees an empty bar.

**The form recalculates as it is edited.** Typing is debounced at 250ms;
changing a select runs at once. A recalculation nobody asked for is _quiet_: it
does not report a validation error against a half-typed figure, does not
rewrite the URL on every keystroke, and does not count as a completed
calculation in analytics. Pressing the button still does all three.

**Two-column tables stack.** A label-and-value row on a 358px screen wraps its
label to four lines and strands the figure in a column of its own; stacked, the
label runs full width and the figure sits below it, larger. Only tables marked
`data--pairs` — applying it to a three-column listing made that page 11,418px
tall, which is how the class came to exist.

**44px targets, with one deliberate exception.** Navigation and footer links
take the full 44px. Breadcrumbs take the 24px AA minimum: the trail is one line
of small text near the top of the page, and 44px there costs more screen than
the trail is worth.

**Text inputs never drop below 16px.** iOS Safari zooms the page on focus below
that and does not zoom back out. Selects have no such behaviour, so they take
the smaller size when a long option label would otherwise be cut mid-word.

Result on the same screen: first input at 415px, answer visible while typing
without any scroll at all.
