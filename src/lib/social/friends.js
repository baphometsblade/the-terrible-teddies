// Rules for pals: who gets suggested, who can see presence, how a request
// moves, and how a challenge is routed. Pure. The SQL in
// supabase/migrations/20261110140000_social_links.sql is the authority at
// runtime; these copies are what the screen and the unit tests share.
//
// Live PvP (migration 20261110130000_pvp_matches) is not on main.
// challengePlan('live') does not deal a fight. It names the row
// challenge_friend inserts: public.friend_challenges, seam 'friend_challenges'.
// When that migration lands, it should fulfill those rows or replace the
// live branch of challenge_friend. Ghost mode deals a ladder ticket now.

import { PUBLIC_ORIGIN } from './ladder.js';

export const DISCORD_PROVIDER = 'discord';
export const X_PROVIDER = 'twitter';
export const DISCORD_SCOPES = 'identify guilds';
// Display only. No follows scope, and the client never calls the X API.
export const X_SCOPES = 'users.read tweet.read';
export const LIVE_SEAM = 'friend_challenges';
export const GHOST_SEAM = 'ladder_matches';

export const FRIEND_INVITE_KEY = 'terrible-teddies-friend-invite';
export const PENDING_LINK_KEY = 'terrible-teddies-pending-link';
export const PRESENCE_EVENT = 'teddies-presence';

export const PRESENCE_LABELS = Object.freeze({
  online: 'Around',
  match: 'In a fight',
  bar: 'At the bar',
  away: 'Out',
});

const INVITE = /^[0-9a-f]{12}$/;
const GUILD = /^[0-9]{17,20}$/;

let hidden = false;

/** The appear-offline choice, so presence can stop publishing without a round trip. */
export const setPresenceHidden = (value) => {
  hidden = Boolean(value);
};

export const presenceHidden = () => hidden;

/** A Discord snowflake, capped, de-duplicated. Anything else is dropped. */
export const cleanGuildIds = (ids) => {
  const out = [];
  const seen = new Set();
  const list = Array.isArray(ids) ? ids : [];
  for (let i = 0; i < list.length; i += 1) {
    const id = String(list[i] ?? '').trim();
    if (!GUILD.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 100) break;
  }
  return out;
};

/** Guild ids from a Discord `/users/@me/guilds` payload. Names are discarded. */
export const guildIdsFromPayload = (body) => {
  if (!Array.isArray(body)) return [];
  return cleanGuildIds(body.map((row) => (row && typeof row === 'object' ? row.id : '')));
};

export const cleanInvite = (value) => {
  const code = String(value ?? '').trim().toLowerCase();
  return INVITE.test(code) ? code : '';
};

export const friendInvitePath = (code) => {
  const clean = cleanInvite(code);
  return clean ? `/?friend=${clean}` : '';
};

export const friendInviteUrl = (code) => {
  const path = friendInvitePath(code);
  return path ? `${PUBLIC_ORIGIN}${path}` : '';
};

/** Share intent. A link, not an API call. */
export const xIntentUrl = (inviteUrl) => {
  const url = String(inviteUrl ?? '');
  if (!url) return '';
  const text = `Slide into their DMs. Well, their deck. ${url}`;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
};

export const friendCodeFromHref = (href) => {
  try {
    const url = new URL(String(href || '/'), PUBLIC_ORIGIN);
    return cleanInvite(url.searchParams.get('friend'));
  } catch {
    return '';
  }
};

const storageOp = (storage, fn) => {
  if (!storage) return '';
  try {
    return fn(storage) || '';
  } catch {
    return '';
  }
};

export const captureFriendInvite = (href, storage) => {
  const code = friendCodeFromHref(href);
  if (code) storageOp(storage, (store) => { store.setItem(FRIEND_INVITE_KEY, code); return code; });
  return code;
};

export const readFriendInvite = (storage) => storageOp(storage, (store) => cleanInvite(store.getItem(FRIEND_INVITE_KEY)));

export const clearFriendInvite = (storage) => {
  storageOp(storage, (store) => { store.removeItem(FRIEND_INVITE_KEY); return 'ok'; });
};

/**
 * Which link buttons to show. Missing or failed settings hide both.
 * X is GoTrue's `twitter` provider, sometimes exposed as `x`.
 */
export const enabledPlatforms = (settings) => {
  const external = settings && typeof settings === 'object' ? settings.external : null;
  const row = external && typeof external === 'object' ? external : {};
  return {
    discord: row.discord === true,
    x: row.twitter === true || row.x === true,
  };
};

export const presenceForScreen = (screen, atSocial) => {
  if (presenceHidden()) return null;
  if (screen === 'game') return 'match';
  if (atSocial || screen === 'menu') return 'bar';
  return 'online';
};

