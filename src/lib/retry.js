import { isTransportFailure } from './network.js';

// Reads that can be repeated. Writes that charge money, and account
// deletion, do not come through here: a retry of those can do the thing twice
// or hide that the first try already landed.

const RETRYABLE_STATUS = new Set([0, 408, 429, 500, 502, 503, 504]);

/**
 * Whether another try might get an answer. A refusal (4xx other than 408
 * and 429), a missing function, and a rate-limit from our own SQL are final.
 */
export function isRetryableError(error) {
  if (!error || typeof error !== 'object') return false;
  const code = String(error.code || '');
  if (code.startsWith('PT') || code === '42501' || code === 'PGRST301' || code === 'PGRST202') {
    return false;
  }
  const status = Number(error.status ?? error.statusCode ?? NaN);
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  if (RETRYABLE_STATUS.has(status)) return true;
  if (error.name === 'AbortError') return true;
  if (isTransportFailure(error)) return true;
  return false;
}

/** Delay before attempt `n` (0 is the first retry), in ms, plus a little jitter. */
export function backoffMs(attempt, random = Math.random) {
  const n = Math.max(0, Number(attempt) || 0);
  const base = Math.min(4000, 300 * (2 ** n));
  const roll = typeof random === 'function' ? random() : 0;
  const jitter = Math.floor((Number.isFinite(roll) ? roll : 0) * 150);
  return base + jitter;
}

const defaultSleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * Call `fn` until it returns something that is not a retryable failure, or
 * the attempts run out. `fn` may return a supabase-shaped `{ data, error }`
 * or throw. The last answer is returned either way, so the caller can show it.
 */
export async function withRetry(fn, {
  attempts = 3,
  sleep = defaultSleep,
  random = Math.random,
  onFailure = null,
} = {}) {
  const total = Math.max(1, attempts);
  let last = { data: null, error: { message: 'no attempt', code: '' } };
  for (let i = 0; i < total; i += 1) {
    try {
      const result = await fn();
      if (result && typeof result === 'object' && result.error && isRetryableError(result.error)) {
        last = result;
      } else {
        return result;
      }
    } catch (error) {
      last = { data: null, error };
      if (!isRetryableError(error)) return last;
    }
    if (typeof onFailure === 'function') onFailure(last.error);
    if (i < total - 1) await sleep(backoffMs(i, random));
  }
  return last;
}
