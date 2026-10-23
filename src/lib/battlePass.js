// The Battle Pass: its reward table, and the arithmetic every screen does on it.
//
// A data module rather than part of the dialog, because four places read it
// and only one of them is the dialog: the main menu badges the tile from it
// (the boot path), the store delivers from it when a season ends, the empty
// Card Packs table names its pack tiers, and the battle board's result panel
// names the tier a battle opened. While the table lived in BattlePass.jsx,
// opening Card Packs downloaded the whole Battle Pass chunk to read it, and the
// board kept a hand-copied column of it so as not to do the same.
//
// No store import, so the store can import this.

// Each tier's two rewards. A reward is drawn from its `type` (and, for a card,
// from the card's own art), so there is no icon here.
export const BATTLE_PASS_REWARDS = [
  { tier: 1, xpRequired: 0, free: { type: 'coins', amount: 100 }, premium: { type: 'card', cardId: 7, name: 'Peeping Pete', rarity: 'uncommon' } },
  { tier: 2, xpRequired: 100, free: { type: 'pack', amount: 1 }, premium: { type: 'coins', amount: 500 } },
  { tier: 3, xpRequired: 250, free: { type: 'coins', amount: 150 }, premium: { type: 'gems', amount: 25 } },
  { tier: 4, xpRequired: 450, free: { type: 'gems', amount: 10 }, premium: { type: 'card', cardId: 62, name: 'Chainsmoke Chad', rarity: 'rare' } },
  { tier: 5, xpRequired: 700, free: { type: 'pack', amount: 1 }, premium: { type: 'exclusive', name: 'Gold Border' } },
  { tier: 6, xpRequired: 1000, free: { type: 'coins', amount: 200 }, premium: { type: 'pack', amount: 3 } },
  { tier: 7, xpRequired: 1350, free: { type: 'gems', amount: 15 }, premium: { type: 'card', cardId: 66, name: 'Mama Mauls', rarity: 'epic' } },
  { tier: 8, xpRequired: 1750, free: { type: 'pack', amount: 2 }, premium: { type: 'gems', amount: 50 } },
  { tier: 9, xpRequired: 2200, free: { type: 'coins', amount: 300 }, premium: { type: 'exclusive', name: 'Teddy Emote' } },
  { tier: 10, xpRequired: 2700, free: { type: 'pack', amount: 2 }, premium: { type: 'card', cardId: 69, name: 'Big Spoon, Last Warning', rarity: 'legendary' } },
  { tier: 11, xpRequired: 3250, free: { type: 'coins', amount: 350 }, premium: { type: 'gems', amount: 60 } },
  { tier: 12, xpRequired: 3850, free: { type: 'pack', amount: 2 }, premium: { type: 'pack', amount: 3 } },
  { tier: 13, xpRequired: 4500, free: { type: 'gems', amount: 20 }, premium: { type: 'card', cardId: 65, name: 'The Debt Collector', rarity: 'rare' } },
  { tier: 14, xpRequired: 5200, free: { type: 'coins', amount: 400 }, premium: { type: 'gems', amount: 70 } },
  { tier: 15, xpRequired: 5950, free: { type: 'pack', amount: 3 }, premium: { type: 'exclusive', name: 'Diamond Border' } },
  { tier: 16, xpRequired: 6750, free: { type: 'gems', amount: 25 }, premium: { type: 'card', cardId: 68, name: 'Duke of Dumpsterfire', rarity: 'epic' } },
  { tier: 17, xpRequired: 7600, free: { type: 'coins', amount: 450 }, premium: { type: 'coins', amount: 800 } },
  { tier: 18, xpRequired: 8500, free: { type: 'pack', amount: 3 }, premium: { type: 'pack', amount: 4 } },
  { tier: 19, xpRequired: 9450, free: { type: 'gems', amount: 30 }, premium: { type: 'card', cardId: 19, name: 'The Seam Reaper', rarity: 'epic' } },
  { tier: 20, xpRequired: 10450, free: { type: 'coins', amount: 500 }, premium: { type: 'gems', amount: 90 } },
  { tier: 21, xpRequired: 11500, free: { type: 'pack', amount: 4 }, premium: { type: 'exclusive', name: 'Confetti Cannon Emote' } },
  { tier: 22, xpRequired: 12600, free: { type: 'gems', amount: 35 }, premium: { type: 'card', cardId: 20, name: 'The Godfluffer', rarity: 'legendary' } },
  { tier: 23, xpRequired: 13750, free: { type: 'coins', amount: 550 }, premium: { type: 'coins', amount: 1000 } },
  { tier: 24, xpRequired: 14950, free: { type: 'pack', amount: 4 }, premium: { type: 'pack', amount: 5 } },
  { tier: 25, xpRequired: 16200, free: { type: 'pack', amount: 5 }, premium: { type: 'card', cardId: 21, name: 'Fluffpocalypse Now', rarity: 'legendary' } },
];

