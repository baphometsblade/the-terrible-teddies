// Thirty days of the pack loop for three profiles. Deterministic. The rules
// it spends are the live ones: packEconomy for the roll and the refund,
// convenience for the caps and the gem unlocks, the daily table and the
// collection sets for the grants a player actually receives.

import { COLLECTION_SETS } from './collectionBook';
import {
  CRAWL_SKIPS_PER_DAY, CRAWL_STOP_WAIT_MS, INSTANT_OPEN_GEMS, SHIELD_GEMS,
  deckSlotsFor, skipGemPrice, storageSlotsFor,
} from './convenience';
import {
  EARNED_OPENS_PER_DAY, bonusForOpen, cardsByRarity, dayKeyOf, mulberry32,
  rollPack, settlePull, streakCoins, valueOfPull,
} from './packEconomy';

const HOUR = 60 * 60 * 1000;

const battleCoins = (won, streak) => (won ? 25 + streak * 5 : 5);

/**
 * One local day of play. Mutates `p`. `rewards` is the 7-day login table.
 * Packs bought with coins are costed; packs from the login table are free
 * and still spend an open. Gem packs use the shared roll and cost no coins.
 */
const playDay = (p, dayIndex, ctx) => {
  const now = new Date(ctx.start.getTime() + dayIndex * 24 * HOUR);
  const today = dayKeyOf(now);
  p.soldToday = 0;
  p.opensToday = 0;

  const login = ctx.rewards[dayIndex % ctx.rewards.length];
  p.coins += login.coins || 0;
  p.gems += login.gems || 0;
  p.freePacks += login.packs || 0;
  p.loginStreak = Math.min(7, p.loginStreak + 1);

  // A modest slice of the quest board: one coin quest a casual night can
  // finish, three a dedicated night can. Not the whole board.
  p.coins += p.profile.questCoins;
  if (dayIndex % 7 === 6) {
    p.freePacks += p.profile.weeklyPacks || 0;
    p.bigPacks += p.profile.weeklyBig || 0;
  }

  let streak = 0;
  for (let b = 0; b < p.profile.battles; b += 1) {
    const won = ctx.rng() < p.profile.winRate;
    streak = won ? streak + 1 : 0;
    p.coins += battleCoins(won, streak);
    p.wins += won ? 1 : 0;
    p.battles += 1;
  }

  // The walk between crawl stops pays the next morning unless it is skipped.
  if (p.crawlOwed && !p.profile.paying) {
    p.crawlOwed = false;
    p.coins += 250;
    p.freePacks += 1;
    p.gates.crawlWait += 1;
  }
  if (p.battles > 0 && dayIndex % 7 === 6) {
    if (p.profile.paying && p.skipsToday < CRAWL_SKIPS_PER_DAY) {
      const price = skipGemPrice(CRAWL_STOP_WAIT_MS);
      if (p.gems >= price) {
        p.gems -= price;
        p.skipsToday += 1;
        p.coins += 250;
        p.freePacks += 1;
      }
    } else if (!p.profile.paying) {
      p.crawlOwed = true;
    }
  }

  if (p.profile.paying && !p.instant && p.gems >= INSTANT_OPEN_GEMS) {
    p.gems -= INSTANT_OPEN_GEMS;
    p.instant = true;
  }
  if (p.profile.paying && !p.storageBought && p.gems >= 60) {
    p.gems -= 60;
    p.storageBought = true;
  }
  if (p.profile.paying && !p.decksBought && p.gems >= 40) {
    p.gems -= 40;
    p.decksBought = true;
  }
  if (p.profile.paying && p.shields < 1 && p.gems >= SHIELD_GEMS && dayIndex === 0) {
    p.gems -= SHIELD_GEMS;
    p.shields = 1;
  }

  const cap = p.instant ? 1000 : EARNED_OPENS_PER_DAY;

  // Buy only what today can open. A bigger pile just sits on the cap.
  const queued = p.freePacks + p.bigPacks + p.packs + p.gemPacks;
  let room = Math.max(0, cap - queued);
  const buy = () => {
    if (room >= 10 && p.coins >= 1600) {
      p.coins -= 1600; p.packs += 10; p.spent += 1600; room -= 10; return true;
    }
    return false;
  };
  while (buy()) { /* one day's shelf */ }

  if (p.profile.paying) {
    while (p.gems >= 50) {
      p.gems -= 50;
      p.gemPacks += 1;
    }
  }

  let opened = 0;
  const openOne = (size, purchased) => {
    if (opened >= cap) {
      p.gates.openCap += 1;
      return false;
    }
    const rolled = rollPack({
      size, table: ctx.table, rng: ctx.rng, pity: p.pity, cardsByRarity: ctx.pools,
    });
    p.pity = rolled.pity;
    const room = storageSlotsFor(p.wins, p.storageBought, ctx.catalog) - p.owned.size;
    const soldBefore = p.soldToday;
    const settled = settlePull({
      cards: rolled.cards, owned: p.owned, soldToday: p.soldToday, storageLeft: Math.max(0, room),
    });
    p.owned = settled.owned;
    p.soldToday = settled.soldToday;
    if (settled.diminished) p.gates.diminished += 1;
    const openNo = p.opens + 1;
    let back = settled.coins + bonusForOpen(openNo);
    let streakPay = 0;
    if (p.streakDay !== today) {
      p.loginStreak = Math.min(7, Math.max(p.loginStreak, 1));
      streakPay = streakCoins(p.loginStreak);
      back += streakPay;
      p.streakDay = today;
    }
    p.coins += back;
    p.back += back;
    if (purchased) {
      p.boughtValue += valueOfPull(rolled.cards, soldBefore) + bonusForOpen(openNo) + streakPay;
    }
    p.opens += 1;
    opened += 1;
    p.opensToday += 1;
    return true;
  };

  while (p.packs > 0 && openOne(5, true)) p.packs -= 1;
  while (p.freePacks > 0 && openOne(5, false)) p.freePacks -= 1;
  while (p.bigPacks > 0 && openOne(10, false)) p.bigPacks -= 1;
  while (p.gemPacks > 0 && openOne(5, false)) p.gemPacks -= 1;

  // Set rewards, once each.
  for (const set of COLLECTION_SETS) {
    if (p.sets.has(set.id)) continue;
    const members = ctx.pools[set.id] || [];
    if (!members.length) continue;
    if (members.every((card) => p.owned.has(card.id))) {
      p.sets.add(set.id);
      p.coins += set.reward.coins || 0;
      p.freePacks += set.reward.packs || 0;
      p.setCoins += set.reward.coins || 0;
      if (p.setsDone[set.id] == null) p.setsDone[set.id] = dayIndex + 1;
    }
  }

  // Stars are a coin sink. They do not change a fight. The ceiling is 3.
  while (p.coins > 400 && p.maxStar < 3) {
    const cost = 40 * (p.maxStar + 1);
    if (p.coins < cost + 200) break;
    p.coins -= cost;
    p.maxStar += 1;
    if (p.starDay == null) p.starDay = dayIndex + 1;
  }

  p.deckSlots = deckSlotsFor(p.wins, p.decksBought);
  p.storage = storageSlotsFor(p.wins, p.storageBought, ctx.catalog);
  if (!p.instant && opened >= cap) p.gates.atCap += 1;
  if (p.owned.size >= ctx.catalog && p.completeDay == null) p.completeDay = dayIndex + 1;
  p.coinsEnd = p.coins;
};

