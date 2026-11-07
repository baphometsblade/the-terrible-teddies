import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DOOR_KEY, DOOR_ART, OPENING_MS, FIRST_YEAR,
  doorRecord, parseDoor, readDoor, writeDoor, checkAge, checkDateOfBirth, contentMode, createDoor, openingMs,
} from './door';

// A Storage that holds what it is given, and one that refuses everything, as
// a blocked or full one does.
const memoryStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
};
const blockedStorage = () => ({
  getItem() { throw new DOMException('denied', 'SecurityError'); },
  setItem() { throw new DOMException('denied', 'SecurityError'); },
});

describe('the storage contract', () => {
  it('is one key and one JSON record', () => {
    expect(DOOR_KEY).toBe('terrible-teddies-door');
    expect(doorRecord('pass', 0)).toBe('{"v":1,"state":"pass","at":0}');
    expect(doorRecord('declined', 1_800_000_000_000)).toBe('{"v":1,"state":"declined","at":1800000000000}');
  });

  it('takes a Date as well as an epoch', () => {
    expect(JSON.parse(doorRecord('pass', new Date(5000)))).toEqual({ v: 1, state: 'pass', at: 5000 });
  });

  // It is only ever called with a literal; a typo in one must fail in a test
  // rather than store a record every reader reads as "ask".
  it('refuses a state or a time it does not know', () => {
    expect(() => doorRecord('open', 0)).toThrow(RangeError);
    expect(() => doorRecord('ask', 0)).toThrow(RangeError);
    expect(() => doorRecord('pass')).toThrow(RangeError);
    expect(() => doorRecord('pass', 'later')).toThrow(RangeError);
  });

  // The e2e helper seeds exactly this, and the app has to read it as a pass.
  it('round-trips through the reader', () => {
    expect(parseDoor(doorRecord('pass', 0))).toBe('pass');
    expect(parseDoor(doorRecord('declined', 0))).toBe('declined');
  });

  it('names the art it crops to the bouncer\'s shades', () => {
    expect(DOOR_ART).toBe('/cards/56.webp');
  });
});

describe('what a stored value says', () => {
  const asks = [
    ['nothing stored', null],
    ['an empty string', ''],
    ['not JSON', 'pass'],
    ['JSON that is not an object', '"pass"'],
    ['null', 'null'],
    ['an array', '[{"v":1,"state":"pass","at":0}]'],
    ['an empty object', '{}'],
    ['a state this code does not know', '{"v":1,"state":"open","at":0}'],
    ['the state "ask" written out', '{"v":1,"state":"ask","at":0}'],
    ['no state', '{"v":1,"at":0}'],
    ['no version', '{"state":"pass","at":0}'],
    // A record from a newer build than the one reading it: never a pass.
    ['a version from the future', '{"v":2,"state":"pass","at":0}'],
    ['version 0', '{"v":0,"state":"pass","at":0}'],
    ['a version as text', '{"v":"1","state":"pass","at":0}'],
    ['no time', '{"v":1,"state":"pass"}'],
    ['a time as text', '{"v":1,"state":"pass","at":"0"}'],
    ['a time of null', '{"v":1,"state":"pass","at":null}'],
    ['a boolean state', '{"v":1,"state":true,"at":0}'],
  ];
  it.each(asks)('%s means ask', (_name, raw) => {
    expect(parseDoor(raw)).toBe('ask');
  });

  it('reads a pass and a decline', () => {
    expect(parseDoor('{"v":1,"state":"pass","at":0}')).toBe('pass');
    expect(parseDoor('{"v":1,"state":"declined","at":1700000000000}')).toBe('declined');
  });

  // `at` is for people reading the record, not a clock check. A device whose
  // clock was ahead when it answered must not be asked again, and (the one
  // that matters) must not have a decline lifted by it.
  it('does not read the time: a record stamped in the future still counts', () => {
    expect(parseDoor('{"v":1,"state":"pass","at":99999999999999}')).toBe('pass');
    expect(parseDoor('{"v":1,"state":"declined","at":99999999999999}')).toBe('declined');
  });

  it('is tolerant of fields it does not know', () => {
    expect(parseDoor('{"v":1,"state":"declined","at":0,"note":"x"}')).toBe('declined');
  });
});

