/*
 * Theme resolution and toggle.
 *
 * Loaded synchronously in the document head, before first paint, so a reader
 * who has chosen a theme never sees a flash of the other one. It is a separate
 * file rather than an inline script because the site's Content-Security-Policy
 * permits only same-origin scripts — deliberately, since there is no inline
 * executable script anywhere on the site.
 *
 * The single value stored is the theme name. Nothing else is ever written to
 * storage; calculator inputs never leave the page they were typed into.
 */
(function () {
  'use strict';

  var KEY = 'clearfigures-theme';

  function stored() {
    try {
      var value = window.localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      // Private browsing and blocked site data both throw here. Falling back to
      // the system preference is the correct behaviour, not an error.
      return null;
    }
  }

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function apply(theme) {
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // Runs immediately, before the body exists.
  apply(stored());

  function resolved() {
    var explicit = document.documentElement.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function label(button) {
    var next = resolved() === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    button.setAttribute('title', 'Switch to ' + next + ' theme');
  }

  function ready() {
    var button = document.querySelector('[data-theme-toggle]');
    if (!button) return;

    button.hidden = false;
    label(button);

    button.addEventListener('click', function () {
      var next = resolved() === 'dark' ? 'light' : 'dark';
      apply(next);
      try {
        window.localStorage.setItem(KEY, next);
      } catch {
        // The theme still applies for this page view; it just will not persist.
      }
      label(button);
    });

    // Follow the system if the reader has never chosen on this site.
    if (window.matchMedia) {
      var query = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if (!stored()) label(button);
      };
      if (query.addEventListener) query.addEventListener('change', onChange);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
