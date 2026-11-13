// The Pub Brawl door. Intents only. The view comes back from the edge function,
// and Realtime pushes the same projected row. A poll covers a dropped socket.
// This module is lazy (PubBrawl only) and is one of the importers vite
// resolves to the real @supabase/realtime-js.

import { RealtimeClient } from '@supabase/realtime-js';
import { supabase, supabaseAnonKey, supabaseUrl } from '../../utils/supabaseClient.js';
import {
  LIVE_POLL_MS, POLL_MS, QUEUE_LIVE_POLL_MS, QUEUE_POLL_MS, pollDelay,
} from './timing.js';

export {
  LIVE_POLL_MS, POLL_MS, QUEUE_LIVE_POLL_MS, QUEUE_POLL_MS, pollDelay,
};

export async function pvpPost(name, body) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'auth' };
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: supabaseAnonKey,
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body || {}),
    });
    const payload = await response.json().catch(() => ({ ok: false, error: 'server' }));
    return payload && typeof payload === 'object' ? payload : { ok: false, error: 'server' };
  } catch {
    return { ok: false, error: 'unreachable' };
  }
}

/** UUID that iOS 15 can build. randomUUID arrived in 15.4. */
export function newActionId() {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') return cryptoRef.randomUUID();
  const bytes = new Uint8Array(16);
  cryptoRef.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const realtimeUrl = (base) => {
  const url = new URL('realtime/v1', base);
  url.protocol = url.protocol.replace('http', 'ws');
  return url.href;
};

/**
 * Push this player's projected view over Realtime. The entry client keeps the
 * Realtime stub (see vite.config.js), so Pub Brawl opens its own socket, the
 * same way presence and the push runtime do. The poll in PubBrawl covers a
 * socket that never opens. `onLive(true)` once the channel is subscribed and
 * `onLive(false)` if it drops, so the poll can back off and come back.
 * Returns a stop function.
 */
export function watchViews(userId, onPayload, onLive) {
  if (!userId) return () => {};
  let stopped = false;
  let client = null;
  let authSub = null;
  const stop = () => {
    stopped = true;
    try { authSub?.unsubscribe(); } catch { /* already gone */ }
    try { client?.disconnect(); } catch { /* socket already gone */ }
    client = null;
  };
  const run = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (stopped || !token) return;
    client = new RealtimeClient(realtimeUrl(supabaseUrl), {
      params: { apikey: supabaseAnonKey },
    });
    await client.setAuth(token);
    if (stopped) {
      stop();
      return;
    }
    // A long night outlives the hour a session token lasts.
    const watched = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && client) client.setAuth(session.access_token).catch(() => {});
    });
    authSub = watched?.data?.subscription || null;
    client.channel(`pvp-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pvp_views',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const next = payload?.new?.payload;
        if (next) onPayload(next);
      })
      .subscribe((status) => {
        if (!stopped && onLive) onLive(status === 'SUBSCRIBED');
      });
  };
  run().catch(stop);
  return stop;
}