describe('readDoor', () => {
  it('reads the record under the key', () => {
    expect(readDoor(memoryStorage({ [DOOR_KEY]: doorRecord('pass', 0) }))).toBe('pass');
    expect(readDoor(memoryStorage({ [DOOR_KEY]: doorRecord('declined', 0) }))).toBe('declined');
    expect(readDoor(memoryStorage())).toBe('ask');
  });

  it('is not fooled by a pass under another key', () => {
    expect(readDoor(memoryStorage({ 'terrible-teddies-storage': doorRecord('pass', 0) }))).toBe('ask');
  });

  // Blocked or private storage: the door is asked again, never skipped and
  // never a crash.
  it('says ask for a storage that throws, or none at all', () => {
    expect(readDoor(blockedStorage())).toBe('ask');
    expect(readDoor(null)).toBe('ask');
    expect(readDoor(undefined)).toBe('ask');
    expect(readDoor({})).toBe('ask');
  });
});

describe('writeDoor', () => {
  it('stores the record', () => {
    const storage = memoryStorage();
    expect(writeDoor(storage, 'pass', 1234)).toBe(true);
    expect(storage.dump()).toEqual({ [DOOR_KEY]: '{"v":1,"state":"pass","at":1234}' });
  });

  it('never throws, whatever the storage does', () => {
    expect(writeDoor(blockedStorage(), 'pass', 0)).toBe(false);
    expect(writeDoor(null, 'declined', 0)).toBe(false);
    expect(writeDoor({}, 'declined', 0)).toBe(false);
  });
});

describe('checkAge', () => {
  // Local time on purpose: the check is about the player's own calendar.
  const NOW = new Date(2026, 9, 31, 12);

  it('lets an adult in', () => {
    expect(checkAge('2000', NOW)).toBe('in');
    expect(checkAge('1990', NOW)).toBe('in');
    expect(checkAge('2006', NOW)).toBe('in'); // 20
    expect(checkAge('2007', NOW)).toBe('in'); // turns 19 this year: 18 already
    expect(checkAge(String(FIRST_YEAR), NOW)).toBe('in');
  });

  it('turns a minor away', () => {
    expect(checkAge('2009', NOW)).toBe('under'); // turns 17
    expect(checkAge('2015', NOW)).toBe('under');
    expect(checkAge('2026', NOW)).toBe('under'); // born this year
  });

  it('asks the boundary year about its birthday, and believes the answer', () => {
    expect(checkAge('2008', NOW)).toBe('ask');
    expect(checkAge('2008', NOW, null)).toBe('ask');
    expect(checkAge('2008', NOW, undefined)).toBe('ask');
    expect(checkAge('2008', NOW, true)).toBe('in');
    expect(checkAge('2008', NOW, false)).toBe('under');
  });

  it('asks the birthday question of nobody else', () => {
    // Turning 19 this year means 18 already; turning 17 means not yet.
    expect(checkAge('2007', NOW, false)).toBe('in');
    expect(checkAge('2009', NOW, true)).toBe('under');
  });

  it('refuses a year that is not one', () => {
    for (const text of ['', '   ', 'abcd', '19a0', '19 90', '199', '19900', '-199', '+199', '1e3', '19.9', '0x7C6', '1990-', null, undefined]) {
      expect(checkAge(text, NOW), JSON.stringify(text)).toBe('invalid');
    }
  });

  it('refuses a year outside 1900 to this year', () => {
    expect(checkAge('1899', NOW)).toBe('invalid');
    expect(checkAge('0000', NOW)).toBe('invalid');
    expect(checkAge('1000', NOW)).toBe('invalid');
    expect(checkAge('2027', NOW)).toBe('invalid'); // next year
    expect(checkAge('9999', NOW)).toBe('invalid');
  });

  it('forgives whitespace round the digits, and full-width digits', () => {
    expect(checkAge(' 1990 ', NOW)).toBe('in');
    expect(checkAge('\t1990\n', NOW)).toBe('in');
    expect(checkAge('１９９０', NOW)).toBe('in');
    expect(checkAge('２０１５', NOW)).toBe('under');
    // ...but not letters that merely look like numerals.
    expect(checkAge('ⅯⅭⅯ', NOW)).toBe('invalid');
  });

  it('takes a number as well as the text a field holds', () => {
    expect(checkAge(1990, NOW)).toBe('in');
    expect(checkAge(2015, NOW)).toBe('under');
  });

  it('takes the time as an epoch or a Date', () => {
    expect(checkAge('2008', NOW.getTime())).toBe('ask');
    expect(checkAge('2008', NOW)).toBe('ask');
  });

  // The boundary year is the year the player turns 18, so it moves at New
  // Year, in the player's own time zone.
  it('moves the boundary with the calendar year', () => {
    const lastMinute = new Date(2026, 11, 31, 23, 59);
    const firstMinute = new Date(2027, 0, 1, 0, 1);
    expect(checkAge('2008', lastMinute)).toBe('ask');
    expect(checkAge('2008', firstMinute)).toBe('in');
    expect(checkAge('2009', lastMinute)).toBe('under');
    expect(checkAge('2009', firstMinute)).toBe('ask');
    expect(checkAge('2027', lastMinute)).toBe('invalid');
    expect(checkAge('2027', firstMinute)).toBe('under');
  });

  it('uses the clock when it is not told the time', () => {
    const year = new Date().getFullYear();
    expect(checkAge(String(year - 30))).toBe('in');
    expect(checkAge(String(year - 10))).toBe('under');
    expect(checkAge(String(year - 18))).toBe('ask');
  });
});

