import { supabase } from '@/utils/supabaseClient';
import { noteFailure, noteSuccess } from './supabaseHealth.js';
import { isRetryableError, withRetry } from './retry.js';

// Feature flags. Clients may read the table and nothing else (the migration
// grants SELECT and no write). A missing table, or a bad row, falls back to
// the caller's default so a flag can never be the thing that breaks boot.

const KEY_RE = /^[a-z][a-z0-9_]{0,40}$/;
const CACHE_KEY = 'terrible-teddies-flags';

let cache = null;
let loaded = false;
let inflight = null;

export function parseFlagRows(rows) {
  const flags = {};
  if (!Array.isArray(rows)) return flags;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    if (typeof row.key !== 'string' || !KEY_RE.test(row.key)) continue;
    if (typeof row.enabled !== 'boolean') continue;
    flags[row.key] = row.enabled;
  }
  return flags;
}

const storageOf = () => {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export function readCachedFlags() {
  if (cache) return cache;
  try {
    const raw = storageOf()?.getItem(CACHE_KEY);
    cache = parseFlagRows(raw ? Object.entries(JSON.parse(raw)).map(([key, enabled]) => ({ key, enabled })) : []);
  } catch {
    cache = {};
  }
  return cache;
}

export function flagEnabled(key, fallback = false) {
  const flags = readCachedFlags();
  if (!flags || !Object.prototype.hasOwnProperty.call(flags, key)) return fallback;
  return flags[key] === true;
}

export function loadFeatureFlags(client = supabase) {
  if (loaded) return Promise.resolve(cache || {});
  if (inflight) return inflight;
  inflight = withRetry(
    () => client.from('feature_flags').select('key, enabled'),
    { onFailure: noteFailure },
  ).then((result) => {
    inflight = null;
    if (!result || result.error) {
      if (result?.error && isRetryableError(result.error)) noteFailure();
      return readCachedFlags();
    }
    cache = parseFlagRows(result.data);
    loaded = true;
    noteSuccess();
    try {
      storageOf()?.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // The memory copy is enough for this page.
    }
    return cache;
  }).catch(() => {
    inflight = null;
    noteFailure();
    return readCachedFlags();
  });
  return inflight;
}

export function resetFlagsForTests() {
  cache = null;
  loaded = false;
  inflight = null;
}
