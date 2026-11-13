// Error monitoring. The SDK is fetched only in a production build whose
// VITE_SENTRY_DSN is a real DSN, and only after the age door has let the device in (DoorGate calls
// initializeSentry from the same place it starts analytics). A deploy with
// no DSN never downloads it. Source maps are built hidden and moved out of
// dist/ so the site does not serve them; see vite.config.js.

import { noteFailure } from './supabaseHealth.js';

export const SENTRY_CONNECT_SRC = Object.freeze([
  'https://*.ingest.sentry.io',
  'https://*.ingest.us.sentry.io',
]);

const DSN_RE = /^https:\/\/[0-9a-f]+@[\w.-]+\/\d+$/i;

const queue = [];
const MAX_QUEUE = 10;
let client = null;
let starting = false;

export function readSentryDsn(env = import.meta.env) {
  const raw = String(env?.VITE_SENTRY_DSN ?? '').trim();
  return DSN_RE.test(raw) ? raw : '';
}

// Release and environment are baked in by vite.config.js from Vercel's build
// variables (the commit SHA, and production / preview).
export const sentryRelease = (env = import.meta.env) => String(env?.VITE_SENTRY_RELEASE ?? '').trim() || undefined;
export const sentryEnvironment = (env = import.meta.env) => String(env?.VITE_SENTRY_ENVIRONMENT ?? '').trim() || 'production';

// Monitoring runs in production builds only: dev and the test suites never
// report, whatever the env holds.
export const sentryEnabled = (env = import.meta.env) => Boolean(env?.PROD) && Boolean(readSentryDsn(env));

export const SENTRY_TEST_PARAM = 'tt-sentry-test';

// A deliberate, invisible test error, so a deploy can be checked end to end:
// load the site with ?tt-sentry-test=1. It is captured, never thrown (the
// player sees nothing), once per page, and the parameter is taken out of the
// address bar. A named function so the stack shows a readable frame.
function sentryDeliberateTestError() {
  return new Error('Deliberate Sentry test error (tt-sentry-test)');
}

function reportTestErrorOnce(Sentry) {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(SENTRY_TEST_PARAM) !== '1') return;
    url.searchParams.delete(SENTRY_TEST_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    Sentry.withScope((scope) => {
      scope.setTag('deliberate_test', 'true');
      scope.setLevel('error');
      Sentry.captureException(sentryDeliberateTestError());
    });
  } catch {
    // A test hook never breaks the page.
  }
}

const flush = () => {
  if (!client) return;
  for (const [error, context] of queue.splice(0)) {
    client.captureException(error, context ? { tags: { context } } : undefined);
  }
};

export function initializeSentry() {
  if (client || starting || typeof window === 'undefined') return;
  if (!sentryEnabled()) return;
  const dsn = readSentryDsn();
  starting = true;
  import('./sentryClient.js')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        release: sentryRelease(),
        environment: sentryEnvironment(),
        sendDefaultPii: false,
        // Performance: one page load in twenty. No trace headers go to any
        // other origin (Supabase, PostHog), so no CORS preflight changes.
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 0.05,
        tracePropagationTargets: [],
        // Session Replay is not loaded at all (privacy and quota).
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        maxBreadcrumbs: 50,
        beforeSend: Sentry.scrubSentryEvent,
        beforeSendTransaction: Sentry.scrubSentryEvent,
        beforeBreadcrumb: Sentry.scrubCrumb,
        ignoreErrors: [
          // Browser noise with no stack and nothing to fix.
          'ResizeObserver loop limit exceeded',
          'ResizeObserver loop completed with undelivered notifications',
        ],
      });
      client = Sentry;
      flush();
      reportTestErrorOnce(Sentry);
    })
    .catch((error) => {
      starting = false;
      noteFailure();
      console.error('Failed to start error monitoring:', error);
    });
}

export function captureSentry(error, context) {
  try {
    if (!sentryEnabled()) return;
    if (client) {
      client.captureException(error, context ? { tags: { context } } : undefined);
      return;
    }
    if (queue.length < MAX_QUEUE) queue.push([error, context]);
    initializeSentry();
  } catch (err) {
    console.error('Failed to report an error:', err);
  }
}
