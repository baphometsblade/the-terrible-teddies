import { describe, it, expect } from 'vitest';
import { RESULT_TITLES, RESULT_SUBLINES, pickResultCopy } from './resultLines';
import { RECEIPT_FOOTERS } from '@/lib/houseLines';
import { OPPONENT_NAME } from './teddyTalk';

// What a headline and its line under it can run to in the result panel at
// 320px: the headline is title-sized capitals, the line is body text, and the
// panel has to leave Play Again within reach on a short phone. These character
// caps are coarse guards; e2e/board.spec.js sets every line into the real
// panel at 320px and measures it.
const TITLE_MAX = 32;
const SUBLINE_MAX = 60;

describe('the result panel\'s lines', () => {
  it('keeps every line the panel shipped with', () => {
    expect(RESULT_TITLES.win).toContain('TOTAL FLUFFING VICTORY!');
    expect(RESULT_TITLES.loss).toContain('ABSOLUTELY UNSTUFFED!');
    expect(RESULT_SUBLINES.win).toContain(`${OPPONENT_NAME} rage-quit into the toy chest.`);
    expect(RESULT_SUBLINES.loss).toContain(`${OPPONENT_NAME} is doing a victory lap. It's insufferable.`);
  });

  it('has a list for a win and a loss of each, none empty, none repeating itself', () => {
    for (const table of [RESULT_TITLES, RESULT_SUBLINES]) {
      for (const side of ['win', 'loss']) {
        expect(Array.isArray(table[side]), side).toBe(true);
        expect(table[side].length, side).toBeGreaterThan(0);
        expect(new Set(table[side]).size, side).toBe(table[side].length);
        for (const line of table[side]) expect(line.trim(), side).not.toBe('');
      }
    }
    // There is more than one sub-line to rotate through, or Play Again would
    // answer with the same sentence every time.
    expect(RESULT_SUBLINES.win.length).toBeGreaterThanOrEqual(2);
    expect(RESULT_SUBLINES.loss.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps each line within what the panel holds', () => {
    for (const side of ['win', 'loss']) {
      for (const line of RESULT_TITLES[side]) {
        expect(line.length, `"${line}" is ${line.length}`).toBeLessThanOrEqual(TITLE_MAX);
      }
      for (const line of RESULT_SUBLINES[side]) {
        expect(line.length, `"${line}" is ${line.length}`).toBeLessThanOrEqual(SUBLINE_MAX);
      }
    }
  });
});

describe('pickResultCopy', () => {
  it('picks a win\'s lines from the win lists and a loss\'s from the loss lists', () => {
    for (let i = 0; i < 30; i++) {
      const win = pickResultCopy(true);
      expect(RESULT_TITLES.win).toContain(win.title);
      expect(RESULT_SUBLINES.win).toContain(win.subline);
      expect(RECEIPT_FOOTERS).toContain(win.footer);
      const loss = pickResultCopy(false);
      expect(RESULT_TITLES.loss).toContain(loss.title);
      expect(RESULT_SUBLINES.loss).toContain(loss.subline);
      expect(RECEIPT_FOOTERS).toContain(loss.footer);
    }
  });

  it('never answers with the line it just showed, when there is another', () => {
    for (const won of [true, false]) {
      let last = pickResultCopy(won);
      for (let i = 0; i < 60; i++) {
        const next = pickResultCopy(won, last);
        expect(next.subline, 'sub-line').not.toBe(last.subline);
        expect(next.footer, 'footer').not.toBe(last.footer);
        if (RESULT_TITLES[won ? 'win' : 'loss'].length > 1) expect(next.title, 'title').not.toBe(last.title);
        last = next;
      }
    }
  });

  it('does not mind a last pick from the other side, or none', () => {
    const loss = pickResultCopy(false);
    expect(RESULT_SUBLINES.win).toContain(pickResultCopy(true, loss).subline);
    expect(RESULT_SUBLINES.win).toContain(pickResultCopy(true, null).subline);
    expect(RESULT_SUBLINES.win).toContain(pickResultCopy(true, {}).subline);
  });
});
