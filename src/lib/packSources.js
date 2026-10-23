import { SHOP_ITEMS, DAILY_REWARDS } from '@/stores/gameStore';

// Where a player's next card pack comes from, with real numbers, for the empty
// Card Packs table. Each reads the table that actually grants the pack, so the
// numbers move when the economy does.

/** The cheapest coin-priced pack, and how far `coins` is from it. */
export const nextCoinPack = (coins, items = SHOP_ITEMS) => {
  let item = null;
  for (const i of items) {
    if (i.type === 'pack' && i.currency === 'coins' && (!item || i.price < item.price)) item = i;
  }
  if (!item) return null;
  return { item, short: Math.max(0, item.price - coins), progress: Math.min(1, Math.max(0, coins / item.price)) };
};

/**
 * The cheapest pack sold for gems (a guaranteed-rarity pack), and how far
 * `gems` is from it: the source a "Get gems" route leads to.
 */
export const nextGemPack = (gems, items = SHOP_ITEMS) => {
  let item = null;
  for (const i of items) {
    if (['pack', 'premium', 'legendary'].includes(i.type) && i.currency === 'gems' && (!item || i.price < item.price)) item = i;
  }
  if (!item) return null;
  return { item, short: Math.max(0, item.price - gems) };
};

/**
 * The Battle Pass tier whose reward is packs that the player should look to
 * next: one already reached and not yet claimed, else the lowest still ahead.
 * The free track always, the premium track only if the pass is owned.
 */
export const nextPassPack = ({ seasonXP = 0, claimed = { free: [], premium: [] }, hasPremium = false }, rewards) => {
  const open = [];
  for (const r of rewards) {
    for (const track of hasPremium ? ['free', 'premium'] : ['free']) {
      const reward = r[track];
      if (reward?.type !== 'pack' || claimed[track]?.includes(r.tier)) continue;
      open.push({
        tier: r.tier,
        track,
        packs: reward.amount,
        ready: seasonXP >= r.xpRequired,
        xpToGo: Math.max(0, r.xpRequired - seasonXP),
      });
    }
  }
  return open.find((p) => p.ready) ?? open.find((p) => !p.ready) ?? null;
};

/**
 * The next login-streak day that gives packs, and how many days away it is
 * if the streak is kept. Mirrors checkDailyLogin: a claim the day after the
 * last one extends the streak, any later claim restarts it at day 1.
 */
export const nextDailyPack = ({ consecutiveLogins = 0, lastLoginDate = null }, today = new Date(), rewards = DAILY_REWARDS) => {
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const claimedToday = lastLoginDate === today.toDateString();
  const continues = claimedToday || lastLoginDate === yesterday.toDateString();
  // The streak count the next claim will record (tomorrow's, if today's is in).
  const nextStreak = continues ? consecutiveLogins + 1 : 1;
  for (let k = 0; k < rewards.length; k++) {
    const day = (nextStreak - 1 + k) % rewards.length;
    if (rewards[day].packs > 0) {
      return { day: day + 1, packs: rewards[day].packs, inDays: k + (claimedToday ? 1 : 0) };
    }
  }
  return null;
};
