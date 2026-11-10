// Limited card seasons. Whether a season is in packs is the server's answer
// (open_card_pack, which reads the database clock). This module never
// compares the laptop clock to starts_at or ends_at to decide that. The
// timestamps are only for the countdown, anchored to the server's "now".

import { supabase } from '@/utils/supabaseClient';
import { BUNDLED_SEASONS, bundledSeason } from '@/data/seasonsCatalog';
import { NAUGHTY_CREW } from '@/data/naughtyList';

export const VAULT_BADGE = 'Vaulted';
export const VAULT_LINE = 'returns some day, maybe';

const PREVIEW_KEY = 'terrible-teddies-season-preview';

const listeners = new Set();

let snapshot = {
  serverNow: null,
  seasons: [],
  loaded: false,
  previewId: '',
};

const readStorage = () => {
  try {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(PREVIEW_KEY) || '';
  } catch {
    return '';
  }
};

const writeStorage = (id) => {
  try {
    if (typeof localStorage === 'undefined') return;
    if (id) localStorage.setItem(PREVIEW_KEY, id);
    else localStorage.removeItem(PREVIEW_KEY);
  } catch {
    // Private mode. The memory copy still previews this page.
  }
};

const emit = () => {
  snapshot = { ...snapshot, previewId: snapshot.previewId };
  listeners.forEach((fn) => fn());
};

export const getSeasonSnapshot = () => snapshot;

export const subscribeSeasons = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const STATUSES = new Set(['active', 'upcoming', 'ended']);

const asSeason = (row) => {
  if (!row || typeof row.id !== 'string' || !row.id) return null;
  if (!STATUSES.has(row.status)) return null;
  const ids = Array.isArray(row.card_ids) ? row.card_ids.filter((id) => typeof id === 'string' && id) : [];
  const boost = Number(row.pack_weight_boost);
  return {
    id: row.id,
    name: typeof row.name === 'string' && row.name ? row.name : row.id,
    theme: typeof row.theme === 'string' ? row.theme : '',
    starts_at: typeof row.starts_at === 'string' ? row.starts_at : '',
    ends_at: typeof row.ends_at === 'string' ? row.ends_at : '',
    card_ids: ids,
    pack_weight_boost: Number.isFinite(boost) && boost > 0 ? boost : 1,
    status: row.status,
  };
};

/** Trust the server's status. A bad row is dropped, never repaired from the clock. */
export const normalizeServerSnapshot = (data) => {
  const seasons = Array.isArray(data?.seasons) ? data.seasons.map(asSeason).filter(Boolean) : [];
  return {
    serverNow: typeof data?.server_now === 'string' ? data.server_now : null,
    seasons,
    loaded: true,
    previewId: readStorage(),
  };
};

export const applySeasonSnapshot = (next) => {
  snapshot = {
    serverNow: next?.serverNow ?? null,
    seasons: Array.isArray(next?.seasons) ? next.seasons : [],
    loaded: next?.loaded !== false,
    previewId: typeof next?.previewId === 'string' ? next.previewId : readStorage(),
  };
  emit();
  return snapshot;
};

export const resetSeasonSnapshot = () => {
  snapshot = { serverNow: null, seasons: [], loaded: false, previewId: readStorage() };
  emit();
};

export const readSeasonPreview = () => snapshot.previewId || readStorage();

/** Staff and dev preview. Cosmetic until the server says the season is active. */
export const setSeasonPreview = (id) => {
  const next = typeof id === 'string' ? id : '';
  writeStorage(next);
  snapshot = { ...snapshot, previewId: next };
  emit();
  return next;
};

/**
 * Seasons the floor should show. A preview paints an upcoming or ended row
 * as 'preview' without changing the copy the pack roller reads.
 */
