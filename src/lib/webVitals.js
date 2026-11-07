import { hasAnalyticsConsent } from './consent.js';

// The budgets Lighthouse CI asserts, and the same numbers the in-page
// reporter compares a live visit against. Milliseconds, except CLS which is
// the unitless layout-shift score. Keep lighthouserc.json in step with the
// two audits it can measure without a click (LCP and CLS); platform.test.js
// fails if they drift.
export const WEB_VITALS_BUDGET = Object.freeze({
  LCP: 4000,
  INP: 200,
  CLS: 0.1,
  FCP: 2500,
  TTFB: 1800,
});

export function budgetFor(metric) {
  const value = WEB_VITALS_BUDGET[metric];
  return typeof value === 'number' ? value : null;
}

export function overBudget(metric, value) {
  const cap = budgetFor(metric);
  if (cap == null || typeof value !== 'number' || !Number.isFinite(value)) return false;
  return value > cap;
}

let started = false;

/** Measure once consent and the product-analytics switch both say yes. */
export function startWebVitals(track) {
  if (started || typeof window === 'undefined') return;
  if (!hasAnalyticsConsent()) return;
  if (typeof track !== 'function') return;
  started = true;
  import('web-vitals')
    .then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      const report = (metric) => {
        const value = metric.name === 'CLS'
          ? Math.round(metric.value * 1000) / 1000
          : Math.round(metric.value);
        track('web_vital', {
          metric: metric.name,
          value,
          over_budget: overBudget(metric.name, metric.value),
        });
      };
      onLCP(report);
      onINP(report);
      onCLS(report);
      onFCP(report);
      onTTFB(report);
    })
    .catch(() => {
      started = false;
    });
}

/** Test hook. */
export function resetWebVitalsForTests() {
  started = false;
}
