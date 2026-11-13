// What leaves the browser in a Sentry event. Loaded with the SDK (through
// src/lib/sentryClient.js), never on the first paint.

const stripUrl = (url) => {
  const text = String(url ?? '');
  try {
    const parsed = new URL(text, 'https://terribleteddies.vercel.app');
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return text.split('#')[0].split('?')[0];
  }
};

// "GET https://x.supabase.co/rest/v1/t?user_id=eq.<uuid>" keeps its method
// and path; the query (filters, ids) goes.
const stripQuery = (text) => (typeof text === 'string' ? text.replace(/[?#][^\s]*/g, '') : text);

// What a secret or a person looks like inside free text: an exception
// message, a breadcrumb, a console line. Each is replaced, not dropped, so the
// event still reads.
const REDACTIONS = [
  // A JWT (Supabase access tokens, the anon key): three base64url parts.
  [/\beyJ[\w-]{6,}\.[\w-]{6,}\.[\w-]{6,}/g, '[jwt]'],
  // An Authorization header value, wherever it is quoted.
  [/\b(Bearer|Basic)\s+[\w.~+/=-]{8,}/gi, '$1 [redacted]'],
  // key=value / "key": "value" pairs whose key names a secret.
  [/((?:access|refresh|id|auth)?[_-]?token|apikey|api[_-]?key|password|secret|authorization|code_verifier)(["']?\s*[:=]\s*["']?)[^\s"'&,;}]+/gi, '$1$2[redacted]'],
  // An email address.
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]'],
];

export function redactText(value) {
  if (typeof value !== 'string' || !value) return value;
  let out = value;
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  return out;
}

const SECRET_KEY = /^(authorization|cookie|set-cookie|apikey|api[_-]?key|x-api-key|password|secret|email|username|phone|ip_address|(access|refresh|id|auth)?[_-]?token)$/i;

// Every string in a JSON-ish value, redacted; every secret-named key dropped.
// Depth-limited, so a cyclic or huge `extra` cannot stall the page.
function deepRedact(value, depth = 0) {
  if (typeof value === 'string') return redactText(value);
  if (!value || typeof value !== 'object' || depth > 6) return value;
  if (Array.isArray(value)) return value.map((item) => deepRedact(item, depth + 1));
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) continue;
    out[key] = deepRedact(item, depth + 1);
  }
  return out;
}

export const scrubCrumb = (crumb) => {
  if (!crumb || typeof crumb !== 'object') return crumb;
  const next = { ...crumb };
  if (next.message) next.message = redactText(next.message);
  if (next.data && typeof next.data === 'object') {
    const data = deepRedact(next.data);
    if (data.url) data.url = stripUrl(data.url);
    if (data.to) data.to = stripUrl(data.to);
    if (data.from) data.from = stripUrl(data.from);
    next.data = data;
  }
  return next;
};

/** Drop anything that could identify a person or unlock an account before an event leaves the browser. */
export function scrubSentryEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const next = { ...event };
  delete next.user;
  delete next.server_name;
  if (next.request && typeof next.request === 'object') {
    const request = { ...next.request };
    delete request.cookies;
    delete request.headers;
    delete request.data;
    delete request.query_string;
    if (request.url) request.url = stripUrl(request.url);
    next.request = request;
  }
  if (next.message) {
    next.message = typeof next.message === 'string'
      ? redactText(next.message)
      : deepRedact(next.message);
  }
  if (next.logentry) next.logentry = deepRedact(next.logentry);
  if (next.exception && Array.isArray(next.exception.values)) {
    next.exception = {
      ...next.exception,
      values: next.exception.values.map((ex) => (ex && typeof ex === 'object'
        ? { ...ex, value: redactText(ex.value) }
        : ex)),
    };
  }
  if (next.extra) next.extra = deepRedact(next.extra);
  if (next.contexts) next.contexts = deepRedact(next.contexts);
  if (next.tags) next.tags = deepRedact(next.tags);
  if (Array.isArray(next.breadcrumbs)) next.breadcrumbs = next.breadcrumbs.map(scrubCrumb);
  if (Array.isArray(next.spans)) {
    next.spans = next.spans.map((span) => (span && typeof span === 'object'
      ? { ...span, description: stripQuery(redactText(span.description)), data: deepRedact(span.data) }
      : span));
  }
  if (next.transaction) next.transaction = stripQuery(redactText(next.transaction));
  return next;
}

