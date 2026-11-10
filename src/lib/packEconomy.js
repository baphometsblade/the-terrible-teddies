// The pack loop. One table for every pack, whether the coins were earned or
// the pack was bought with gems. Gems never buy a better card, a faster pity
// timer, or a richer sell-back. They buy time (see src/lib/convenience.js).
//
// The figures below are the ones the client rolls and the ones
// settle_pack_open recomputes. A screen that quotes a rate has to read it
// from here, not from a string beside it.

export const SELLBACK_RATE = 0.4;
// Past the day's full-rate cap, sell-back pays half of that (20% of the bar).
export const DIMINISHED_RATE = 0.2;
// Coins of full-rate sell-back in a local day. Anything past this is diminished.
export const SELLBACK_FULL_CAP = 1700;
// The in-pack coin bonus. Exactly one pack in six, not a hidden roll.
export const BONUS_EVERY = 6;
export const BONUS_COINS = 72;
// A pack with nothing rare or better advances pity. The 10th such pack
// upgrades one card to rare, then pity resets. Same counter for every source.
export const PITY_EVERY = 10;
export const PITY_RARITY = 'rare';
// Free opens in a local day. Instant open (a gem unlock) is the only way past it.
export const EARNED_OPENS_PER_DAY = 10;
export const STREAK_CAP = 7;
// Once a day, on the first open, a login-style streak this long pays this many
// coins. Index 0 is unused. Day 7 is the ceiling.
export const STREAK_COINS = Object.freeze([0, 6, 8, 10, 12, 14, 16, 18]);

// What a duplicate is worth at the bar, before the 40% sell-back. Star costs
// stay on coinsForDuplicate; this table is only the pack refund.
export const BAR = Object.freeze({
  common: 38,
  uncommon: 76,
  rare: 148,
  epic: 252,
  legendary: 548,
});

export const RARE_OR_BETTER = new Set(['rare', 'epic', 'legendary']);

export const barValue = (rarity) => {
  const n = BAR[rarity];
  return n > 0 ? n : 0;
};

export const fullSellback = (rarity) => Math.floor(barValue(rarity) * SELLBACK_RATE);

/**
 * Sell one duplicate. `soldToday` is the full-rate coins already paid out
 * today (the cap is on that, so diminishing cannot be dodged by ordering).
 * Returns the coins to pay, and the full-rate amount to add to the day's tally.
 */
export const quoteSellback = (rarity, soldToday) => {
  const full = fullSellback(rarity);
  const sold = Math.max(0, Math.floor(Number(soldToday) || 0));
  const room = Math.max(0, SELLBACK_FULL_CAP - sold);
  if (full <= room) return { coins: full, tally: full, diminished: false };
  const over = full - room;
  const dim = Math.floor(over * (DIMINISHED_RATE / SELLBACK_RATE));
  return { coins: room + dim, tally: full, diminished: true };
};

/** The coin bonus on this open, counting from 1. Open 6, 12, 18… pay it. */
export const bonusForOpen = (openNumber) => {
  const n = Math.floor(Number(openNumber) || 0);
  return n > 0 && n % BONUS_EVERY === 0 ? BONUS_COINS : 0;
};

/** Streak coins for a streak of this many days, capped at 7. */
export const streakCoins = (streak) => {
  const day = Math.max(0, Math.min(STREAK_CAP, Math.floor(Number(streak) || 0)));
  return STREAK_COINS[day] || 0;
};

export const dayKeyOf = (now) => {
  const d = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(d.getTime())) return '';
  return d.toDateString();
};

/**
 * Whether a free open is allowed. `instant` skips the daily cap. The cap
 * resets when `day` is not `today`. A missing day is a fresh day.
 */
export const openAllowed = ({ earnedOpensToday, earnedOpensDay, today, instant }) => {
  if (instant) return true;
  const used = earnedOpensDay === today ? Math.max(0, Math.floor(Number(earnedOpensToday) || 0)) : 0;
  return used < EARNED_OPENS_PER_DAY;
};

const cardOf = (pool, rng) => {
  if (!pool || !pool.length) return null;
  const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[i];
};

