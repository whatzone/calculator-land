/**
 * Progressive enhancement for calculator forms.
 *
 * The page already works before this file loads: the form is a real GET form
 * and, on a prefilled salary page, the result is in the static HTML. This script
 * only upgrades the experience — it recalculates in place, keeps the URL
 * shareable, and announces the new figure to screen readers.
 *
 * Two things it deliberately does not do:
 *  - it never sends an entered figure anywhere, including to analytics;
 *  - it never rewrites the URL into something crawlable. Query parameters are
 *    for sharing; the canonical link always points at the clean tool page.
 */
import type Big from 'big.js';
import { money } from '../lib/calculations/common/money.ts';
import { amortise, compareOverpayment } from '../lib/calculations/global/mortgage.ts';
import { convertHourly } from '../lib/calculations/global/hourly.ts';
import { runSalaryCalculation } from '../lib/calculations/common/engine.ts';
import { buildUkOptions } from '../lib/calculations/uk/options.ts';
import {
  buildIrelandOptions,
  irelandUnsupportedReasons,
} from '../lib/calculations/ireland/options.ts';
import { buildAustraliaOptions } from '../lib/calculations/australia/options.ts';
import { buildCanadaOptions } from '../lib/calculations/canada/options.ts';
import { unsupportedResult } from '../lib/calculations/common/engine.ts';
import {
  presentBonus,
  presentHourly,
  presentMortgage,
  presentNetToGross,
  presentOverpayment,
  presentPayRise,
  presentSalary,
} from '../lib/registry/presenters.ts';
import {
  calculateBonus,
  calculateNetToGross,
  calculatePayRise,
} from '../lib/calculations/common/scenarios.ts';
import { track } from '../lib/analytics/track.ts';
import type {
  CalculationContext,
  CalculationInput,
  CurrencyCode,
  JurisdictionCode,
  PayFrequency,
} from '../lib/calculations/common/types.ts';
import type { ResultViewModel } from '../lib/registry/types.ts';
import type { Ruleset } from '../lib/validation/ruleset-schema.ts';

type Values = Record<string, string | boolean>;

interface PageConfig {
  readonly calculatorId: string;
  readonly family: string;
  readonly jurisdiction: string;
  readonly context: CalculationContext;
  readonly isPrefilled: boolean;
  /**
   * Rulesets are embedded in the page as already-validated JSON. They were
   * checked by the schema at build time, so the browser does not need — and
   * does not ship — a validation library.
   */
  readonly rulesets: Record<string, Ruleset>;
}

function readConfig(): PageConfig | null {
  const node = document.getElementById('calculator-config');
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent) as PageConfig;
  } catch {
    return null;
  }
}

/** Parse a number the way a person types it: "£52,000" and "52 000" both work. */
function parseAmount(raw: string): Big | null {
  const cleaned = raw.replace(/[\s,£$€]/g, '').trim();
  if (cleaned === '') return null;
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  try {
    return money(cleaned);
  } catch {
    return null;
  }
}

interface FieldError {
  readonly name: string;
  readonly message: string;
}

function validate(form: HTMLFormElement): { values: Values; errors: FieldError[] } {
  const values: Values = {};
  const errors: FieldError[] = [];

  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) continue;
    if (!element.name) continue;

    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      values[element.name] = element.checked;
      continue;
    }

    const raw = element.value;
    const type = element.dataset['type'];

    if (type === 'money' || type === 'percent' || type === 'number') {
      const parsed = parseAmount(raw);
      if (parsed === null) {
        if (element.required || raw.trim() !== '') {
          errors.push({ name: element.name, message: 'Enter a number.' });
        }
        values[element.name] = '0';
        continue;
      }
      if (parsed.lt(0)) {
        errors.push({ name: element.name, message: 'This cannot be negative.' });
      }
      const min = element.dataset['min'];
      const max = element.dataset['max'];
      if (min !== undefined && parsed.lt(money(min))) {
        errors.push({ name: element.name, message: `Enter at least ${min}.` });
      }
      if (max !== undefined && parsed.gt(money(max))) {
        errors.push({
          name: element.name,
          message: `This is above the supported maximum of ${max}.`,
        });
      }
      values[element.name] = parsed.toString();
      continue;
    }

    values[element.name] = raw;
  }

  return { values, errors };
}

