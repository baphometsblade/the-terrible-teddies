// Daily/weekly challenge pool + deterministic date-based rotation.
//
// Deliberately dependency-free (no React, no gameStore import) so this module
// can be imported both by the app bundle (Challenges.jsx) and directly by
// Node in the Playwright e2e suite without dragging in Vite-only globals.
//
// Every `stat` below is one of the store's existing period-reset counters —
// see STAT_TO_STORE_FIELD. No new tracked stat is introduced: the pool only
// varies the target/name/reward/copy per stat so a rotating set can exist
// without the combat engine or gameStore gaining new instrumentation.

// Maps a challenge's `stat` key (as read by Challenges.jsx's
// getChallengeProgress) to the actual gameStore field that drives it. Used by
// challenges.test.js to guard against a typo'd `stat` producing a challenge
// that can never progress.
export const STAT_TO_STORE_FIELD = {
  dailyWins: 'todayWins',
  dailyGames: 'todayBattles',
  dailyDamage: 'todayDamageDealt',
  dailyCardsPlayed: 'todayCardsPlayed',
  weeklyWins: 'weekWins',
  weeklyBestStreak: 'weekBestStreak',
  weeklyNewCards: 'weekNewCards',
  weeklyCoinsEarned: 'weekCoinsEarned',
};

// --- Daily pool (12 candidates, 3 per tracked daily stat) -----------------
export const DAILY_POOL = [
  // dailyWins (todayWins)
  { id: 'd1', name: "Ruin Chuck's Evening", description: 'Win 1 battle', target: 1, reward: { type: 'coins', amount: 60 }, icon: '🥊', stat: 'dailyWins' },
  { id: 'd2', name: 'Win 3 Battles', description: 'Achieve victory in 3 battles', target: 3, reward: { type: 'coins', amount: 150 }, icon: '⚔️', stat: 'dailyWins' },
  { id: 'd3', name: 'Absolute Menace', description: 'Achieve victory in 5 battles', target: 5, reward: { type: 'pack', amount: 1 }, icon: '👑', stat: 'dailyWins' },
  // dailyGames (todayBattles)
  { id: 'd4', name: 'Punch The Clock', description: 'Complete 3 battles (win or lose)', target: 3, reward: { type: 'coins', amount: 80 }, icon: '🕒', stat: 'dailyGames' },
  { id: 'd5', name: 'Play 5 Games', description: 'Complete 5 battles (win or lose)', target: 5, reward: { type: 'xp', amount: 100 }, icon: '🎮', stat: 'dailyGames' },
  { id: 'd6', name: 'Grind It Out', description: 'Complete 8 battles (win or lose)', target: 8, reward: { type: 'pack', amount: 1 }, icon: '🛠️', stat: 'dailyGames' },
  // dailyDamage (todayDamageDealt)
  { id: 'd7', name: 'Draw First Blood', description: 'Deal a total of 25 damage', target: 25, reward: { type: 'coins', amount: 60 }, icon: '🩸', stat: 'dailyDamage' },
  { id: 'd8', name: 'Deal 50 Damage', description: 'Deal a total of 50 damage', target: 50, reward: { type: 'coins', amount: 100 }, icon: '💥', stat: 'dailyDamage' },
  { id: 'd9', name: 'Scorched Earth Policy', description: 'Deal a total of 100 damage', target: 100, reward: { type: 'gems', amount: 20 }, icon: '🔥', stat: 'dailyDamage' },
  // dailyCardsPlayed (todayCardsPlayed)
  { id: 'd10', name: 'Warm Up The Deck', description: 'Play 5 cards in battles', target: 5, reward: { type: 'coins', amount: 50 }, icon: '🂠', stat: 'dailyCardsPlayed' },
  { id: 'd11', name: 'Use 10 Cards', description: 'Play 10 cards in battles', target: 10, reward: { type: 'pack', amount: 1 }, icon: '🃏', stat: 'dailyCardsPlayed' },
  { id: 'd12', name: 'Card Shark Behavior', description: 'Play 20 cards in battles', target: 20, reward: { type: 'gems', amount: 25 }, icon: '🦈', stat: 'dailyCardsPlayed' },
];

