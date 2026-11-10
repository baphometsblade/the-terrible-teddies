// What may become a ping. The SQL in
// supabase/migrations/20261110170000_push_notifications.sql is the authority
// at enqueue time. These copies exist so a test can fail when the two drift,
// and so the edge function can describe a row it is about to send.
//
// Live PvP is not on this branch. A turn ping is `push_your_turn(match, recipient, actor)`,
// which is not granted to clients. The match function calls it after a turn.

export const FRIEND_ONLINE_DEBOUNCE_MS = 4 * 60 * 60 * 1000;
export const PUSH_HOURLY_CAP = 10;
export const FOCUS_FRESH_MS = 2 * 60 * 1000;
export const QUIET_START_HOUR = 2;
export const QUIET_END_HOUR = 8;

export const PUSH_KINDS = Object.freeze([
  'friends_online',
  'challenge_live',
  'challenge_ghost',
  'accept_request',
  'accept_challenge',
  'your_turn',
]);

const TYPE_OF = Object.freeze({
  friends_online: 'friends_online',
  challenge_live: 'challenges',
  challenge_ghost: 'challenges',
  accept_request: 'challenges',
  accept_challenge: 'challenges',
  your_turn: 'your_turn',
});

/** Local hour, 0–23. `tzOffsetMinutes` is minutes east of UTC. */
export const localHour = (now, tzOffsetMinutes = 0) => {
  const offset = Number(tzOffsetMinutes) || 0;
  const local = new Date(now.getTime() + offset * 60000);
  return local.getUTCHours();
};

export const inQuietHours = (now, prefs) => {
  if (!prefs?.quietEnabled) return false;
  const start = Number(prefs.quietStart);
  const end = Number(prefs.quietEnd);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start === end) return false;
  const hour = localHour(now, prefs.tzOffsetMinutes);
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
};

const typeOn = (kind, prefs) => {
  const key = TYPE_OF[kind];
  if (!key || !prefs) return false;
  return prefs[key] !== false;
};

/**
 * @returns {{ inbox: boolean, web: boolean, reason: string }}
 * Inbox is the in-app toast. Web is the push. Quiet hours and a focused
 * tab skip the push and keep the toast. A debounce or a full hour skips both.
 */
export const shouldEnqueue = ({
  kind,
  prefs,
  focused = false,
  lastAt = null,
  now = new Date(),
  sentThisHour = 0,
} = {}) => {
  if (!prefs?.enabled) return { inbox: false, web: false, reason: 'off' };
  if (!typeOn(kind, prefs)) return { inbox: false, web: false, reason: 'type' };
  if (kind === 'friends_online' && lastAt) {
    const then = new Date(lastAt).getTime();
    if (Number.isFinite(then) && now.getTime() - then < FRIEND_ONLINE_DEBOUNCE_MS) {
      return { inbox: false, web: false, reason: 'debounce' };
    }
  }
  if (Number(sentThisHour) >= PUSH_HOURLY_CAP) {
    return { inbox: false, web: false, reason: 'rate' };
  }
  const quiet = inQuietHours(now, prefs);
  const focusedTurn = kind === 'your_turn' && focused;
  let reason = 'send';
  if (quiet) reason = 'quiet';
  else if (focusedTurn) reason = 'focused';
  return { inbox: true, web: !quiet && !focusedTurn, reason };
};

const safeName = (name) => {
  const text = String(name ?? '').trim();
  if (text.length < 2 || text.length > 24) return 'Someone';
  if (!/^[A-Za-z0-9 _.!?-]+$/.test(text)) return 'Someone';
  return text;
};

/** The words on the banner. Same sentences as push_line() in the migration. */
export const pushCopy = (kind, name) => {
  const who = safeName(name);
  switch (kind) {
    case 'friends_online':
      return { title: 'They walked in', body: `${who} just walked in. Try to look busy.` };
    case 'challenge_live':
      return { title: 'A live dare', body: `${who} wants it in person. How rude.` };
    case 'challenge_ghost':
      return { title: 'A deck was left out', body: `${who} left a deck with your name on it.` };
    case 'accept_request':
      return { title: 'They said yes', body: `${who} said yes. Terrible judgment, the both of you.` };
    case 'accept_challenge':
      return { title: 'They picked up', body: `${who} picked up. Don't get shy now.` };
    case 'your_turn':
      return { title: 'Your turn', body: "Your turn, darling. Don't keep them waiting." };
    default:
      return { title: 'The bar', body: 'The bar has something for you.' };
  }
};

/** iOS Safari only delivers Web Push to an installed home-screen app, from 16.4. */
export const iosNeedsHomeScreen = (userAgent, installed) => {
  const ua = String(userAgent || '');
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && /Mobile/.test(ua));
  return ios && !installed;
};
