// Friends-only presence. The entry chunk keeps the Realtime stub. This module
// is loaded after sign-in and is the one importer vite resolves to the real
// @supabase/realtime-js (see vite.config.js).
//
// Each player publishes on `presence:<their id>`, a private channel. The
// SELECT policy calls can_see_presence, so a stranger's socket is refused and
// an appear-offline player publishes nothing. Status is online, in a match,
// or at the bar.

import { RealtimeClient } from '@supabase/realtime-js';
import { supabase, supabaseAnonKey, supabaseUrl } from '../supabase.js';
import { PRESENCE_EVENT, readPresence, setPresenceHidden } from './friends.js';

const realtimeUrl = (base) => {
  const url = new URL('realtime/v1', base);
  url.protocol = url.protocol.replace('http', 'ws');
  return url.href;
};

const friendIdsOf = (rows) => (
  Array.isArray(rows) ? rows.map((row) => row && row.user_id).filter(Boolean) : []
);

let snapshot = {};
const listeners = new Set();

/** Latest status by user id. `online`, `match`, or `bar`. */
export const presenceNow = () => snapshot;

export const subscribePresence = (fn) => {
  listeners.add(fn);
  fn(snapshot);
  return () => listeners.delete(fn);
};

const emit = (next) => {
  snapshot = next;
  listeners.forEach((fn) => fn(snapshot));
};

/**
 * Publish our status and listen to friends. Returns a stop function.
 * A missing migration, or a socket that never opens, leaves the screen as it
 * was: pals show as out.
 */
export function watchPresence({ userId, accessToken, readStatus }) {
  let stopped = false;
  let client = null;
  let timer = 0;
  const channels = [];
  const stop = () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener(PRESENCE_EVENT, push);
    clearInterval(timer);
    channels.splice(0).forEach((channel) => {
      try { client?.removeChannel(channel); } catch { /* already gone */ }
    });
    try { client?.disconnect(); } catch { /* ignore */ }
    client = null;
  };

  let last = null;
  let own = null;
  const push = () => {
    if (!own || stopped) return;
    const status = readStatus();
    if (status === last) return;
    last = status;
    if (!status) {
      own.untrack().catch(() => {});
      return;
    }
    own.track({ status }).catch(() => {});
  };
  const onVisible = () => { if (document.visibilityState === 'visible') push(); };

  const run = async () => {
    const [{ data: friends, error: friendsError }, { data: links, error: linksError }] = await Promise.all([
      supabase.rpc('list_friends'),
      supabase.rpc('my_links'),
    ]);
    if (stopped) return;
    if (friendsError || linksError || !Array.isArray(friends)) return;
    if (links && links.ok) setPresenceHidden(Boolean(links.appear_offline));

    client = new RealtimeClient(realtimeUrl(supabaseUrl), {
      params: { apikey: supabaseAnonKey },
    });
    await client.setAuth(accessToken);
    if (stopped) {
      try { client.disconnect(); } catch { /* the caller already gave up */ }
      client = null;
      return;
    }

    const publishState = () => {
      const merged = {};
      for (let i = 0; i < channels.length; i += 1) {
        try {
          Object.assign(merged, readPresence(channels[i].presenceState()));
        } catch { /* a channel that has not synced yet */ }
      }
      emit(merged);
    };

    const listen = (id, track) => {
      const channel = client.channel(`presence:${id}`, {
        config: { private: true, presence: { key: id } },
      });
      channels.push(channel);
      channel.on('presence', { event: 'sync' }, publishState);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED' && track) push();
      });
      return channel;
    };

    own = listen(userId, true);
    for (const id of friendIdsOf(friends)) {
      if (id !== userId) listen(id, false);
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(PRESENCE_EVENT, push);
    timer = setInterval(push, 5000);
  };

  run().catch(stop);
  return stop;
}

export { readPresence };