export const PREMIUM_PASS_PRICE = 500; // gems

export const TRACKS = ['free', 'premium'];

/** The pass as the helpers below read it, from the store's fields. */
export const passOf = (state) => ({
  seasonXP: state.seasonXP ?? 0,
  claimed: state.claimedBattlePassRewards ?? { free: [], premium: [] },
  hasPremium: !!state.hasBattlePassPremium,
});

/** The highest tier this much season XP has reached: 1 from the start, since tier 1 opens at 0. */
export const currentTier = (seasonXP, rewards = BATTLE_PASS_REWARDS) =>
  rewards.reduce((tier, r) => (seasonXP >= r.xpRequired ? r.tier : tier), 0);

/**
 * Whether one tile can be claimed now: its tier reached, not yet claimed, and
 * on the premium track only with the pass. The store's claim checks the same
 * three things, so a tile is offered exactly when the claim would succeed.
 */
export const canClaim = ({ seasonXP = 0, claimed, hasPremium = false }, row, track) =>
  seasonXP >= row.xpRequired
  && !(claimed?.[track] ?? []).includes(row.tier)
  && (track === 'free' || hasPremium);

/**
 * Every tile that can be claimed now, in tier order, free before premium:
 * what the "N ready" badges count, and what a season's end delivers.
 */
export const readyRewards = (pass, rewards = BATTLE_PASS_REWARDS) => {
  const out = [];
  for (const row of rewards) {
    for (const track of TRACKS) {
      if (row[track] && canClaim(pass, row, track)) out.push({ tier: row.tier, track, reward: row[track] });
    }
  }
  return out;
};

/** How many tiles are waiting to be claimed: one count for the menu tile and the dialog. */
export const countReadyRewards = (pass, rewards = BATTLE_PASS_REWARDS) => readyRewards(pass, rewards).length;

/**
 * Everything the premium track hands out over a season, added up from the
 * table, for the purchase confirmation to state in numbers.
 */
export const premiumTotals = (rewards = BATTLE_PASS_REWARDS) => {
  const totals = { coins: 0, gems: 0, packs: 0, cards: [], exclusives: [] };
  for (const { premium: r } of rewards) {
    if (!r) continue;
    if (r.type === 'coins') totals.coins += r.amount;
    else if (r.type === 'gems') totals.gems += r.amount;
    else if (r.type === 'pack') totals.packs += r.amount;
    else if (r.type === 'card') totals.cards.push(r);
    else if (r.type === 'exclusive') totals.exclusives.push(r.name);
  }
  return totals;
};

const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** "A", "A and B", "A, B and C". */
export const listOf = (items) => (items.length <= 1
  ? items.join('')
  : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/**
 * What a set of claims handed over, in one line, from the store's receipts
 * (see claimBattlePassTier): coins (a card already owned pays its duplicate
 * coins, so those are counted here), gems, packs, then the cards and cosmetics
 * that are new. A cosmetic already owned is not granted twice and so is not
 * listed. Empty when nothing was handed over.
 */
export const describeGrants = (receipts) => {
  let coins = 0;
  let gems = 0;
  let packs = 0;
  const cards = [];
  const cosmetics = [];
  for (const r of receipts) {
    coins += r.coins ?? 0;
    gems += r.gems ?? 0;
    packs += r.packs ?? 0;
    if (r.card && !r.alreadyOwned) cards.push(r.card.name);
    if (r.cosmetic && !r.alreadyOwned) cosmetics.push(r.cosmetic);
  }
  const parts = [];
  if (coins) parts.push(`+${plural(coins, 'coin')}`);
  if (gems) parts.push(`+${plural(gems, 'gem')}`);
  if (packs) parts.push(plural(packs, 'card pack'));
  // Three names at most: a skipped season can deliver every card on the track.
  if (cards.length > 3) parts.push(plural(cards.length, 'new card'));
  else parts.push(...cards);
  parts.push(...cosmetics);
  return listOf(parts);
};
