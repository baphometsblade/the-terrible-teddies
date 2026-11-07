// The ladder's calls. Every write is an RPC whose row is auth.uid() and whose
// rating math runs on the server. A missing function (the migration has not
// landed) is 'unavailable', and the game keeps working without it.

import { supabase } from '../supabase.js';
import { playerFacingError } from '../network.js';
import { PUBLIC_ORIGIN } from './ladder.js';

const MISSING = new Set(['PGRST202', 'PGRST205', '42883', '42P01']);

export const isMissingRpc = (error, status) =>
  status === 404 || MISSING.has(String(error?.code || ''));

const fail = (error, status) => {
  if (isMissingRpc(error, status)) return { ok: false, reason: 'unavailable' };
  return { ok: false, reason: 'server', message: playerFacingError(error, 'The bar could not do that.') };
};

async function call(name, args) {
  const { data, error, status } = await supabase.rpc(name, args);
  if (error) return fail(error, status);
  if (!data || typeof data !== 'object') return { ok: false, reason: 'unavailable' };
  return data;
}

/** The signed-in player's ladder row, ghost and open ticket. */
export const loadSocial = () => call('my_social');

/** Publish the deck the player is fighting with. */
export const publishGhost = (deck, label) => call('publish_ghost', { p_deck: deck, p_label: label });

/** Draw a stranger's saved deck. May come back as the ticket already open. */
export const drawGhost = () => call('draw_ghost');

/** Open a friend challenge by its code. */
export const openChallenge = (code) => call('open_challenge', { p_code: code });

/** This week's board. An array, unlike the jsonb calls. */
export async function loadWeekly() {
  const { data, error, status } = await supabase.rpc('weekly_board');
  if (error) {
    if (isMissingRpc(error, status)) return { unavailable: true, rows: [] };
    return { error: playerFacingError(error, 'Could not load the week.'), rows: [] };
  }
  return { rows: Array.isArray(data) ? data : [] };
}

/** A rival's public card, by challenge code. No deck. */
export async function loadCard(code) {
  const { data, error, status } = await supabase.rpc('public_card', { p_code: code });
  if (error) {
    if (isMissingRpc(error, status)) return { unavailable: true };
    return { error: playerFacingError(error, 'Could not load that card.') };
  }
  const row = Array.isArray(data) ? data[0] : null;
  return row ? { card: row } : { card: null };
}

const inflight = new Map();

/**
 * Attest one result. The server ignores a second win on a ticket it has
 * already booked, and refuses a win that arrives before a fight could have
 * happened. That refusal is retried once, after the floor.
 */
export function reportLadderResult(matchId, won, wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); }), taunt = null) {
  const key = String(matchId);
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    let receipt = await call('report_ladder_result', { p_match_id: matchId, p_won: won });
    if (receipt.reason === 'early') {
      await wait(9000);
      receipt = await call('report_ladder_result', { p_match_id: matchId, p_won: won });
    }
    const tauntId = Number(taunt);
    if (receipt.ok && Number.isInteger(tauntId) && tauntId >= 1 && tauntId <= 8) {
      await call('set_match_taunt', { p_match_id: matchId, p_taunt: tauntId });
    }
    if (receipt && typeof receipt === 'object') receipt.match_id = matchId;
    return receipt;
  })().finally(() => { inflight.delete(key); });
  inflight.set(key, job);
  return job;
}

/** Walk away from the open ticket. The server books it as a loss. */
export const forfeitOpen = () => call('forfeit_open_match');

export const loadRoom = () => call('my_room');
export const followPlayer = (code) => call('follow_player', { p_code: code });
export const unfollowPlayer = (code) => call('unfollow_player', { p_code: code });
export const createGang = (name, tag) => call('create_gang', { p_name: name, p_tag: tag });
export const joinGang = (tag) => call('join_gang', { p_tag: tag });
export const leaveGang = () => call('leave_gang');
export const enterCup = () => call('enter_cup');
export const drawCup = () => call('draw_cup');
export const setGreeting = (taunt) => call('set_greeting', { p_taunt: taunt });
export const matchAside = (matchId) => call('match_aside', { p_match_id: matchId });
export const setRival = (code) => call('set_rival', { p_code: code });
export const clearRival = () => call('set_rival', { p_code: '' });
export const submitReport = (code, reason) => call('submit_report', { p_code: code, p_reason: reason });
export const redeemReferral = (code) => call('redeem_referral', { p_code: code });
export const loadLineup = (code) => call('lineup', { p_code: code });

export async function loadFollows() {
  const { data, error, status } = await supabase.rpc('list_follows');
  if (error) {
    if (isMissingRpc(error, status)) return { unavailable: true, rows: [] };
    return { error: playerFacingError(error, 'Could not load who you follow.'), rows: [] };
  }
  return { rows: Array.isArray(data) ? data : [] };
}

export async function loadGangs() {
  const { data, error, status } = await supabase.rpc('gang_board');
  if (error) {
    if (isMissingRpc(error, status)) return { unavailable: true, rows: [] };
    return { error: playerFacingError(error, 'Could not load the gangs.'), rows: [] };
  }
  return { rows: Array.isArray(data) ? data : [] };
}

export async function loadCup() {
  const { data, error, status } = await supabase.rpc('cup_table');
  if (error) {
    if (isMissingRpc(error, status)) return { unavailable: true, rows: [] };
    return { error: playerFacingError(error, 'Could not load the cup.'), rows: [] };
  }
  return { rows: Array.isArray(data) ? data : [] };
}

/** Absolute slip, always the public site. */
export const slipUrl = (matchId) => {
  const id = String(matchId ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return '';
  return `${PUBLIC_ORIGIN}/slip/${id}`;
};

/** The shape the board deals from a ticket payload. */
export function ticketFrom(data) {
  if (!data || data.ok === false || !data.match_id || !Array.isArray(data.deck)) return null;
  return {
    matchId: data.match_id,
    rivalName: data.rival_name,
    label: data.label,
    deck: data.deck.map((id) => Number(id)),
    rivalRating: data.rival_rating,
    yourRating: data.your_rating,
    kind: data.kind,
    resume: data.reason === 'open',
  };
}

// What a reason code means, in the house's voice. Plain, and no claim about
// a cause the server did not name. `server` uses the message it sent.
export const SOCIAL_REASONS = Object.freeze({
  empty: 'Nobody has left a deck out.',
  self: 'That one is your deck.',
  capped: 'You two have fought enough this week.',
  slow: 'The bar needs a minute.',
  early: 'The bar is still counting that one.',
  closed: 'That brawl is already on the books.',
  missing: 'That challenge is not on the bar.',
  open: 'Finish the brawl you already started.',
  in: 'You are already in a gang. Leave it first.',
  taken: 'That tag is already on the door.',
  deck: 'Leave a deck on the bar first.',
  play: 'Fight once before you cash that.',
  used: 'You already cashed one.',
  unavailable: 'The ladder is not open on this server yet.',
  unreachable: 'Couldn’t reach the server. Nothing was changed.',
});

export const reasonText = (result) => {
  if (!result) return SOCIAL_REASONS.unreachable;
  if (result.message) return result.message;
  return SOCIAL_REASONS[result.reason] || SOCIAL_REASONS.unreachable;
};
