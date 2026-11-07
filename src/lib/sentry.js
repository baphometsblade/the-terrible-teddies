// Error monitoring. The SDK is fetched only when VITE_SENTRY_DSN is a real
// DSN, and only after the age door has let the device in (DoorGate calls
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

const stripUrl = (url) => {
  const text = String(url ?? '');
  try {
    const parsed = new URL(text, 'https://terribleteddies.vercel.app');
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return text.split('#')[0].split('?')[0];
  }
};

/** Drop anything that could identify a person before an event leaves the browser. */
export function scrubSentryEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const next = { ...event };
  delete next.user;
  if (next.request && typeof next.request === 'object') {
    const request = { ...next.request };
    delete request.cookies;
    delete request.headers;
    delete request.data;
    if (request.url) request.url = stripUrl(request.url);
    next.request = request;
  }
  if (Array.isArray(next.breadcrumbs)) {
    next.breadcrumbs = next.breadcrumbs.map((crumb) => {
      if (!crumb || typeof crumb !== 'object') return crumb;
      const data = crumb.data && typeof crumb.data === 'object' ? { ...crumb.data } : crumb.data;
      if (data && typeof data === 'object') {
        if (data.url) data.url = stripUrl(data.url);
        delete data.email;
        delete data.username;
      }
      return { ...crumb, data };
    });
  }
  return next;
}

const flush = () => {
  if (!client) return;
  for (const [error, context] of queue.splice(0)) {
    client.captureException(error, context ? { tags: { context } } : undefined);
  }
};

export function initializeSentry() {
  if (client || starting || typeof window === 'undefined') return;
  const dsn = readSentryDsn();
  if (!dsn) return;
  starting = true;
  import('@sentry/react')
    .then((mod) => {
      const Sentry = mod.default && mod.default.init ? mod.default : mod;
      Sentry.init({
        dsn,
        environment: import.meta.env?.MODE || 'production',
        sendDefaultPii: false,
        autoSessionTracking: false,
        tracesSampleRate: 0,
        beforeSend: scrubSentryEvent,
      });
      client = Sentry;
      flush();
    })
    .catch((error) => {
      starting = false;
      noteFailure();
      console.error('Failed to start error monitoring:', error);
    });
}

export function captureSentry(error, context) {
  try {
    if (!readSentryDsn()) return;
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