function showErrors(form: HTMLFormElement, errors: readonly FieldError[]): void {
  for (const node of Array.from(form.querySelectorAll<HTMLElement>('[data-error-for]'))) {
    node.hidden = true;
    node.textContent = '';
    const input = form.querySelector<HTMLElement>(`[name="${node.dataset['errorFor']}"]`);
    input?.removeAttribute('aria-invalid');
  }

  for (const error of errors) {
    const node = form.querySelector<HTMLElement>(`[data-error-for="${error.name}"]`);
    if (node) {
      node.textContent = error.message;
      node.hidden = false;
    }
    form.querySelector<HTMLElement>(`[name="${error.name}"]`)?.setAttribute('aria-invalid', 'true');
  }
}

function toNumber(values: Values, key: string, fallback: number): number {
  const parsed = Number(values[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildSalaryInput(config: PageConfig, values: Values, grossKey: string): CalculationInput {
  const jurisdiction = config.jurisdiction as JurisdictionCode;
  const region =
    jurisdiction === 'canada'
      ? String(values['province'] ?? 'ontario')
      : String(values['region'] ?? '');

  const profile: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === grossKey || key === 'payFrequency' || key === 'region') continue;
    if (key === 'taxPeriod') continue;
    profile[key] = value;
  }

  const period =
    typeof values['taxPeriod'] === 'string' && values['taxPeriod'].length > 0
      ? values['taxPeriod']
      : config.context.taxPeriodLabel;

  return {
    jurisdiction,
    ...(region ? { subJurisdiction: region } : {}),
    taxPeriod: period,
    grossAnnualIncome: money(values[grossKey] ? String(values[grossKey]) : '0'),
    payFrequency: (values['payFrequency'] as PayFrequency) ?? 'annual',
    profile,
  };
}

/**
 * Resolve the ruleset for this input from the page's embedded set.
 *
 * Keyed by region and tax year together. A miss returns null rather than
 * falling back to another year, because answering a request for 2024/25 with
 * this year's rules under last year's label would be worse than refusing.
 */
function resolveRuleset(config: PageConfig, input: CalculationInput): Ruleset | null {
  const region =
    input.subJurisdiction && input.subJurisdiction.length > 0 ? input.subJurisdiction : 'default';
  return config.rulesets[`${region}|${input.taxPeriod}`] ?? null;
}

function calculateSalaryInBrowser(config: PageConfig, input: CalculationInput) {
  const ruleset = resolveRuleset(config, input);
  if (!ruleset) {
    throw new Error(`No rules are held for the ${input.taxPeriod} tax year.`);
  }

  switch (config.jurisdiction as JurisdictionCode) {
    case 'uk':
      return runSalaryCalculation(buildUkOptions(ruleset, input));
    case 'ireland': {
      const unsupported = irelandUnsupportedReasons(input);
      if (unsupported.length > 0) return unsupportedResult(ruleset, input, unsupported);
      return runSalaryCalculation(buildIrelandOptions(ruleset, input));
    }
    case 'australia':
      return runSalaryCalculation(buildAustraliaOptions(ruleset, input));
    case 'canada': {
      const federal = config.rulesets[`federal|${input.taxPeriod}`];
      if (!federal)
        return unsupportedResult(ruleset, input, ['The federal ruleset is not available.']);
      return runSalaryCalculation(
        buildCanadaOptions(ruleset, federal, input, input.subJurisdiction ?? 'ontario'),
      );
    }
    default:
      return unsupportedResult(ruleset, input, ['This jurisdiction is not supported.']);
  }
}

function computeView(config: PageConfig, values: Values): ResultViewModel {
  const context = config.context;
  const calculate = (input: CalculationInput) => calculateSalaryInBrowser(config, input);

  switch (config.calculatorId) {
    case 'global-mortgage-payment':
      return presentMortgage(
        amortise({
          principal: money(String(values['principal'] ?? 0)),
          annualRatePercent: money(String(values['annualRatePercent'] ?? 0)),
          termYears: toNumber(values, 'termYears', 25),
        }),
        { ...context, currency: (values['currency'] as CurrencyCode) ?? context.currency },
      );

    case 'global-mortgage-overpayment':
      return presentOverpayment(
        compareOverpayment({
          principal: money(String(values['principal'] ?? 0)),
          annualRatePercent: money(String(values['annualRatePercent'] ?? 0)),
          termYears: toNumber(values, 'termYears', 25),
          monthlyOverpayment: money(String(values['monthlyOverpayment'] ?? 0)),
          lumpSum: money(String(values['lumpSum'] ?? 0)),
        }),
        { ...context, currency: (values['currency'] as CurrencyCode) ?? context.currency },
      );

    case 'global-hourly-to-salary':
      return presentHourly(
        convertHourly({
          amount: money(String(values['amount'] ?? 0)),
          inputFrequency: (values['inputFrequency'] as PayFrequency) ?? 'hourly',
          hoursPerWeek: toNumber(values, 'hoursPerWeek', 37.5),
          weeksPerYear: toNumber(values, 'weeksPerYear', 52),
          currency: (values['currency'] as CurrencyCode) ?? 'GBP',
        }),
        context,
      );

    default:
      break;
  }

  if (config.calculatorId.endsWith('-net-to-gross')) {
    const input = buildSalaryInput(config, values, 'targetNetAnnual');
    return presentNetToGross(
      calculateNetToGross(calculate, input, money(String(values['targetNetAnnual'] ?? 0))),
      context,
    );
  }
  if (config.calculatorId.endsWith('-bonus')) {
    const input = buildSalaryInput(config, values, 'grossAnnualIncome');
    return presentBonus(
      calculateBonus(calculate, input, money(String(values['bonusAmount'] ?? 0))),
      context,
    );
  }
  if (config.calculatorId.endsWith('-pay-rise')) {
    const input = buildSalaryInput(config, values, 'grossAnnualIncome');
    return presentPayRise(
      calculatePayRise(calculate, input, money(String(values['newGrossAnnual'] ?? 0))),
      context,
    );
  }

  return presentSalary(calculate(buildSalaryInput(config, values, 'grossAnnualIncome')), context);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderView(target: HTMLElement, view: ResultViewModel): void {
  const parts: string[] = ['<h2 id="result-heading" class="visually-hidden">Your result</h2>'];

  for (const notice of view.notices) {
    const title =
      notice.severity === 'unsupported'
        ? 'This calculation cannot be shown'
        : notice.severity === 'warning'
          ? 'Please note'
          : 'Good to know';
    parts.push(
      `<div class="notice notice--${notice.severity}"${notice.severity === 'unsupported' ? ' role="alert"' : ''}>` +
        `<p class="notice__title">${title}</p><p style="margin-bottom:0;">${escapeHtml(notice.message)}</p></div>`,
    );
  }

  if (view.supported) {
    parts.push(
      `<div class="headline" data-headline><p class="headline__label">${escapeHtml(view.headline.label)}</p>` +
        `<p class="headline__value">${escapeHtml(view.headline.value)}</p>` +
        (view.headline.caption
          ? `<p class="headline__caption">${escapeHtml(view.headline.caption)}</p>`
          : '') +
        '</div>',
    );

    const table = (
      caption: string,
      rows: readonly { label: string; value: string; detail?: string }[],
      headings?: { item: string; value: string },
    ) =>
      rows.length === 0
        ? ''
        : `<div class="card card--flush"><div class="table-scroll" tabindex="0" role="region" aria-label="${escapeHtml(caption)}, scrollable"><table class="data data--pairs"><caption>${caption}</caption>` +
          (headings
            ? `<thead><tr><th scope="col">${escapeHtml(headings.item)}</th><th scope="col">${escapeHtml(headings.value)}</th></tr></thead>`
            : '') +
          '<tbody>' +
          rows
            .map(
              (row) =>
                `<tr><th scope="row">${escapeHtml(row.label)}` +
                (row.detail ? `<span class="detail">${escapeHtml(row.detail)}</span>` : '') +
                `</th><td>${escapeHtml(row.value)}</td></tr>`,
            )
            .join('') +
          '</tbody></table></div></div>';

    parts.push(table('Summary', view.summaryRows));
    parts.push(table('Itemised breakdown', view.breakdownRows, view.breakdownHeadings));

    if (view.frequencyRows.length > 0) {
      parts.push(
        '<div><h3 class="panel-title">The same figure, by pay frequency</h3><dl class="freq-grid">' +
          view.frequencyRows
            .map(
              (row) =>
                `<div><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`,
            )
            .join('') +
          '</dl></div>',
      );
    }
  }

  target.innerHTML = parts.join('');
}

/**
 * Keep the provenance notice's tax year in step with the selector.
 *
 * The notice is server-rendered with the page's default year. Leaving it stale
 * after the reader picks another year would attach the wrong year's health
 * warning to the figure on screen.
 */
function syncProvenancePeriod(period: string | boolean | undefined): void {
  if (typeof period !== 'string' || period.length === 0) return;
  const node = document.querySelector('[data-provenance-period]');
  if (node) node.textContent = period;
}

function init(): void {
  const config = readConfig();
  const form = document.querySelector<HTMLFormElement>('form[data-calculator]');
  const result = document.querySelector<HTMLElement>('[data-result]');
  if (!config || !form || !result) return;

  const analyticsBase = {
    tool_id: config.calculatorId,
    calculator_family: config.family,
    jurisdiction: config.jurisdiction,
    tax_period: config.context.taxPeriodLabel,
    is_prefilled_page: config.isPrefilled ? 'true' : 'false',
  } as const;

  track('calculator_viewed', { ...analyticsBase, interaction_type: 'load' });

  // Politeness is set here rather than in the static markup so the pre-rendered
  // result is not announced on page load.
  result.setAttribute('aria-live', 'polite');
  result.setAttribute('aria-atomic', 'true');

  const resultBar = document.querySelector<HTMLElement>('[data-result-bar]');

  /**
   * The pinned summary on a phone.
   *
   * On a narrow screen the answer is a screen or more below the inputs, so
   * every adjustment means scrolling down to see what it did and back up to
   * change it again. This keeps the headline figure in view the whole time the
   * form is being used, and doubles as the way back to the full breakdown.
   */
  const syncResultBar = (view: ResultViewModel | null): void => {
    if (!resultBar) return;
    if (!view || !view.supported) {
      resultBar.hidden = true;
      return;
    }
    const label = resultBar.querySelector<HTMLElement>('[data-bar-label]');
    const value = resultBar.querySelector<HTMLElement>('[data-bar-value]');
    const caption = resultBar.querySelector<HTMLElement>('[data-bar-caption]');
    if (label) label.textContent = view.headline.label;
    if (value) value.textContent = view.headline.value;
    if (caption) caption.textContent = view.headline.caption ?? '';
    resultBar.hidden = false;
  };

  /**
   * Recalculation while the reader is still typing.
   *
   * `quiet` runs are the ones nobody asked for: they must not report a
   * validation error against a field that is simply half-entered, must not
   * rewrite the URL on every keystroke, and must not each count as a completed
   * calculation in analytics. Pressing the button is still the explicit
   * action, and still does all three.
   */
  const recalculate = (quiet: boolean): void => {
    const { values, errors } = validate(form);
    if (!quiet) showErrors(form, errors);

    if (errors.length > 0) {
      if (quiet) return;
      track('calculation_completed', {
        ...analyticsBase,
        interaction_type: 'submit',
        validation_state: 'invalid',
      });
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }

    document.querySelector<HTMLElement>('[data-print-wrap]')?.removeAttribute('hidden');

    let view: ResultViewModel;
    try {
      view = computeView(config, values);
    } catch (error) {
      // Never fail silently. A reader who presses Calculate and sees the page
      // sit there has no way to know whether it worked, and would reasonably
      // read the stale figure above as their answer.
      if (!quiet) {
        track('calculation_completed', {
          ...analyticsBase,
          interaction_type: 'submit',
          validation_state: 'unsupported',
        });
      }
      syncResultBar(null);
      renderView(result, {
        headline: { label: 'Result', value: 'Not available' },
        summaryRows: [],
        breakdownRows: [],
        frequencyRows: [],
        notices: [
          {
            severity: 'unsupported',
            message:
              error instanceof Error
                ? error.message
                : 'This calculation could not be completed in your browser.',
          },
        ],
        assumptions: [],
        supported: false,
      });
      return;
    }

    renderView(result, view);
    syncProvenancePeriod(values['taxPeriod']);
    syncResultBar(view);

    if (quiet) return;

    track('calculation_completed', {
      ...analyticsBase,
      interaction_type: 'submit',
      validation_state: view.supported ? 'valid' : 'unsupported',
    });

    // Keep the URL shareable without creating a crawlable variant: the page's
    // canonical link still points at the clean tool path.
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) params.set(key, String(value));
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    recalculate(false);
  });

  // Recalculate as the form is edited. Typing is debounced so a four-digit
  // salary is one calculation rather than four; changing a select or a
  // checkbox is a finished decision, so it runs at once.
  let pending: number | undefined;
  form.addEventListener('input', (event) => {
    if ((event.target as HTMLElement)?.tagName === 'SELECT') return;
    window.clearTimeout(pending);
    pending = window.setTimeout(() => recalculate(true), 250);
  });
  form.addEventListener('change', () => {
    window.clearTimeout(pending);
    recalculate(true);
  });

  // A prefilled page already shows a real answer, so the bar belongs there from
  // the start rather than only after the reader touches something.
  if (config.isPrefilled) recalculate(true);

  resultBar?.addEventListener('click', () => {
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    track('result_bar_opened', { ...analyticsBase, interaction_type: 'scroll' });
  });

  form.querySelector('[data-advanced]')?.addEventListener('toggle', (event) => {
    if ((event.currentTarget as HTMLDetailsElement).open) {
      track('advanced_options_opened', { ...analyticsBase, interaction_type: 'toggle' });
    }
  });

  form.querySelector('[name="payFrequency"]')?.addEventListener('change', () => {
    track('pay_frequency_changed', { ...analyticsBase, interaction_type: 'change' });
  });

  document.querySelector('[data-print]')?.addEventListener('click', () => {
    track('print_or_share_selected', { ...analyticsBase, interaction_type: 'print' });
    // A printed result should carry the working behind it. Sections folded
    // shut on screen are opened for the print and put back afterwards, because
    // a closed <details> is hidden by the browser and no print stylesheet can
    // reliably override that.
    const folded = Array.from(document.querySelectorAll<HTMLDetailsElement>('details:not([open])'));
    for (const item of folded) item.open = true;
    window.print();
    for (const item of folded) item.open = false;
  });

  for (const link of Array.from(document.querySelectorAll('a[href^="http"][rel*="nofollow"]'))) {
    link.addEventListener('click', () => {
      track('source_or_methodology_viewed', { ...analyticsBase, interaction_type: 'link' });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
