// Gem purchases that save time. None of these change a card, a drop rate,
// a pity timer, or a sell-back. Prices are gems already in the wallet.
// settle_pack_open's sibling buy_convenience charges the same numbers.

import { EARNED_OPENS_PER_DAY } from './packEconomy';
import { crawlStatus } from './barCrawl';
import { weekKeyOf } from './questReroll';

export { EARNED_OPENS_PER_DAY };

// Permanent. Skips the opening animation, the daily open cap, and enables
// opening every pack the player is holding in one action. The cards are the
// cards a one-by-one open would have rolled.
export const INSTANT_OPEN_GEMS = 80;

// Saved lineups, not a bigger battle deck. Free players start with enough
// to compete and earn the rest. Paying reaches the same ceiling on the day
// they buy it.
export const FREE_DECK_SLOTS = 3;
export const DECK_SLOT_CEILING = 5;
export const DECK_SLOT_GEMS = 40;
export const DECK_WIN_MILESTONES = Object.freeze([
  Object.freeze({ wins: 30, slots: 1 }),
  Object.freeze({ wins: 80, slots: 1 }),
]);

// Unique cards the binder will hold. Dupes sell back either way. The earned
// path reaches the whole catalog; the gem unlock reaches it immediately.
export const STORAGE_START = 36;
export const STORAGE_WIN_MILESTONES = Object.freeze([
  Object.freeze({ wins: 20, extra: 10 }),
  Object.freeze({ wins: 50, extra: 10 }),
  Object.freeze({ wins: 100, extra: 8 }),
]);
export const STORAGE_GEMS = 60;

// A shield normally arrives by finishing a 7-night streak. Buying one skips
// that wait. One purchase a day, and the shield still caps at one.
export const SHIELD_GEMS = 15;
export const SHIELD_BUYS_PER_DAY = 1;

// Past the free daily or weekly reroll. Three paid rerolls a day.
export const REROLL_GEMS = 8;
export const PAID_REROLLS_PER_DAY = 3;

// The walk between bar-crawl stops. The price falls as the clock runs out.
export const CRAWL_STOP_WAIT_MS = 4 * 60 * 60 * 1000;
export const CRAWL_SKIPS_PER_DAY = 3;

// Cosmetic only. Frames and cloths, no stats.
export const COSMETIC_FRAME_ID = 'brass-frame';
export const COSMETIC_TABLE_ID = 'last-table';

export const deckSlotsFor = (wins, bought, bonus = false) => {
  let n = FREE_DECK_SLOTS + (bonus ? 1 : 0);
  const w = Math.max(0, Math.floor(Number(wins) || 0));
  for (const step of DECK_WIN_MILESTONES) {
    if (w >= step.wins) n += step.slots;
  }
  if (bought) n = DECK_SLOT_CEILING;
  return Math.min(DECK_SLOT_CEILING, n);
};

export const storageSlotsFor = (wins, bought, catalogSize) => {
  const cap = Math.max(0, Math.floor(Number(catalogSize) || 0));
  if (cap === 0) return 0;
  if (bought) return cap;
  const w = Math.max(0, Math.floor(Number(wins) || 0));
  const steps = w >= 100 ? 3 : w >= 50 ? 2 : w >= 20 ? 1 : 0;
  const rest = Math.max(0, cap - STORAGE_START);
  return Math.min(cap, STORAGE_START + Math.floor((rest * steps) / 3));
};

/** Gems to skip a wait of `msLeft`. One gem per hour still on the clock, at least one. */
export const skipGemPrice = (msLeft) => {
  const ms = Math.max(0, Number(msLeft) || 0);
  if (ms <= 0) return 0;
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  return Math.max(1, hours);
};

export const CONVENIENCE = Object.freeze([
  Object.freeze({
    id: 'instant_open',
    gems: INSTANT_OPEN_GEMS,
    name: 'Instant open',
    blurb: 'Skip the tear and the daily open cap. Open every pack you are holding. Same cards as waiting.',
  }),
  Object.freeze({
    id: 'deck_slots',
    gems: DECK_SLOT_GEMS,
    name: 'Extra deck slots',
    blurb: 'The rest of the saved-lineup shelf, today. Play earns the same shelf.',
  }),
  Object.freeze({
    id: 'storage',
    gems: STORAGE_GEMS,
    name: 'Binder space',
    blurb: 'Room for every card, today. Wins earn the same room.',
  }),
  Object.freeze({
    id: 'streak_shield',
    gems: SHIELD_GEMS,
    name: 'Streak shield',
    blurb: 'Bank the shield a 7-night streak would have paid. One a day.',
  }),
  Object.freeze({
    id: 'quest_reroll',
    gems: REROLL_GEMS,
    name: 'Another reroll',
    blurb: 'Swap one more quest after the free reroll. Three a day.',
  }),
]);

export const convenienceById = (id) => CONVENIENCE.find((row) => row.id === id) || null;

/**
 * The crawl the Back Room shows. With the timer off (older saves, and any
 * state that never crossed a week boundary) this is the objective list as-is.
 * With the timer on, a stop that was just finished holds the later stops until
 * the walk is over or it is skipped. Skipping costs gems that fall as the
 * clock runs down.
 */
export const crawlBoard = (state = {}, now = new Date()) => {
  const status = crawlStatus(state, weekKeyOf(now));
  const gate = Number(state.crawlGateUntil) || 0;
  const waiting = state.crawlTimer === true && gate > now.getTime();
  if (!waiting) return { ...status, waiting: false, waitMs: 0, skipGems: 0 };
  let locked = false;
  const stops = status.stops.map((stop) => {
    if (locked) return { ...stop, met: false };
    if (stop.id === state.crawlGatedStop) locked = true;
    return stop;
  });
  return {
    ...status,
    stops,
    done: false,
    waiting: true,
    waitMs: gate - now.getTime(),
    skipGems: skipGemPrice(gate - now.getTime()),
  };
};
