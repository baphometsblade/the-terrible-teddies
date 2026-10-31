// The pack reveal's summary chips: one line each, picked once per reveal.
//
// Card-agnostic on purpose (lead-decisions s1): these sit under a pull of
// random cards, so they name no card and say nothing about how one looks.
// {n} is the number of new cards (1-10), {coins} the coins duplicates paid.
// The first line of each pool is also the fixed fallback.

export const PACK_REVEAL_NEW = [
  '{n} new. Don’t make a scene.',
  '{n} new. None of them sober.',
  '{n} new. The regulars are staring.',
  '{n} new. They found the bar.',
  '{n} new. Mind the broken glass.',
  '{n} new. Open a window.',
  '{n} new. Someone’s going to puke.',
];

export const PACK_REVEAL_DUPES = [
  '+{coins} coins. Repeat customers.',
  '+{coins} coins. We know that face.',
  '+{coins} coins. Back for seconds.',
  '+{coins} coins for the usuals.',
  '+{coins} coins. Same stink.',
];

// The slot is a chip that wraps inside itself; the deck's budget for each line.
export const PACK_REVEAL_MAX_CHARS = 34;

// The index to use for a pool: a random one that is not `last` when the pool
// has a choice. `rand` is injectable for tests.
export function pickIndex(pool, last = -1, rand = Math.random) {
  if (pool.length < 2) return 0;
  let i = Math.floor(rand() * pool.length);
  if (i === last) i = (i + 1) % pool.length;
  return i;
}

// The two lines of one reveal, as indexes (so the caller can remember them).
export function pickRevealLines(last = { fresh: -1, dupes: -1 }, rand = Math.random) {
  return {
    fresh: pickIndex(PACK_REVEAL_NEW, last.fresh, rand),
    dupes: pickIndex(PACK_REVEAL_DUPES, last.dupes, rand),
  };
}

export const freshLine = (index, n) => PACK_REVEAL_NEW[index].replace('{n}', String(n));
export const dupesLine = (index, coins) => PACK_REVEAL_DUPES[index].replace('{coins}', String(coins));
