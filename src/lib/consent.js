// The cookie choice. One localStorage record per device, nothing about the
// person in it. Analytics (PostHog and the product events) start only when
// this says granted. A missing or unreadable record is "not yet", which is
// not a yes.

export const CONSENT_KEY = 'terrible-teddies-consent';
export const CONSENT_VERSION = 1;

export function consentRecord(choice, now) {
  if (choice !== 'granted' && choice !== 'denied') {
    throw new RangeError(`unknown consent choice: ${choice}`);
  }
  const at = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(at)) throw new RangeError(`not a time: ${now}`);
  return JSON.stringify({ v: CONSENT_VERSION, analytics: choice === 'granted', at });
}

/** 'granted' | 'denied' | 'unknown' */
export function parseConsent(raw) {
  if (typeof raw !== 'string') return 'unknown';
  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return 'unknown';
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) return 'unknown';
  if (record.v !== CONSENT_VERSION) return 'unknown';
  if (typeof record.analytics !== 'boolean') return 'unknown';
  if (typeof record.at !== 'number' || !Number.isFinite(record.at)) return 'unknown';
  return record.analytics ? 'granted' : 'denied';
}

const storageOf = (storage) => {
  if (storage !== undefined) return storage;
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export function readConsent(storage) {
  try {
    return parseConsent(storageOf(storage)?.getItem(CONSENT_KEY));
  } catch {
    return 'unknown';
  }
}

export function hasAnalyticsConsent(storage) {
  return readConsent(storage) === 'granted';
}

export function writeConsent(choice, now = Date.now(), storage) {
  const target = storageOf(storage);
  if (!target) return false;
  try {
    target.setItem(CONSENT_KEY, consentRecord(choice, now));
    return true;
  } catch {
    return false;
  }
}
