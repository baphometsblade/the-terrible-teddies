import { describe, it, expect } from 'vitest';
import {
  applyMulligan, mulliganOpponentDeck, mulliganKeptLine, mulliganSwapLine, mulliganOpponentLine,
  MULLIGAN_MAX_COST,
} from './mulligan';

const card = (id, cost) => ({ instanceId: id, name: id, cost });

describe('opening mulligan', () => {
  it('keeps the hand when nothing is thrown back', () => {
    const hand = [card('a', 2), card('b', 3)];
    const deck = [card('c', 1)];
    const next = applyMulligan(hand, deck, new Set());
    expect(next.hand).toEqual(hand);
    expect(next.deck).toEqual(deck);
    expect(next.drawn).toBe(0);
    expect(mulliganKeptLine()).toBe('You kept the hand.');
  });

  it('puts the thrown cards back, shuffles, and draws the same number', () => {
    const hand = [card('a', 2), card('b', 8), card('c', 1)];
    const deck = [card('d', 3), card('e', 2)];
    const random = () => 0.999;
    const next = applyMulligan(hand, deck, new Set(['b']), random);
    expect(next.drawn).toBe(1);
    expect(next.hand.map((c) => c.instanceId)).toEqual(['a', 'c', 'd']);
    expect(next.deck.map((c) => c.instanceId)).toEqual(['e', 'b']);
    expect(mulliganSwapLine(1)).toBe('Threw 1 back. Drew 1.');
    expect(mulliganSwapLine(2).length).toBeLessThanOrEqual(90);
  });

  it('throws back an AI card only when it costs more than 4, and draws that many', () => {
    const deck = [card('cheap', 2), card('rich', 6), card('mid', MULLIGAN_MAX_COST), card('spare', 1)];
    const next = mulliganOpponentDeck(deck, { random: () => 0.999 });
    expect(next.tossed).toBe(1);
    expect(next.deck.map((c) => c.instanceId)).toEqual(['cheap', 'mid', 'spare', 'rich']);
    expect(mulliganOpponentLine('Chuck', 1)).toBe('Chuck threw back 1 that cost too much.');
  });

  it('leaves a deck of affordable cards alone', () => {
    const deck = [card('a', 1), card('b', 4)];
    expect(mulliganOpponentDeck(deck)).toEqual({ deck, tossed: 0 });
  });
});
