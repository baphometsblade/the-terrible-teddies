import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Whether the deploy is wired up. The app gates on this and shows a clear
// configuration screen — throwing here instead would crash the whole module
// graph at import time and white-screen the app before React can render.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — set them in your ' +
    'environment (see .env.example). Running with a non-functional client.'
  );
}

// Use a syntactically-valid placeholder when unconfigured so createClient
// doesn't throw at import; real calls will fail and the UI gates them off.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

// Resolve whose account we are acting on.
//
// Every helper below used to open with `await supabase.auth.getUser()`. In
// supabase-js v2 that is a real, uncached network round-trip (GoTrueClient
// issues GET /auth/v1/user every call) — so a single login cost four
// sequential requests, two of which re-fetched a user object the caller was
// already holding. Callers that have the id (App has session.uid; the
// battle board has the store's ownerUserId) pass it and skip the trip
// entirely; callers that don't still work exactly as before.
const resolveUserId = async (userId) => {
  if (userId) return userId;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
};

export const fetchServerGemBalance = async (userId = null) => {
  const uid = await resolveUserId(userId);
  if (!uid) return null;

  const { data, error } = await supabase
    .from('user_gems')
    .select('gems')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) {
    console.error('Error fetching gem balance:', error);
    return null;
  }
  return data?.gems ?? null;
};

export const ensurePlayerProfile = async (username = null, userId = null) => {
  const uid = await resolveUserId(userId);
  if (!uid) return null;

  const { error } = await supabase.rpc('upsert_player_profile', {
    p_user_id: uid,
    p_username: username,
  });

  if (error) {
    console.error('Error creating player profile:', error);
    return null;
  }
  return true;
};

// Set the player's public display name (the leaderboard reads players.username).
// Server-side validation lives in set_player_username; this returns the stored
// name on success or null on failure so the caller can keep the local store in
// step only when the write actually landed.
export const setPlayerUsername = async (username, userId = null) => {
  const uid = await resolveUserId(userId);
  if (!uid) return null;

  const { data, error } = await supabase.rpc('set_player_username', {
    p_username: username,
  });
  if (error) {
    console.error('Error setting username:', error);
    return null;
  }
  return data ?? username;
};

export const syncBattleResult = async (won, damageDealt = 0, healingDone = 0, coinsEarned = 0, userId = null) => {
  const uid = await resolveUserId(userId);
  if (!uid) return null;

  const { error } = await supabase.rpc('sync_battle_result', {
    p_user_id: uid,
    p_won: won,
    p_damage_dealt: damageDealt,
    p_healing_done: healingDone,
    p_coins_earned: coinsEarned,
  });

  if (error) {
    console.error('Error syncing battle result:', error);
    return null;
  }
  return true;
};

export const syncPlayerLevel = async (level, xp, userId = null) => {
  const uid = await resolveUserId(userId);
  if (!uid) return null;

  const { error } = await supabase.rpc('sync_player_level', {
    p_user_id: uid,
    p_level: level,
    p_xp: xp,
  });

  if (error) {
    console.error('Error syncing player level:', error);
    return null;
  }
  return true;
};

// ---------------------------------------------------------------------------
// Cloud saves (supabase/migrations/20261023000000_cloud_saves_and_rank.sql).
// These hand back supabase-js's own { data, error, status } untouched:
// src/lib/cloudSave.js decides what a 404, a 413 or a dropped connection
// means, and is tested on exactly these shapes.
// ---------------------------------------------------------------------------

// A request that never answers would hold the cloud save's queue forever.
const RPC_TIMEOUT_MS = 15_000;

// The answer for a call made with no session to make it with: an ordinary
// failure, retried with back-off like a dropped connection.
export const NO_SESSION = { data: null, error: { code: 'NO_SESSION', message: 'No session to send with' }, status: 0 };

const callRpc = async (fn, args = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    // With the user's own token, or not at all. Once a token has expired and
    // its refresh has failed, auth-js holds that failure for a minute and
    // getSession() reads no session; supabase-js then sends the anon key as
    // the bearer, the migration refuses anon (insufficient_privilege), and
    // that refusal turned the cloud save off for the rest of the session,
    // with Settings saying "Saved on this device only". A phone unlocked
    // after an hour on a weak signal is enough. The header is set here, so
    // the token checked is the token sent (fetchWithAuth keeps it).
    const { data: { session } = {} } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return NO_SESSION;
    const { data, error, status } = await supabase.rpc(fn, args)
      .setHeader('Authorization', `Bearer ${token}`)
      .abortSignal(controller.signal);
    return { data, error, status };
  } catch (err) {
    // supabase-js resolves network failures as an error with status 0; this
    // catches anything that throws instead, and is told apart the same way.
    return { data: null, error: { message: String(err?.message || err), code: '' }, status: 0 };
  } finally {
    clearTimeout(timer);
  }
};

export const getPlayerSave = () => callRpc('get_player_save');

export const putPlayerSave = (save, baseRev) =>
  callRpc('put_player_save', { p_save: save, p_base_rev: baseRev });

// The same write as a keepalive fetch, for when the page is going away (the
// tab hidden, or pagehide): the browser completes a keepalive request after
// the page has gone, and supabase-js's fetch does not ask for one. It takes
// the access token in hand because a page that is unloading has no time to
// await a session read. Browsers cap keepalive bodies at 64 KiB, so a larger
// save goes as an ordinary request, which may not finish.
const REST_URL = `${String(supabaseUrl || 'https://placeholder.supabase.co').replace(/\/+$/, '')}/rest/v1`;
const KEEPALIVE_MAX_BYTES = 60_000;

export const putPlayerSaveKeepalive = async (save, baseRev, accessToken) => {
  const body = JSON.stringify({ p_save: save, p_base_rev: baseRev });
  try {
    const res = await fetch(`${REST_URL}/rpc/put_player_save`, {
      method: 'POST',
      keepalive: body.length <= KEEPALIVE_MAX_BYTES,
      headers: {
        apikey: supabaseAnonKey || 'placeholder-anon-key',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { data: null, error: { message: json?.message || res.statusText, code: json?.code || '' }, status: res.status };
    }
    return { data: json, error: null, status: res.status };
  } catch (err) {
    return { data: null, error: { message: String(err?.message || err), code: '' }, status: 0 };
  }
};

export const fetchPlayerProfile = async (userId = null) => {
  const uid = await resolveUserId(userId);
  if (!uid) return null;

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) {
    console.error('Error fetching player profile:', error);
    return null;
  }
  return data;
};
