// The house ladder. A competitive rating, separate from the level ranks in
// houseRank.js (those stay a matter of how long you have been drinking here).
// Pure, so the screen, the share card and the migration tests can share it.
//
// The server is the authority (supabase/migrations/20261107130000_social_ladder.sql).
// These copies exist so the screen can name a tier before the round trip, and
// so a test can fail when the two drift. The SQL assertions in
// scripts/check-migrations.sh pin the same boundaries and the same Elo steps.

import { toGhostId } from './ghostDeck.js';

export const LADDER_START = 1000;
export const LADDER_FLOOR = 100;
export const LADDER_CEILING = 2400;
export const LADDER_K = 24;
export const LADDER_STEP_CAP = 32;
export const LADDER_DAY_CAP = 80;
export const DECK_SIZE = 10;
export const MAX_COPIES = 2;
export const MAX_CARD_ID = 200;

// Thresholds are the minimum rating that holds the tier. Names are safe to
// print on a shared card: the rude line for a tier lives in TIER_ASIDES and
// never leaves the age gate.
export const LADDER_TIERS = Object.freeze([
  { min: 0, name: 'Warming Up' },
  { min: 1050, name: 'Getting Handsy' },
  { min: 1200, name: 'Regular' },
  { min: 1350, name: 'Easy' },
  { min: 1500, name: 'Back Booth' },
  { min: 1650, name: 'After Hours' },
  { min: 1800, name: 'Last Call' },
  { min: 2000, name: 'All Night' },
].map((row) => Object.freeze(row)));

// The public site. Share links and preview tags point here even when the
// page itself was opened from a preview deploy.
export const PUBLIC_ORIGIN = 'https://terribleteddies.vercel.app';

// Said under the tier, inside the game, behind the age gate. The names travel
// on the share card; these lines do not.
export const TIER_ASIDES = Object.freeze({
  'Warming Up': 'Coat on, hands polite. We have all night to ruin that.',
  'Getting Handsy': 'The regulars moved their drinks. Then they leaned in.',
  'Regular': 'Same stool. Same finish. They set a watch.',
  'Easy': 'A sure thing. You hate that the room knows.',
  'Back Booth': 'The dark booth. What happens there stays, badly.',
  'After Hours': 'Door locked. Lights low. You stayed anyway.',
  'Last Call': 'Decent people went home. You are still here.',
  'All Night': 'Dawn. Still at it. Nobody is surprised.',
});

const clampRating = (rating) => Math.min(LADDER_CEILING, Math.max(LADDER_FLOOR, rating));

/** The tier row a rating holds. */
export const tierAt = (rating) => {
  const n = Math.floor(Number(rating));
  let found = LADDER_TIERS[0];
  if (!Number.isFinite(n)) return found;
  for (const row of LADDER_TIERS) {
    if (row.min <= n) found = row;
    else break;
  }
  return found;
};

/**
 * Monday's soft reset: halfway back to the start, then clamped. Integer
 * division toward zero, matching ladder_soft() in Postgres.
 */
export const softReset = (rating) => {
  const n = Math.trunc(Number(rating));
  if (!Number.isFinite(n)) return LADDER_START;
  return clampRating(LADDER_START + Math.trunc((n - LADDER_START) / 2));
};

/**
 * Elo step for one attested result. K = 24, clamped to ±32. `won` is the
 * caller's result. Matches ladder_delta() (numeric round, half away from 0).
 */
export const eloDelta = (own, other, won) => {
  const a = Number.isFinite(Number(own)) ? Number(own) : LADDER_START;
  const b = Number.isFinite(Number(other)) ? Number(other) : LADDER_START;
  const expected = 1 / (1 + 10 ** ((b - a) / 400));
  const score = won ? 1 : 0;
  const raw = LADDER_K * (score - expected);
  const rounded = Math.sign(raw) * Math.round(Math.abs(raw));
  if (rounded > LADDER_STEP_CAP) return LADDER_STEP_CAP;
  if (rounded < -LADDER_STEP_CAP) return -LADDER_STEP_CAP;
  return rounded;
};

/**
 * What a daily gain cap leaves of a step. Losses pass through this helper
 * untouched; the server caps those on their own counter.
 */
export const capGain = (delta, gainedToday, cap = LADDER_DAY_CAP) => {
  const step = Math.trunc(Number(delta)) || 0;
  const gained = Math.max(0, Math.trunc(Number(gainedToday)) || 0);
  if (step <= 0) return step;
  return Math.min(step, Math.max(0, cap - gained));
};

/**
 * ISO week in UTC, `YYYY-Www`. The Thursday rule, which is what Postgres
 * prints with IYYY and IW. `2026-11-07` is `2026-W45`.
 */
export const seasonId = (date = new Date()) => {
  const t = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const isoYear = t.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
};

const CODE = /^[0-9a-f]{10}$/i;

/** A challenge code, or '' when the text is not one. */
export const cleanCode = (value) => {
  const code = String(value ?? '').trim().toLowerCase();
  return CODE.test(code) ? code : '';
};

/**
 * Whether a list of card ids may be published. `known` is the catalog's id
 * set; the server repeats the shape checks and cannot see the catalog.
 * Returns a sentence for the player, or null when the deck is fine.
 */
export const deckProblem = (ids, known) => {
  if (!Array.isArray(ids) || ids.length !== DECK_SIZE) return 'A published deck is 10 cards.';
  const counts = new Map();
  for (const id of ids) {
    // Prefixed ids file as the integer the deck column already accepts.
    // The catalog check stays on the id the player actually owns.
    const filed = toGhostId(id);
    const listed = known ? known.has(id) : filed != null;
    if (!listed || filed == null || filed < 1 || filed > MAX_CARD_ID) {
      return 'That deck has a card the bar does not serve.';
    }
    const n = (counts.get(filed) || 0) + 1;
    counts.set(filed, n);
    if (n > MAX_COPIES) return 'Two copies of a card is the house limit.';
  }
  return null;
};

/** Display names are short and cannot carry markup. Anything else is withheld. */
export const safeName = (value, fallback = 'A rival') => {
  const name = String(value ?? '').trim();
  if (name.length < 2 || name.length > 24) return fallback;
  if (!/^[A-Za-z0-9 _.!?-]+$/.test(name)) return fallback;
  return name;
};

/** The path of a challenge preview. The age gate is what the link opens. */
export const challengePath = (code) => {
  const clean = cleanCode(code);
  return clean ? `/duel/${clean}` : '';
};

/** Absolute dare, always the public site. */
export const challengeUrl = (code) => {
  const path = challengePath(code);
  return path ? `${PUBLIC_ORIGIN}${path}` : '';
};