export const presenceLabel = (status) => PRESENCE_LABELS[status] || PRESENCE_LABELS.away;

/**
 * @param {object} args
 * @param {string} args.selfId
 * @param {string[]} args.mine guild hashes (or any opaque ids) the viewer is in
 * @param {{ id: string, name?: string, linkedDiscord?: boolean, guilds?: string[] }[]} args.people
 * @param {string[]} args.friendIds
 * @param {string[]} args.blockedIds ids blocked in either direction
 */
export const suggestFriends = ({ selfId, mine, people, friendIds, blockedIds }) => {
  const friends = new Set(friendIds || []);
  const blocked = new Set(blockedIds || []);
  const mineSet = new Set(mine || []);
  return (people || [])
    .filter((person) => person && person.id && person.id !== selfId)
    .filter((person) => person.linkedDiscord && !friends.has(person.id) && !blocked.has(person.id))
    .map((person) => {
      const seen = new Set();
      let shared = 0;
      for (const id of person.guilds || []) {
        if (seen.has(id)) continue;
        seen.add(id);
        if (mineSet.has(id)) shared += 1;
      }
      return { ...person, shared };
    })
    .filter((person) => person.shared > 0)
    .sort((a, b) => b.shared - a.shared || String(a.name || '').localeCompare(String(b.name || '')))
    .slice(0, 20);
};

const score = (query, row) => {
  const name = String(row.username || '').toLowerCase();
  const discord = String(row.discord_name || '').toLowerCase();
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (discord === query) return 2;
  if (discord.startsWith(query)) return 3;
  return 4;
};

/** Same order find_players uses: exact name, prefix, exact Discord, Discord prefix. */
export const rankSearch = (query, rows) => {
  const q = String(query || '').trim().toLowerCase();
  return [...(rows || [])].sort((a, b) => (
    score(q, a) - score(q, b) || String(a.username || '').localeCompare(String(b.username || ''))
  ));
};

/**
 * Local picture of a request. The server is the authority; this is the
 * allowed moves, so a screen cannot invent one.
 * status: none | out | in | friends | blocked
 */
export const applyFriendAction = (status, action) => {
  const now = status || 'none';
  if (action === 'block') return { status: 'blocked' };
  if (action === 'unblock') return now === 'blocked' ? { status: 'none' } : { status: now, refused: true };
  if (now === 'blocked') return { status: 'blocked', refused: true };
  if (action === 'request') {
    if (now === 'in') return { status: 'friends' };
    if (now === 'friends' || now === 'out') return { status: now };
    return { status: 'out' };
  }
  if (action === 'accept') {
    if (now !== 'in') return { status: now, refused: true };
    return { status: 'friends' };
  }
  if (action === 'decline') {
    if (now !== 'in') return { status: now, refused: true };
    return { status: 'none' };
  }
  if (action === 'remove') {
    if (now !== 'friends') return { status: now, refused: true };
    return { status: 'none' };
  }
  return { status: now, refused: true };
};

/**
 * Ghost deals a fight now. Live records a row and does not.
 * @returns {{ mode: 'ghost'|'live', playsNow: boolean, seam: string } | null}
 */
export const challengePlan = (mode) => {
  const clean = String(mode || '').toLowerCase();
  if (clean === 'ghost') return { mode: 'ghost', playsNow: true, seam: GHOST_SEAM };
  if (clean === 'live') return { mode: 'live', playsNow: false, seam: LIVE_SEAM };
  return null;
};

/**
 * Friends only, and not someone who stepped out or was blocked.
 * `blocks` is pairs [a, b]. The subject always sees their own slot.
 */
export const canSeePresence = ({ viewer, subject, friendIds, blocks, offlineIds }) => {
  if (!viewer || !subject) return false;
  const blocked = (blocks || []).some((pair) => (
    Array.isArray(pair) && pair.includes(viewer) && pair.includes(subject) && viewer !== subject
  ));
  if (blocked) return false;
  if (viewer === subject) return true;
  if (!(friendIds || []).includes(subject)) return false;
  if ((offlineIds || []).includes(subject)) return false;
  return true;
};

/** Latest presence meta per key. Unknown statuses are dropped. */
export const readPresence = (state) => {
  const out = {};
  const source = state && typeof state === 'object' ? state : {};
  for (const key of Object.keys(source)) {
    const metas = source[key];
    const last = Array.isArray(metas) && metas.length ? metas[metas.length - 1] : null;
    const status = last && last.status;
    if (status === 'online' || status === 'match' || status === 'bar') out[key] = status;
  }
  return out;
};
