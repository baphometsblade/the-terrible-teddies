// The Pub Brawl door. Intents only. The view comes back from the edge function,
// and Realtime pushes the same projected row. A poll covers a dropped socket.

import { supabase, supabaseAnonKey, supabaseUrl } from '../../utils/supabaseClient.js';
import { POLL_MS } from './timing.js';

export { POLL_MS };

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

export function watchViews(userId, onPayload) {
  if (!userId || typeof supabase.channel !== 'function') return () => {};
  try {
    const channel = supabase.channel(`pvp-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pvp_views',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const next = payload?.new?.payload;
        if (next) onPayload(next);
      });
    channel.subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch { /* socket already gone */ }
    };
  } catch {
    return () => {};
  }
}
