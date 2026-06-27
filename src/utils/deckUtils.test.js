import { shuffleDeck, drawCardFromDeck } from './deckUtils';

// Helper: compares two arrays as multisets (same elements, same counts,
// order-independent). Works for primitive elements.
const sortedCopy = (arr) => [...arr].sort();
const isPermutation = (a, b) =>
  a.length === b.length &&
  JSON.stringify(sortedCopy(a)) === JSON.stringify(sortedCopy(b));

describe('shuffleDeck', () => {
  it('returns an array of the same length as the input', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffleDeck(input);
    expect(result).toHaveLength(input.length);
  });

  it('returns a permutation of the input (same multiset of elements)', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    const result = shuffleDeck(input);
    expect(isPermutation(result, input)).toBe(true);
  });

  it('preserves duplicate elements with their counts', () => {
    const input = [1, 1, 2, 2, 2, 3];
    const result = shuffleDeck(input);
    expect(isPermutation(result, input)).toBe(true);
  });

  it('does not mutate the input array (non-mutating implementation)', () => {
    const input = [1, 2, 3, 4, 5];
    const snapshot = [...input];
    shuffleDeck(input);
    expect(input).toEqual(snapshot);
  });

  it('returns a new array instance, not the same reference', () => {
    const input = [1, 2, 3];
    const result = shuffleDeck(input);
    expect(result).not.toBe(input);
  });

  it('returns an empty array for an empty input', () => {
    const result = shuffleDeck([]);
    expect(result).toEqual([]);
  });

  it('returns the single element unchanged for a one-element array', () => {
    const result = shuffleDeck([42]);
    expect(result).toEqual([42]);
  });

  it('produces a deterministic order when Math.random is stubbed', () => {
    // Fisher-Yates loop: i goes 4,3,2,1. j = floor(random * (i+1)).
    // With random fixed at 0, j is always 0, so element[i] swaps with element[0].
    // Trace on [0,1,2,3,4]:
    //   i=4: swap idx4<->idx0 -> [4,1,2,3,0]
    //   i=3: swap idx3<->idx0 -> [3,1,2,4,0]
    //   i=2: swap idx2<->idx0 -> [2,1,3,4,0]
    //   i=1: swap idx1<->idx0 -> [1,2,3,4,0]
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = shuffleDeck([0, 1, 2, 3, 4]);
    expect(result).toEqual([1, 2, 3, 4, 0]);
    spy.mockRestore();
  });
});

describe('drawCardFromDeck', () => {
  it('draws the first card and returns the remaining deck', () => {
    const deck = ['top', 'middle', 'bottom'];
    const { newDeck, drawnCard } = drawCardFromDeck(deck);
    expect(drawnCard).toBe('top');
    expect(newDeck).toEqual(['middle', 'bottom']);
  });

  it('does not mutate the input deck', () => {
    const deck = ['top', 'middle', 'bottom'];
    const snapshot = [...deck];
    drawCardFromDeck(deck);
    expect(deck).toEqual(snapshot);
  });

  it('returns a null card and an empty deck for an empty deck', () => {
    const { newDeck, drawnCard } = drawCardFromDeck([]);
    expect(drawnCard).toBeNull();
    expect(newDeck).toEqual([]);
  });

  it('empties the deck after drawing the only card', () => {
    const { newDeck, drawnCard } = drawCardFromDeck(['solo']);
    expect(drawnCard).toBe('solo');
    expect(newDeck).toEqual([]);
  });
});
