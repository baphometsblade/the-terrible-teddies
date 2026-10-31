// The bar's clock: the menu's sign and the Battle button's line both follow
// the hour on the player's own wall clock. Pure and table-driven. Everything
// the player reads lives in BAR_CLOCK below, one row per part of the night, so
// the lines can be rewritten without touching the logic or the layout; the
// tests measure each against the slot it fills.
//
// Keyed on getHours() — the hour the player's clock shows — and not on
// elapsed time, so the night a clock jumps (daylight saving) cannot put the
// sign out of step with the wall: 1 a.m. is last call whichever 1 a.m. it is.
//
// Local clock only. Nothing here is stored or sent.

import { MGMT_SIGNOFF } from './mgmtNotes';

// The notes that can be taped under the closed sign, signed by management
// (NOTE_MAX characters at most, the sign-off included). The table's `note` is
// the first; the menu picks one per visit (see pickLine in mgmtNotes.js).
export const CLOSED_NOTES = Object.freeze([
  `Cleaning. Don't ask.${MGMT_SIGNOFF}`,
  `Come in, I guess.${MGMT_SIGNOFF}`,
  `Private incident.${MGMT_SIGNOFF}`,
  `Back at six. Maybe.${MGMT_SIGNOFF}`,
  `Come in anyway.${MGMT_SIGNOFF}`,
]);

// A row is one part of the night:
//   id        what the rest of the game calls it (partOfDay returns it)
//   from      the first hour it holds (0-23)
//   until     the hour it ends at, exclusive; less than `from` means it runs
//             past midnight (19 to 1 holds 19, 20 ... 23, 0)
//   sign      the neon's text: 14 characters at most, set in caps
//   tone      the tube's colour: 'amber' | 'pink' | 'teal' | 'red'
//   lit       'full', or 'half' for a sign that is only half switched on
//   flicker   the one sign that idles with a slow flicker (last call, and
//             only on the menu)
//   note      a note taped under the sign, or null: 28 characters at most
//             (the closed row's is the first of CLOSED_NOTES)
//   subtitle  the Battle button's line: 20 characters at most. That is an upper
//             bound on count, not a promise of fit: the column is pixels, and
//             wide capitals fill it sooner. e2e/responsive.spec.js measures
//             every row's rendered line at 320px, so a line that wraps fails.
export const BAR_CLOCK = Object.freeze([
  {
    id: 'early', from: 6, until: 12,
    sign: 'OPEN-ISH', tone: 'amber', lit: 'full', flicker: false, note: null,
    subtitle: 'Kick Chuck awake',
  },
  {
    id: 'afternoon', from: 12, until: 16,
    sign: 'BACK AT 4', tone: 'amber', lit: 'full', flicker: false, note: null,
    subtitle: 'Chuck lost a shoe',
  },
  {
    id: 'happyHour', from: 16, until: 19,
    sign: 'HAPPY HOUR', tone: 'pink', lit: 'full', flicker: false, note: null,
    subtitle: "Chuck's buying?",
  },
  {
    id: 'late', from: 19, until: 1,
    sign: 'KARAOKE', tone: 'teal', lit: 'full', flicker: false, note: null,
    // The Battle button's original line, kept verbatim: nothing already
    // shipped goes. It holds the busiest six hours of the night, and sets up
    // 'Chuck is crying' at 1 a.m.
    subtitle: 'Go make Chuck cry',
  },
  {
    id: 'lastCall', from: 1, until: 2,
    sign: 'LAST CALL', tone: 'pink', lit: 'full', flicker: true, note: null,
    subtitle: 'Chuck is crying',
  },
  {
    id: 'closed', from: 2, until: 6,
    sign: 'CLOSED', tone: 'red', lit: 'half', flicker: false,
    note: CLOSED_NOTES[0],
    subtitle: 'Chuck never left',
  },
]);

// The slots the table's lines are written for. barClock.test.js holds every
// row to them; the layout is built on them.
export const SIGN_MAX = 14;
export const NOTE_MAX = 28;
export const SUBTITLE_MAX = 20;

const holds = (row, hour) => (row.from < row.until
  ? hour >= row.from && hour < row.until
  : hour >= row.from || hour < row.until);

// The hour on the clock `now` names: a Date, an epoch in ms, or the current
// time when there is none.
const hourOf = (now) => (now instanceof Date ? now : new Date(now ?? Date.now())).getHours();

const rowAt = (now) => {
  const hour = hourOf(now);
  // The rows cover all 24 hours with no overlap (barClock.test.js); the
  // fallback is only for a clock that answers with something that is not an
  // hour at all.
  return BAR_CLOCK.find((row) => holds(row, hour)) ?? BAR_CLOCK[0];
};

/**
 * The sign for the hour on `now`'s clock: its row's id as `state`, the neon's
 * `text` and `tone`, whether it is `lit` fully or by half, whether it
 * `flicker`s, and the taped `note` (null for most).
 */
export function signFor(now) {
  const row = rowAt(now);
  return { state: row.id, text: row.sign, tone: row.tone, lit: row.lit, flicker: row.flicker, note: row.note };
}

/** The Battle button's line for the hour on `now`'s clock: 20 characters at most. */
export function subtitleFor(now) {
  return rowAt(now).subtitle;
}

/**
 * Which part of the night it is, as a row's id: 'early' (6 to noon),
 * 'afternoon' (noon to 4), 'happyHour' (4 to 7), 'late' (7 to 1), 'lastCall'
 * (1 to 2) or 'closed' (2 to 6). For anything else on the clock that follows
 * the bar's hours.
 */
export function partOfDay(now) {
  return rowAt(now).id;
}
