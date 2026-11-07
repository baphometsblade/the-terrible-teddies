// The ladder's calls. Every write is an RPC whose row is auth.uid() and whose
// rating math runs on the server. A missing function (the migration has not
// landed) is 'unavailable', and the game keeps working without it.

import { supabase } from '../supabase.js';
import { playerFacingError } from '../network.js';

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
export function reportLadderResult(matchId, won, wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); })) {
  const key = String(matchId);
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    const first = await call('report_ladder_result', { p_match_id: matchId, p_won: won });
    if (first.reason !== 'early') return first;
    await wait(9000);
    return call('report_ladder_result', { p_match_id: matchId, p_won: won });
  })().finally(() => { inflight.delete(key); });
  inflight.set(key, job);
  return job;
}

/** Walk away from the open ticket. The server books it as a loss. */
export const forfeitOpen = () => call('forfeit_open_match');

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
  unavailable: 'The ladder is not open on this server yet.',
  unreachable: 'Couldn’t reach the server. Nothing was changed.',
});

export const reasonText = (result) => {
  if (!result) return SOCIAL_REASONS.unreachable;
  if (result.message) return result.message;
  return SOCIAL_REASONS[result.reason] || SOCIAL_REASONS.unreachable;
};