const makePlayer = (profile, cards) => ({
  profile,
  coins: 500,
  gems: profile.paying ? 550 : 10,
  packs: 0,
  freePacks: 0,
  gemPacks: 0,
  bigPacks: 0,
  spent: 0,
  back: 0,
  boughtValue: 0,
  setCoins: 0,
  opens: 0,
  pity: 0,
  owned: new Set(cards.slice(0, 0)),
  wins: 0,
  battles: 0,
  loginStreak: 0,
  streakDay: '',
  soldToday: 0,
  opensToday: 0,
  instant: false,
  storageBought: false,
  decksBought: false,
  shields: 0,
  skipsToday: 0,
  crawlOwed: false,
  sets: new Set(),
  setsDone: {},
  maxStar: 0,
  starDay: null,
  completeDay: null,
  deckSlots: 3,
  storage: 36,
  gates: { openCap: 0, diminished: 0, crawlWait: 0, atCap: 0 },
  coinsEnd: 500,
});

/**
 * @param {object} args
 * @param {Array} args.cards live catalog
 * @param {Array} args.table PACK_ODDS.standard
 * @param {Array} args.rewards DAILY_REWARDS ({ coins, gems, packs })
 * @param {number} [args.days]
 * @param {number} [args.seed]
 * @param {Array<number>} [args.starter] owned ids on day 0
 */
export const simulateProfiles = ({
  cards, table, rewards, days = 30, seed = 0x5eed, starter = [],
}) => {
  const pools = cardsByRarity(cards);
  const profiles = {
    casual: { battles: 2, winRate: 0.5, questCoins: 60, paying: false, weeklyPacks: 1, weeklyBig: 0 },
    dedicated: { battles: 6, winRate: 0.62, questCoins: 220, paying: false, weeklyPacks: 2, weeklyBig: 1 },
    paying: { battles: 6, winRate: 0.62, questCoins: 220, paying: true, weeklyPacks: 2, weeklyBig: 1 },
  };
  const out = {};
  for (const [name, profile] of Object.entries(profiles)) {
    const rng = mulberry32(seed + name.length * 997);
    const player = makePlayer(profile, cards);
    for (const id of starter) player.owned.add(id);
    const ctx = {
      rng,
      table,
      rewards,
      pools,
      catalog: cards.length,
      start: new Date(2026, 0, 5),
    };
    for (let d = 0; d < days; d += 1) playDay(player, d, ctx);
    const margin = player.spent > 0 ? (player.boughtValue - player.spent) / player.spent : 0;
    out[name] = {
      days,
      netCoins: player.coinsEnd - 500,
      coins: player.coinsEnd,
      spent: player.spent,
      back: player.back,
      margin,
      packMargin: player.spent > 0 ? (player.back - player.spent) / player.spent : 0,
      withSets: player.spent > 0 ? (player.back + player.setCoins - player.spent) / player.spent : 0,
      opens: player.opens,
      owned: player.owned.size,
      catalog: cards.length,
      setsDone: { ...player.setsDone },
      daysToCommonSet: player.setsDone.common || null,
      daysToFullCollection: player.completeDay,
      maxStar: player.maxStar,
      starCap: 3,
      dayToMaxStar: player.starDay,
      deckSlots: player.deckSlots,
      deckCeiling: 5,
      storage: player.storage,
      storageCeiling: cards.length,
      gates: { ...player.gates },
      instant: player.instant,
    };
  }
  return out;
};