// --- Weekly pool (10 candidates across the 4 tracked weekly stats) -------
export const WEEKLY_POOL = [
  // weeklyWins (weekWins)
  { id: 'w1', name: 'Five-Fight Friday (Any Day)', description: 'Achieve 5 victories this week', target: 5, reward: { type: 'coins', amount: 300 }, icon: '🥃', stat: 'weeklyWins' },
  { id: 'w2', name: 'Win 15 Battles', description: 'Achieve 15 victories this week', target: 15, reward: { type: 'gems', amount: 50 }, icon: '🏆', stat: 'weeklyWins' },
  { id: 'w3', name: "Clear The Bar's Tab", description: 'Achieve 25 victories this week', target: 25, reward: { type: 'legendaryPack', amount: 1 }, icon: '🍾', stat: 'weeklyWins' },
  // weeklyBestStreak (weekBestStreak)
  { id: 'w4', name: 'On A Roll', description: 'Achieve a 3 game win streak', target: 3, reward: { type: 'pack', amount: 2 }, icon: '🎲', stat: 'weeklyBestStreak' },
  { id: 'w5', name: 'Win Streak of 5', description: 'Achieve a 5 game win streak', target: 5, reward: { type: 'pack', amount: 3 }, icon: '🔥', stat: 'weeklyBestStreak' },
  // weeklyNewCards (weekNewCards)
  { id: 'w6', name: 'Fresh Meat For The Deck', description: 'Add 3 new cards to your collection', target: 3, reward: { type: 'gems', amount: 20 }, icon: '🆕', stat: 'weeklyNewCards' },
  { id: 'w7', name: 'Collect 5 New Cards', description: 'Add 5 new cards to your collection', target: 5, reward: { type: 'gems', amount: 30 }, icon: '📚', stat: 'weeklyNewCards' },
  // weeklyCoinsEarned (weekCoinsEarned)
  { id: 'w8', name: "Rattle The Tip Jar", description: 'Earn 250 coins from battles', target: 250, reward: { type: 'pack', amount: 1 }, icon: '🫙', stat: 'weeklyCoinsEarned' },
  { id: 'w9', name: 'Earn 500 Coins', description: 'Earn 500 coins from battles', target: 500, reward: { type: 'legendaryPack', amount: 1 }, icon: '🪙', stat: 'weeklyCoinsEarned' },
  { id: 'w10', name: 'Rob The Whole Register', description: 'Earn 1000 coins from battles', target: 1000, reward: { type: 'gems', amount: 75 }, icon: '💰', stat: 'weeklyCoinsEarned' },
];

const DAILY_PICK_COUNT = 4;
const WEEKLY_PICK_COUNT = 4;

// mulberry32 — small, fast, deterministic PRNG. Same integer seed always
// produces the same output sequence, which is exactly what "stable for the
// whole day/week, different across periods" needs (Math.random() would not
// be reproducible run-to-run).
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic Fisher-Yates shuffle of [0..n) seeded by `seed`. Picking the
// first `count` entries of the shuffle gives `count` distinct, non-repeating
// indices — no duplicates within a period by construction.
function seededShuffledIndices(n, seed) {
  const rand = mulberry32(seed);
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Integer count of calendar days for the *local* Y/M/D of `date`, computed
// via Date.UTC so DST transitions never shift the count by an hour and knock
// it off an integer day boundary. This must track the same local-calendar-day
// boundary gameStore.js uses for `dailyStatsDate` (`Date#toDateString()`), so
// the rotation flips at exactly the same midnight the stats reset at.
function localDayIndex(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

// Monday of the ISO-ish week containing `date`, in local time — mirrors
// gameStore.js's getWeekKey() so the weekly rotation flips on the same
// Monday the weekly stats reset on.
function localMonday(date) {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff);
}

/**
 * Pick `count` challenges from `pool`, stable for the given seed and free of
 * duplicates. Throws if the pool is smaller than `count` — a pool that can't
 * fill a period is a config bug, not a runtime condition to paper over.
 */
function pickChallenges(pool, count, seed) {
  if (pool.length < count) {
    throw new Error(`Challenge pool has ${pool.length} entries, need at least ${count}`);
  }
  const order = seededShuffledIndices(pool.length, seed);
  return order.slice(0, count).map((i) => pool[i]);
}

/**
 * Today's 4 daily challenges. Stable across re-renders/reopens for the same
 * calendar day; differs on other days (barring rare shuffle collisions).
 */
export function getDailyChallenges(date = new Date()) {
  return pickChallenges(DAILY_POOL, DAILY_PICK_COUNT, localDayIndex(date));
}

/**
 * This week's 4 weekly challenges. Stable across the whole Mon-Sun week;
 * differs week to week.
 */
export function getWeeklyChallenges(date = new Date()) {
  // Seed off the Monday's day-index (not `date` itself) so every day within
  // the same week resolves to the same seed — offset so it never collides
  // with a daily seed in a way that would matter (separate pools anyway, but
  // keeps the two rotations visibly independent).
  return pickChallenges(WEEKLY_POOL, WEEKLY_PICK_COUNT, localDayIndex(localMonday(date)) + 104729);
}
