import { supabase, supabaseAnonKey, supabaseUrl } from '../../utils/supabaseClient.js';

async function post(body) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || supabaseAnonKey;
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/replay`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: supabaseAnonKey,
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    return await response.json().catch(() => ({ ok: false, error: 'server' }));
  } catch {
    return { ok: false, error: 'unreachable' };
  }
}

export const saveReplay = (log) => post({ op: 'save', log });
export const loadReplay = ({ id, code } = {}) => post({ op: 'open', id: id || null, code: code || '' });
export const listReplays = () => post({ op: 'mine' });
export const feedReplays = () => post({ op: 'feed' });
export const replayForMatch = (matchId) => post({ op: 'for-match', matchId });
export const starReplay = (id, on) => post({ op: 'star', id, on });
export const shareReplay = (id, privacy) => post({ op: 'share', id, privacy });

let listener = null;

export function onReplayOpen(fn) {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

export function openReplay(target) {
  listener?.(target);
}
