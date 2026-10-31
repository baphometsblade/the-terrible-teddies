// The door: the first-launch adults-only check. This file is its pure half —
// what a device has answered, what a year of birth means, and how long the
// door takes to open — so it can sit on the boot path (main.jsx's gate reads
// it before anything is drawn) for a few hundred bytes, and so the e2e
// helper can import its key without a browser. No React, no Vite-only
// imports, nothing that runs at import time. The scene is TheDoor.jsx, a lazy
// chunk that only a device with no answer yet ever downloads.
//
// It is a courtesy gate in the fiction, not age verification: it takes the
// player's word, and nothing here claims otherwise.
//
// What is stored. One localStorage key, one JSON record, per device:
//
//     terrible-teddies-door = {"v":1,"state":"pass"|"declined","at":<epoch ms>}
//
// Never the year of birth. The year is typed, compared and dropped in memory;
// it is not stored, logged or sent (TheDoor.test.jsx and e2e/door.spec.js
// both go looking for it). `at` is for whoever reads the record later, not a
// clock check: a device whose clock was wrong when it answered must not be
// asked again, and must not have a decline lifted by it either.

export const DOOR_KEY = 'terrible-teddies-door';
export const DOOR_VERSION = 1;

// The door's answers. 'ask' is no answer yet.
export const DOOR_STATES = ['pass', 'declined'];

export const ADULT_AGE = 18;
// The earliest year the field takes: a typo guard, not a claim about anyone.
export const FIRST_YEAR = 1900;

// Where Bouncer Bruno's full-size card art lives (the door crops it to his
// shades). One constant, because the gate warms it up and the scene draws it.
export const DOOR_ART = '/cards/56.webp';

/**
 * The value to store for an answer: the JSON the contract above describes.
 * A string, ready for localStorage.setItem. `now` is an epoch in ms (or a
 * Date). Throws on a state it does not know: it is only ever called with a
 * literal, and a typo in one should fail loudly in a test, not store a record
 * every reader treats as "ask".
 */
export function doorRecord(state, now) {
  if (!DOOR_STATES.includes(state)) throw new RangeError(`unknown door state: ${state}`);
  const at = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(at)) throw new RangeError(`not a time: ${now}`);
  return JSON.stringify({ v: DOOR_VERSION, state, at });
}

/**
 * What a stored value says: 'pass', 'declined', or 'ask' for everything else
 * (nothing stored, a parse failure, another version, another shape). A record
 * this code cannot read must never be a pass.
 */
export function parseDoor(raw) {
  if (typeof raw !== 'string') return 'ask';
  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return 'ask';
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) return 'ask';
  if (record.v !== DOOR_VERSION) return 'ask';
  if (!DOOR_STATES.includes(record.state)) return 'ask';
  if (typeof record.at !== 'number' || !Number.isFinite(record.at)) return 'ask';
  return record.state;
}

/**
 * What this device has answered, from `storage` (a Storage, or anything with
 * getItem). A storage that throws (blocked, private mode) or is missing says
 * 'ask': the door is shown again, never a lockout and never a free pass.
 */
export function readDoor(storage) {
  try {
    return parseDoor(storage?.getItem(DOOR_KEY));
  } catch {
    return 'ask';
  }
}

/**
 * Writes an answer, and never throws: a storage that refuses (blocked, full)
 * just means the answer is not kept. Returns whether it was stored.
 */
export function writeDoor(storage, state, now = Date.now()) {
  try {
    storage.setItem(DOOR_KEY, doorRecord(state, now));
    return true;
  } catch {
    return false;
  }
}

/**
 * What a year of birth, typed in, comes to.
 *
 *   'invalid'  not four digits, or outside 1900 to this year
 *   'under'    under 18
 *   'ask'      turns 18 this year: only a birthday answer can tell
 *   'in'       18 or over
 *
 * The person is `thisYear - year` years old by the end of this year, so
 * more than 18 means they are an adult now whatever their birthday, fewer
 * means they are not, and exactly 18 depends on whether it has happened yet:
 * `hadBirthday` true is 'in', false is 'under', and until it is known (null
 * or undefined) the answer is 'ask'.
 *
 * `now` is an epoch or a Date. Surrounding whitespace is forgiven, and so is
 * a full-width "１９９０" (a CJK keyboard's digits), which NFKC folds to ASCII;
 * anything else that is not four digits is 'invalid'.
 */
export function checkAge(yearText, now = Date.now(), hadBirthday = null) {
  const text = String(yearText ?? '').normalize('NFKC').trim();
  if (!/^[0-9]{4}$/.test(text)) return 'invalid';
  const year = Number(text);
  const thisYear = new Date(now).getFullYear();
  if (year < FIRST_YEAR || year > thisYear) return 'invalid';
  const age = thisYear - year;
  if (age > ADULT_AGE) return 'in';
  if (age < ADULT_AGE) return 'under';
  if (hadBirthday === true) return 'in';
  if (hadBirthday === false) return 'under';
  return 'ask';
}

const browserStorage = () => (typeof window !== 'undefined' ? window.localStorage : null);

/**
 * One device's door: the stored answer, with the page's own memory behind it.
 *
 * With storage blocked an answer cannot be kept, so it lives here, in memory,
 * for the page's life: a pass lets the player play this session, and a
 * decline holds until the page is closed, rather than the door asking again
 * on the next re-render. (A reload is a new page, so with storage blocked a
 * declined device that reloads is asked again: the answer has nowhere to live.
 * Known and accepted: this is a courtesy gate, and the store's rating is the
 * real control.) `getStorage` is a function because even reading
 * `window.localStorage` can throw.
 *
 * Two rules keep a decline a decline:
 *  - it wins wherever it is found, in storage or in memory;
 *  - a pass never overwrites one. Two tabs can both be showing the door; the
 *    one that declines must not be undone by the other's pass, so a pass
 *    re-reads before it writes and gets the decline back.
 */
export function createDoor(getStorage = browserStorage) {
  let remembered = null;

  const stored = () => {
    try {
      return readDoor(getStorage());
    } catch {
      return 'ask';
    }
  };

  const read = () => {
    const kept = stored();
    if (kept === 'declined' || remembered === 'declined') return 'declined';
    return kept === 'pass' || remembered === 'pass' ? 'pass' : 'ask';
  };

  const answer = (state, now) => {
    if (state === 'pass' && read() === 'declined') return 'declined';
    remembered = state;
    try {
      writeDoor(getStorage(), state, now);
    } catch {
      // getStorage itself threw: the answer stays in memory.
    }
    return state;
  };

  return {
    /** 'pass' | 'declined' | 'ask' */
    read,
    /** Records a pass; returns 'pass', or 'declined' if a decline is already on record. */
    pass: (now) => answer('pass', now),
    /** Records a decline; returns 'declined'. */
    decline: (now) => answer('declined', now),
  };
}

// How long the door takes to open once a pass is in, in ms. TheDoor waits this
// long before it hands over to the game, and the animations in index.css are
// the same lengths (door.test.js reads the stylesheet to keep the two in
// step): the slot slides shut in 220, then the door swings in 700. The player's
// own settings shorten it: reduced motion is a 200 ms crossfade, and the
// in-game Animations switch is no ceremony at all.
export const OPENING_MS = Object.freeze({ full: 920, reduced: 200, off: 0 });

/** The opening's length for the player's motion settings. */
export const openingMs = ({ motionOff = false, reduced = false } = {}) => {
  if (motionOff) return OPENING_MS.off;
  return reduced ? OPENING_MS.reduced : OPENING_MS.full;
};