/**
 * Roll one pack. `rng` returns a number in [0, 1). `table` is the shared
 * odds (PACK_ODDS.standard). Every source passes that same table. Pity is
 * the count of opens since a rare or better; this open is included.
 */
export const rollPack = ({ size, table, rng, pity, cardsByRarity }) => {
  const n = Math.max(0, Math.floor(Number(size) || 0));
  const total = table.reduce((sum, [, w]) => sum + w, 0);
  const rarities = [];
  for (let i = 0; i < n; i += 1) {
    let edge = 0;
    const roll = rng() * total;
    let picked = table[table.length - 1][0];
    for (const [rarity, weight] of table) {
      edge += weight;
      if (roll < edge) { picked = rarity; break; }
    }
    rarities.push(picked);
  }
  let nextPity = Math.max(0, Math.floor(Number(pity) || 0)) + 1;
  let pityHit = false;
  if (!rarities.some((r) => RARE_OR_BETTER.has(r)) && nextPity >= PITY_EVERY) {
    rarities[n - 1] = PITY_RARITY;
    nextPity = 0;
    pityHit = true;
  } else if (rarities.some((r) => RARE_OR_BETTER.has(r))) {
    nextPity = 0;
  }
  const cards = rarities.map((rarity) => {
    const card = cardOf(cardsByRarity[rarity], rng) || cardOf(cardsByRarity.common, rng);
    return card ? { ...card, rarity: card.rarity } : null;
  }).filter(Boolean);
  return { cards, rarities, pity: nextPity, pityHit };
};

/**
 * Coins for a pull the player already rolled. New uniques within the storage
 * cap are kept. A duplicate, or a new card that does not fit, sells back.
 * `owned` is mutated with the cards that were kept. `soldToday` is updated
 * and returned.
 */
export const settlePull = ({ cards, owned, soldToday, storageLeft }) => {
  const have = owned instanceof Set ? owned : new Set(owned || []);
  let sold = Math.max(0, Math.floor(Number(soldToday) || 0));
  let coins = 0;
  let kept = 0;
  let dupes = 0;
  let diminished = false;
  let room = Math.max(0, Math.floor(Number(storageLeft) || 0));
  const keptIds = [];
  for (const card of cards || []) {
    if (!card) continue;
    const id = card.id;
    if (have.has(id) || room <= 0) {
      const quote = quoteSellback(card.rarity, sold);
      coins += quote.coins;
      sold += quote.tally;
      if (quote.diminished) diminished = true;
      dupes += 1;
    } else {
      have.add(id);
      keptIds.push(id);
      kept += 1;
      room -= 1;
    }
  }
  return { coins, soldToday: sold, kept, dupes, diminished, keptIds, owned: have };
};

export const cardsByRarity = (cards) => {
  const out = { common: [], uncommon: [], rare: [], epic: [], legendary: [] };
  for (const card of cards || []) {
    if (out[card.rarity]) out[card.rarity].push(card);
  }
  return out;
};

export const valueOfPull = (cards, soldToday) => {
  let cursor = Math.max(0, Math.floor(Number(soldToday) || 0));
  let coins = 0;
  for (const card of cards || []) {
    const quote = quoteSellback(card.rarity, cursor);
    cursor += quote.tally;
    coins += quote.coins;
  }
  return coins;
};
export const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Mean coins a pack of `size` returns when every card is a duplicate (the
 * steady state), including the 1-in-6 bonus and pity, over `samples` opens.
 */
export const steadyReturn = ({ table, cards, size, samples, seed }) => {
  const pools = cardsByRarity(cards);
  const rng = mulberry32(seed);
  const owned = new Set((cards || []).map((c) => c.id));
  let pity = 0;
  let coins = 0;
  let soldToday = 0;
  const opens = Math.max(1, samples);
  for (let i = 1; i <= opens; i += 1) {
    if ((i - 1) % 10 === 0) soldToday = 0;
    const rolled = rollPack({ size, table, rng, pity, cardsByRarity: pools });
    pity = rolled.pity;
    const settled = settlePull({
      cards: rolled.cards, owned, soldToday, storageLeft: 0,
    });
    soldToday = settled.soldToday;
    coins += settled.coins + bonusForOpen(i);
  }
  return coins / opens;
};