describe('checkDateOfBirth', () => {
  const NOW = new Date(2026, 9, 31, 12);

  it('lets an adult in, including someone who turns 18 today', () => {
    expect(checkDateOfBirth('1990-06-15', NOW)).toBe('in');
    expect(checkDateOfBirth('2008-10-31', NOW)).toBe('in');
    expect(checkDateOfBirth('1900-01-01', NOW)).toBe('in');
    expect(checkDateOfBirth(' 2000-01-01 ', NOW)).toBe('in');
    expect(checkDateOfBirth('１９９０-０６-１５', NOW)).toBe('in');
  });

  it('turns a minor away, including a birthday that is still tomorrow', () => {
    expect(checkDateOfBirth('2015-01-01', NOW)).toBe('under');
    expect(checkDateOfBirth('2008-11-01', NOW)).toBe('under');
    expect(checkDateOfBirth('2026-10-31', NOW)).toBe('under');
  });

  it('treats 29 February in a non-leap year as the next day', () => {
    expect(checkDateOfBirth('2008-02-29', new Date(2026, 1, 28))).toBe('under');
    expect(checkDateOfBirth('2008-02-29', new Date(2026, 2, 1))).toBe('in');
  });

  it('refuses a date that is not one, or not yet, or before 1900', () => {
    for (const text of ['', '1990', '1990-6-15', '2020-02-31', '2021-02-29', '1899-12-31', '2026-11-01', 'abcd', null, undefined]) {
      expect(checkDateOfBirth(text, NOW), JSON.stringify(text)).toBe('invalid');
    }
  });

  it('uses the clock when it is not told the time', () => {
    const today = new Date();
    const adult = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
    const minor = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
    const stamp = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    expect(checkDateOfBirth(stamp(adult))).toBe('in');
    expect(checkDateOfBirth(stamp(minor))).toBe('under');
  });
});

describe('contentMode', () => {
  it('stays SFW until a pass, which is the only state that unlocks the adult catalog', () => {
    expect(contentMode('ask')).toBe('sfw');
    expect(contentMode('opening')).toBe('sfw');
    expect(contentMode('declined')).toBe('sfw');
    expect(contentMode('pass')).toBe('nsfw');
    expect(contentMode(undefined)).toBe('sfw');
  });
});

