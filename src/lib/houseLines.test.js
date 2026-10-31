import { describe, it, expect } from 'vitest';
import {
  RECEIPT_FOOTERS, pickLine, LAST_CALL_BANNER, lastCallLog, TAB_COPY,
} from './houseLines';
import { OPPONENT_NAME } from '@/utils/teddyTalk';

// The budgets are the slots the lines go into, written down here rather than
// exported from the module: a cap the data could raise for itself would be no
// cap at all.
//  - a footer: two receipt lines at 320px (about 32 characters of the
//    receipt's type each), and the brief's 44 keeps it from needing a third;
//  - the banner: a title-sized line across the felt, as wide as "Chuck's turn"
//    plus a little;
//  - a row label: one receipt line with its figure and a leader between.
const FOOTER_MAX = 44;
const BANNER_MAX = 14;
const LABEL_MAX = 16;
const LOG_MAX = 80;

describe('RECEIPT_FOOTERS', () => {
  it('is a list of distinct, non-empty one-liners that each fit a receipt', () => {
    expect(RECEIPT_FOOTERS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(RECEIPT_FOOTERS).size).toBe(RECEIPT_FOOTERS.length);
    for (const line of RECEIPT_FOOTERS) {
      expect(typeof line).toBe('string');
      expect(line.trim(), 'a footer is not blank').not.toBe('');
      expect(line.length, `"${line}" is ${line.length} characters`).toBeLessThanOrEqual(FOOTER_MAX);
      expect(line, 'a footer is one line, not a paragraph').not.toMatch(/\n/);
    }
  });

  it('keeps the five lines the Tab opened with', () => {
    expect(RECEIPT_FOOTERS).toEqual(expect.arrayContaining([
      'Gratuity not included. Neither is dignity.',
      'Tip your bartender. She saw everything.',
      'Leave quietly. The neighbors have lawyers.',
      'Last one out kicks Chuck.',
      'Your server: nobody. Get it yourself.',
    ]));
  });

  // The footer sits under the coins the battle paid: it jokes about the night,
  // never about the player's money. No joke in the game uses "refund" or "all
  // sales final" (the store's real refund copy has to stay unmistakable), and
  // none shames anyone for being broke.
  it('does not joke about refunds, final sales or being broke', () => {
    for (const line of RECEIPT_FOOTERS) {
      expect(line, line).not.toMatch(/refund|all sales final|\bbroke\b/i);
    }
  });
});

describe('pickLine', () => {
  const list = ['a', 'b', 'c'];

  it('picks from the list', () => {
    for (let i = 0; i < 30; i++) expect(list).toContain(pickLine(list));
  });

  it('never repeats the previous line back to back', () => {
    let last = pickLine(list);
    for (let i = 0; i < 80; i++) {
      const next = pickLine(list, last);
      expect(next).not.toBe(last);
      last = next;
    }
  });

  it('reaches every line, so none is dead weight in the list', () => {
    const seen = new Set();
    let last = null;
    for (let i = 0; i < 200; i++) {
      last = pickLine(list, last);
      seen.add(last);
    }
    expect([...seen].sort()).toEqual(list);
  });

  it('returns the only line there is, even when it was the last', () => {
    expect(pickLine(['only'], 'only')).toBe('only');
  });

  it('returns null for an empty or missing list instead of crashing a screen', () => {
    expect(pickLine([])).toBeNull();
    expect(pickLine(undefined)).toBeNull();
    expect(pickLine(null)).toBeNull();
  });

  it('is what the footers rotate through', () => {
    let last = null;
    for (let i = 0; i < 60; i++) {
      const next = pickLine(RECEIPT_FOOTERS, last);
      expect(RECEIPT_FOOTERS).toContain(next);
      expect(next).not.toBe(last);
      last = next;
    }
  });
});

describe('last call copy', () => {
  it('has a banner that fits where the turn banner goes', () => {
    expect(LAST_CALL_BANNER).toBe('Last call');
    expect(LAST_CALL_BANNER.length).toBeLessThanOrEqual(BANNER_MAX);
  });

  it('logs who is down and by how much, for either side', () => {
    expect(lastCallLog('opponent', 4)).toBe(`Last call. House lights up — ${OPPONENT_NAME}'s down to 4 HP.`);
    expect(lastCallLog('player', 5)).toBe('Last call. House lights up — you\'re down to 5 HP.');
  });

  it('keeps the log line short at any HP the game can show', () => {
    for (const side of ['player', 'opponent']) {
      for (const hp of [1, 5, 10, 35]) {
        expect(lastCallLog(side, hp).length).toBeLessThanOrEqual(LOG_MAX);
        expect(lastCallLog(side, hp)).toContain(`${hp} HP`);
      }
    }
  });
});

describe('TAB_COPY', () => {
  it('keeps the receipt\'s header as the name the rewards have always had', () => {
    // e2e/smoke.spec.js finds the result panel's rewards by this text.
    expect(TAB_COPY.header).toBe('Battle Rewards');
    expect(TAB_COPY.title).toBe('THE TAB');
  });

  it('has a label for every row, each short enough for one receipt line', () => {
    for (const key of ['cards', 'damage', 'healed', 'taken', 'xp', 'coins', 'chuck']) {
      expect(typeof TAB_COPY[key], key).toBe('string');
      expect(TAB_COPY[key].trim(), key).not.toBe('');
      expect(TAB_COPY[key].length, `${key}: "${TAB_COPY[key]}"`).toBeLessThanOrEqual(LABEL_MAX);
    }
  });

  it('names Chuck\'s tab after Chuck, in capitals as a receipt prints it', () => {
    expect(TAB_COPY.chuck).toBe('CHUCK\'S TAB');
    expect(TAB_COPY.chuck).toBe(`${OPPONENT_NAME.toUpperCase()}'S TAB`);
    expect(TAB_COPY.chuckStatus).toBe('STILL OPEN');
  });
});
