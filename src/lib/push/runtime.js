// While the game is open: tell the server whether this tab is focused, report
// presence so friends can be pinged, and toast inbox rows over Realtime.
// Loaded after sign-in. The entry client keeps the Realtime stub.

import { RealtimeClient } from '@supabase/realtime-js';
import { supabase, supabaseAnonKey, supabaseUrl } from '../supabase.js';

const realtimeUrl = (base) => {
  const url = new URL('realtime/v1', base);
  url.protocol = url.protocol.replace('http', 'ws');
  return url.href;
};

const focusedNow = () => {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible';
};

/**
 * @param {{ userId: string, accessToken: string, readStatus: () => string|null, onToast: (row: object) => void }} args
 */
export function startPushRuntime({ userId, accessToken, readStatus, onToast }) {
  let stopped = false;
  let client = null;
  let timer = 0;
  let lastStatus = '';
  const stop = () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
    try { client?.disconnect(); } catch { /* already gone */ }
    client = null;
  };

  const reportFocus = () => {
    supabase.rpc('set_tab_focused', { p_focused: focusedNow() }).then(() => {}, () => {});
  };

  const reportStatus = () => {
    const next = readStatus() || 'offline';
    if (next === lastStatus) return;
    lastStatus = next;
    supabase.rpc('report_presence', { p_status: next }).then(() => {}, () => {});
  };

  const onVisible = () => {
    reportFocus();
    reportStatus();
  };

  const run = async () => {
    const prefs = await supabase.rpc('my_notification_prefs');
    if (stopped) return;
    if (prefs.error || !prefs.data || prefs.data.ok !== true) return;
    reportFocus();
    reportStatus();
    document.addEventListener('visibilitychange', onVisible);
    timer = setInterval(() => {
      if (stopped) return;
      reportFocus();
      reportStatus();
    }, 60000);
    client = new RealtimeClient(realtimeUrl(supabaseUrl), {
      params: { apikey: supabaseAnonKey },
    });
    await client.setAuth(accessToken);
    if (stopped) {
      try { client.disconnect(); } catch { /* caller already stopped */ }
      return;
    }
    const channel = client.channel(`inbox:${userId}`);
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'push_inbox',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      const row = payload?.new || payload?.record;
      if (row?.title && onToast) onToast(row);
    });
    channel.subscribe();
  };

  run().catch(stop);
  return stop;
}
