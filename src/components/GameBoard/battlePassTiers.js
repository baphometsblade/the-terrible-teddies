// The season XP each Battle Pass tier opens at, tier 1 first.
//
// A copy of the xpRequired column of BATTLE_PASS_REWARDS, on purpose: that
// table lives in BattlePass.jsx, a lazy dialog chunk (about 6.6 kB gzip), and
// the battle board — which only needs to know whether a battle crossed a tier —
// would otherwise download the whole dialog to read one number.
// battlePassTiers.test.js fails if this ever disagrees with the real table, so
// retuning the pass fails the build until this is retuned with it. Retire it
// once the reward table moves out of the component into a data module.
export const BATTLE_PASS_TIER_XP = [
  0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250, 3850, 4500,
  5200, 5950, 6750, 7600, 8500, 9450, 10450, 11500, 12600, 13750, 14950, 16200,
];

// The highest tier this much season XP has reached (the Battle Pass dialog's
// "current tier"): 1 from the start, since tier 1 opens at 0.
export const battlePassTier = (seasonXP) => {
  let tier = 0;
  for (let i = 0; i < BATTLE_PASS_TIER_XP.length; i += 1) {
    if (seasonXP >= BATTLE_PASS_TIER_XP[i]) tier = i + 1;
  }
  return tier;
};