describe('createDoor', () => {
  it('asks a device that has not answered', () => {
    expect(createDoor(() => memoryStorage()).read()).toBe('ask');
  });

  it('keeps a pass on the device, for a new page and a new tab', () => {
    const storage = memoryStorage();
    expect(createDoor(() => storage).pass(1000)).toBe('pass');
    expect(JSON.parse(storage.dump()[DOOR_KEY])).toEqual({ v: 1, state: 'pass', at: 1000 });
    // Another page, another tab: a fresh door over the same storage.
    expect(createDoor(() => storage).read()).toBe('pass');
  });

  it('keeps a decline on the device, for a new page and a new tab', () => {
    const storage = memoryStorage();
    expect(createDoor(() => storage).decline(1000)).toBe('declined');
    expect(createDoor(() => storage).read()).toBe('declined');
  });

  it('lets a decline overwrite a pass: the stricter answer wins', () => {
    const storage = memoryStorage({ [DOOR_KEY]: doorRecord('pass', 0) });
    const door = createDoor(() => storage);
    expect(door.decline(5)).toBe('declined');
    expect(createDoor(() => storage).read()).toBe('declined');
  });

  // Two tabs both showing the door: one declines, and the other's pass must
  // not undo it, whatever order the two answers come in.
  it('never lets a pass overwrite a decline, even one made in another tab', () => {
    const storage = memoryStorage();
    const asking = createDoor(() => storage);
    const other = createDoor(() => storage);
    expect(asking.read()).toBe('ask');
    other.decline(1);
    expect(asking.pass(2)).toBe('declined');
    expect(JSON.parse(storage.dump()[DOOR_KEY])).toMatchObject({ state: 'declined', at: 1 });
    expect(createDoor(() => storage).read()).toBe('declined');
  });

  it('replaces a record it cannot read with the answer', () => {
    const storage = memoryStorage({ [DOOR_KEY]: '{"v":9}' });
    const door = createDoor(() => storage);
    expect(door.read()).toBe('ask');
    expect(door.pass(1)).toBe('pass');
    expect(door.read()).toBe('pass');
  });

  describe('with storage blocked', () => {
    // Nothing can be kept, so the answer lives in memory for the page.
    it('lets a pass through for the session, and asks a new page again', () => {
      const door = createDoor(blockedStorage);
      expect(door.read()).toBe('ask');
      expect(door.pass(1)).toBe('pass');
      expect(door.read()).toBe('pass');
      expect(createDoor(blockedStorage).read()).toBe('ask');
    });

    it('holds a decline for the session too, and a later pass cannot lift it', () => {
      const door = createDoor(blockedStorage);
      expect(door.decline(1)).toBe('declined');
      expect(door.read()).toBe('declined');
      expect(door.pass(2)).toBe('declined');
      expect(door.read()).toBe('declined');
    });

    it('survives a storage getter that throws outright', () => {
      const door = createDoor(() => { throw new Error('no storage here'); });
      expect(door.read()).toBe('ask');
      expect(door.pass(1)).toBe('pass');
      expect(door.read()).toBe('pass');
    });

    it('survives a storage that is missing', () => {
      const door = createDoor(() => null);
      expect(door.read()).toBe('ask');
      expect(door.decline(1)).toBe('declined');
      expect(door.read()).toBe('declined');
    });
  });

  // jsdom's own localStorage, as the page's default.
  it('uses the page\'s localStorage when it is not given one', () => {
    localStorage.removeItem(DOOR_KEY);
    const door = createDoor();
    expect(door.read()).toBe('ask');
    door.pass(7);
    expect(localStorage.getItem(DOOR_KEY)).toBe('{"v":1,"state":"pass","at":7}');
    expect(createDoor().read()).toBe('pass');
    localStorage.removeItem(DOOR_KEY);
  });
});

describe('how long the door takes to open', () => {
  it('follows the player\'s motion settings', () => {
    expect(openingMs()).toBe(OPENING_MS.full);
    expect(openingMs({})).toBe(920);
    expect(openingMs({ reduced: true })).toBe(200);
    // The in-game Animations switch beats everything: no ceremony at all.
    expect(openingMs({ motionOff: true })).toBe(0);
    expect(openingMs({ motionOff: true, reduced: true })).toBe(0);
  });
});

// Claims against reality. The JS waits OPENING_MS.full before it hands over
// to the game, and the stylesheet plays the slot and the swing in that time:
// change one and not the other and the door is cut off mid-swing, or hangs
// open on nothing.
describe('the stylesheet and the opening agree', () => {
  const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
  const ms = (t) => (t.endsWith('ms') ? parseFloat(t) : parseFloat(t) * 1000);
  const timings = (name) => {
    const m = new RegExp(`animation:\\s*${name}\\s+([0-9.]+m?s)[^;]*?\\s([0-9.]+m?s)\\s+(?:both|forwards)`).exec(css);
    expect(m, `${name}'s animation in index.css`).not.toBeNull();
    return { duration: ms(m[1]), delay: ms(m[2]) };
  };

  it('slides the slot shut, then swings the door, in OPENING_MS.full', () => {
    const slot = timings('peep-shut');
    const swing = timings('door-swing');
    expect(slot.delay).toBe(0);
    expect(swing.delay).toBe(slot.duration);
    expect(swing.delay + swing.duration).toBe(OPENING_MS.full);
  });

  it('crossfades in OPENING_MS.reduced under reduced motion', () => {
    const m = /prefers-reduced-motion: reduce\)\s*\{[^@]*?animation:\s*door-fade\s+([0-9.]+m?s)/.exec(css);
    expect(m, 'the reduced-motion crossfade in index.css').not.toBeNull();
    expect(ms(m[1])).toBe(OPENING_MS.reduced);
  });
});

// door.js is on the boot path and read by the e2e helper in Node: no React, no
// Vite-only imports. (door.node.test.js imports it where there is no window at
// all, which is the proof that nothing runs at import time.)
describe('door.js stays pure', () => {
  const source = readFileSync(join(process.cwd(), 'src/lib/door.js'), 'utf8');
  const code = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  it('imports nothing', () => {
    expect(code).not.toMatch(/^\s*import\s/m);
    expect(code).not.toMatch(/import\.meta|require\(|import\(/);
  });
});
