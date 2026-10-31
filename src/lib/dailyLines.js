// The words Daily Rewards says around the plain parts (the day, the prizes, the
// countdown): a small-caps kicker above the heading that follows the bar's clock,
// and a line under "Day N claimed". Pure data and two pickers, so the lines can be
// rewritten without touching the dialog, and dailyLines.test.js measures every one
// against its slot.
//
// The kicker's bands are barClock.js's own (partOfDay: early, afternoon,
// happyHour, late, lastCall, closed), not a second table: the sign on the menu
// and this dialog agree about what time it is. Both pools are the House talking
// (flat, dry, no exclamation marks).
import { partOfDay } from './barClock';

// The kicker is label-caps over the 256px header at 320: 24 characters, and
// about 215px in capitals (the widest line measures 226px, which the dialog
// holds on its own line; e2e/meta-screens.spec.js checks the rendered width).
export const KICKER_MAX = 24;
export const DAILY_KICKERS = Object.freeze({
  early: Object.freeze(['You look like shit', 'Hungover but present', 'The sun has opinions']),
  afternoon: Object.freeze(['Lunch is a liquid', 'Calling it lunch', 'Day drinking, defensible']),
  happyHour: Object.freeze(['Standards half off', 'Two-for-one regrets', 'Someone’s already crying']),
  late: Object.freeze(['You said one drink', 'Don’t text your ex', 'Tequila was a choice']),
  lastCall: Object.freeze(['Last call. Last chances', 'Everyone’s a ten now']),
  closed: Object.freeze(['Use the back door', 'Nothing good is open', 'Still up. Interesting.']),
});

// The line under "Day N claimed": one text-sm line, and it must read for any
// prize (a card day, a gem day), so none of them assumes something to spend.
export const PAID_SUB_MAX = 40;
export const DAILY_PAID_SUBS = Object.freeze([
  'You earned it. Allegedly.',
  'Put it somewhere Chuck won’t look.',
  'Tell nobody where it came from.',
  'Same time tomorrow. Same mistakes.',
  'Chuck will ask where you got it.',
]);

// On a card day, above the cards: fixed and plain. It never wraps or names a
// card (any card can land here), and says "deck" so it can only be read as one.
export const CARD_DAY_LEAD_IN = 'From the deck behind the bar:';

// "Day 7 is on the house": the ready heading's budget (one line at 320).
export const dayReadyTitle = (day) => `Day ${day} is on the house`;

// Not the same line twice running, per pool: the last line each pool dealt.
const last = new Map();
const pick = (poolKey, lines, random) => {
  const options = lines.length > 1 ? lines.filter((l) => l !== last.get(poolKey)) : lines;
  const line = options[Math.floor(random() * options.length)];
  last.set(poolKey, line);
  return line;
};

/** A kicker for the hour on `now`'s clock. `random` is for tests. */
export const pickKicker = (now = new Date(), random = Math.random) => {
  const band = partOfDay(now);
  return pick(`kicker:${band}`, DAILY_KICKERS[band], random);
};

/** A line for under "Day N claimed". `random` is for tests. */
export const pickPaidSub = (random = Math.random) => pick('paid', DAILY_PAID_SUBS, random);