export const visibleSeasons = (snap = snapshot) => {
  const preview = snap.previewId || '';
  const rows = (snap.seasons || []).map((season) => (
    preview && season.id === preview && season.status !== 'active'
      ? { ...season, status: 'preview', serverStatus: season.status }
      : season
  ));
  if (preview && !rows.some((season) => season.id === preview)) {
    const bundled = bundledSeason(preview);
    if (bundled) rows.push({ ...bundled, status: 'preview', serverStatus: 'unloaded' });
  }
  return rows;
};

/**
 * Seasons whose cards may be pulled. `status: 'active'` is the server's
 * word. Preview joins only when the caller explicitly allows it (dev and
 * the unit suite). Production packs ignore the preview flag.
 */
export const seasonsForPacks = (snap = snapshot, { allowPreview = false } = {}) => {
  const preview = allowPreview ? (snap.previewId || '') : '';
  const rows = (snap.seasons || []).map((season) => (
    preview && season.id === preview && season.status !== 'active'
      ? { ...season, status: 'preview' }
      : season
  ));
  if (allowPreview && preview && !rows.some((season) => season.id === preview)) {
    const bundled = bundledSeason(preview);
    if (bundled) rows.push({ ...bundled, status: 'preview' });
  }
  return rows.filter((season) => season.status === 'active' || (allowPreview && season.status === 'preview'));
};

export const seasonOnTheFloor = (snap = snapshot) => (
  visibleSeasons(snap).find((season) => season.status === 'active' || season.status === 'preview') || null
);

/** The nightly crew while the party is up, otherwise null so the usual rotation stands. */
export const seasonCrew = (snap = snapshot) => (seasonOnTheFloor(snap) ? NAUGHTY_CREW : null);

export const vaultOf = (cardId, seasons) => {
  const row = (seasons || []).find((season) => season.status === 'ended' && (season.card_ids || []).includes(cardId));
  if (!row) return null;
  return { badge: VAULT_BADGE, line: VAULT_LINE, seasonId: row.id };
};

/** Owned copies always show. Unowned seasonal cards show once the server has opened or closed them, or a preview is on. */
export const showInAlbum = (cardId, owned, seasons, bundledIds) => {
  if (owned) return true;
  if (!bundledIds.has(cardId)) return true;
  const row = (seasons || []).find((season) => (season.card_ids || []).includes(cardId));
  if (!row) return false;
  return row.status === 'active' || row.status === 'ended' || row.status === 'preview';
};

/**
 * Milliseconds left, from the server's now plus time passed since the
 * answer arrived. `elapsedMs` is a monotonic clock, not the laptop's date.
 */
export const countdownMs = (season, serverNow, elapsedMs = 0) => {
  const end = Date.parse(season?.ends_at || '');
  const server = Date.parse(serverNow || '');
  if (!Number.isFinite(end) || !Number.isFinite(server)) return null;
  return Math.max(0, end - server - Math.max(0, elapsedMs));
};

export const formatCountdown = (ms) => {
  if (ms == null) return '';
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
};

export const BUNDLED = BUNDLED_SEASONS;

/**
 * Ask the pack-opening RPC what is in season. A missing function, a bad
 * answer, or a network failure leaves the seasonal pool empty: packs stay
 * evergreen, and the laptop clock is not consulted.
 */
export async function refreshPackSeasons(client = supabase) {
  try {
    const { data, error } = await client.rpc('open_card_pack');
    if (error || !data || typeof data !== 'object') {
      // Keep a snapshot we already trusted. The first answer, if it never
      // comes, stays empty so the laptop clock cannot open the pool.
      if (!snapshot.loaded) {
        applySeasonSnapshot({ serverNow: null, seasons: [], loaded: false, previewId: readStorage() });
      }
      return getSeasonSnapshot();
    }
    return applySeasonSnapshot(normalizeServerSnapshot(data));
  } catch {
    if (!snapshot.loaded) {
      applySeasonSnapshot({ serverNow: null, seasons: [], loaded: false, previewId: readStorage() });
    }
    return getSeasonSnapshot();
  }
}
