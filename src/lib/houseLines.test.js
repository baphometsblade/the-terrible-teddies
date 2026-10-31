import { describe, it, expect } from 'vitest';
import {
  RECEIPT_FOOTERS, pickLine, LAST_CALL_BANNER, lastCallLog, TAB_COPY, BOARD_LINES, fillLine, LEAVE_ASIDE,
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

  // The copy deck replaces the provisional footers, so nothing pins a
  // particular one; what is pinned is that there is variety to rotate through
  // and that the footer does not repeat the panel around it (Chuck is already
  // on the result panel three times over, and "dignity" is the loss line's).
  it('has enough footers to rotate, and leaves Chuck and dignity to the rest of the panel', () => {
    expect(RECEIPT_FOOTERS.length).toBeGreaterThanOrEqual(8);
    for (const line of RECEIPT_FOOTERS) {
      expect(line, line).not.toMatch(/chuck|dignity/i);
    }
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

// The board's recurring lines. The first of each list is what the board
// shipped with; the budgets are the slots (written here, not exported).
describe('BOARD_LINES', () => {
  const BANNER = 13; // a turn banner across the felt at 320px
  const THINKING = 44; // the italic row under the table
  const LOG = 90; // a log entry is read aloud, and wraps on a phone

  it('keeps the line each slot shipped with as its first', () => {
    expect(BOARD_LINES.bannerPlayer[0]).toBe('Your turn');
    expect(BOARD_LINES.bannerChuck[0]).toBe(`${OPPONENT_NAME}'s turn`);
    expect(BOARD_LINES.thinking[0]).toBe(`${OPPONENT_NAME} is making his move…`);
    expect(BOARD_LINES.yourTurn[0]).toBe('Your turn. Get him.');
    expect(BOARD_LINES.chuckTurn[0]).toBe(`${OPPONENT_NAME}'s turn. Brace your beans.`);
    expect(BOARD_LINES.endTurn[0]).toBe('Ending turn...');
  });

  it('has every list distinct, with enough to rotate', () => {
    for (const [key, list] of Object.entries(BOARD_LINES)) {
      expect(list.length, key).toBeGreaterThanOrEqual(3);
      expect(new Set(list).size, key).toBe(list.length);
    }
  });

  it('fits the slots: banners 13 characters, the thinking row 44, a log entry 90', () => {
    for (const key of ['bannerPlayer', 'bannerChuck']) {
      for (const line of BOARD_LINES[key]) expect(line.length, line).toBeLessThanOrEqual(BANNER);
    }
    for (const line of BOARD_LINES.thinking) expect(line.length, line).toBeLessThanOrEqual(THINKING);
    for (const key of ['yourTurn', 'chuckTurn', 'endTurn', 'chuckPlays', 'oppHit', 'oppFace', 'conceded']) {
      for (const line of BOARD_LINES[key]) expect(line.length, line).toBeLessThanOrEqual(LOG);
    }
  });

  it('keeps the facts: whose turn it is, and the "Ending turn" and "You conceded" the specs find', () => {
    for (const line of BOARD_LINES.chuckTurn) expect(line).toMatch(new RegExp(`^${OPPONENT_NAME}'s turn`));
    for (const line of BOARD_LINES.yourTurn) expect(line).toMatch(/^Your turn/);
    for (const line of BOARD_LINES.endTurn) expect(line).toMatch(/^Ending turn/);
    for (const line of BOARD_LINES.conceded) expect(line).toMatch(/^You conceded\./);
    // The first-turn line is the one the specs pin, and is not rotated.
    expect(BOARD_LINES.yourTurn).not.toContain('Your turn. Make it hurt.');
  });

  it('puts every number and name a hit reports into the line, and the card early in a play', () => {
    for (const line of BOARD_LINES.oppHit) {
      for (const slot of ['{attacker}', '{target}', '{dmg}', '{hp}']) expect(line, line).toContain(slot);
    }
    for (const line of BOARD_LINES.oppFace) {
      for (const slot of ['{attacker}', '{dmg}']) expect(line, line).toContain(slot);
    }
    // The phone ticker cuts a log line to one, so the card's name has to be in
    // the part that survives the cut.
    for (const line of BOARD_LINES.chuckPlays) expect(line.indexOf('{card}'), line).toBeGreaterThan(-1);
    for (const line of BOARD_LINES.chuckPlays) expect(line.indexOf('{card}'), line).toBeLessThanOrEqual(32);
  });
});

describe('fillLine', () => {
  it('fills each slot, every time it appears', () => {
    expect(fillLine('{a} hit {b} for {n} ({a})', { a: 'Barry', b: 'Pete', n: 4 })).toBe('Barry hit Pete for 4 (Barry)');
  });

  it('keeps a number of zero and leaves a slot with no value as written', () => {
    expect(fillLine('{n} damage', { n: 0 })).toBe('0 damage');
    expect(fillLine('{x} damage', {})).toBe('{x} damage');
    expect(fillLine('no slots')).toBe('no slots');
  });

  it('turns every deck line into a sentence with no slot left over', () => {
    const values = { card: 'Bar-Fight Barry', attacker: 'Barry', target: 'Pete', dmg: 3, hp: 2 };
    for (const key of ['chuckPlays', 'oppHit', 'oppFace']) {
      for (const line of BOARD_LINES[key]) expect(fillLine(line, values), line).not.toMatch(/[{}]/);
    }
  });
});

describe('LEAVE_ASIDE', () => {
  it('has a line for the menu and one for Concede, each short enough for the dialog', () => {
    for (const key of ['leave', 'concede']) {
      expect(LEAVE_ASIDE[key].length, key).toBeLessThanOrEqual(48);
    }
    expect(LEAVE_ASIDE.leave).not.toBe(LEAVE_ASIDE.concede);
  });
});
