import { keptThroughReset, FRESH_START } from '@/stores/gameStore';
import { getCurrentSeason } from '@/utils/season';

const count = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * What "Reset All Progress" will delete and what it keeps, in the player's
 * own numbers, for Settings' confirmation. The kept half is read from
 * keptThroughReset, the object resetProgress applies, so the two cannot
 * disagree. Each deleted line says what it goes back to, where that is
 * not nothing.
 *
 * @returns {{ deletes: {label: string, after?: string}[], keeps: string[], note: string }}
 */
export function describeReset(state, now = new Date()) {
  const kept = keptThroughReset(state, now);

  const deletes = [
    { label: `Level ${state.level.toLocaleString()}`, after: state.level > 1 ? 'back to Level 1' : undefined },
    {
      label: state.savedDecks.length
        ? `${count(state.ownedCards.length, 'card')} and ${count(state.savedDecks.length, 'saved deck')}`
        : count(state.ownedCards.length, 'card'),
      after: `back to the ${FRESH_START.cards} starters`,
    },
    { label: count(state.coins, 'coin'), after: `back to ${FRESH_START.coins.toLocaleString()}` },
  ];
  if (state.cardPacks > 0) {
    deletes.push({ label: count(state.cardPacks, 'card pack'), after: `back to ${FRESH_START.cardPacks}` });
  }
  if (state.seasonXP > 0) deletes.push({ label: `${state.seasonXP.toLocaleString()} Battle Pass XP` });
  deletes.push({ label: 'Stats, achievements, login streak and challenge progress' });
  // The fresh save brings its defaults for these too (resetProgress spreads
  // the whole initial state), so the list says so rather than leave a player
  // who switched Animations off to find them back on.
  deletes.push({ label: 'Your name, sound, animation and difficulty settings', after: 'back to defaults' });

  const keeps = [
    state.gems >= FRESH_START.gems
      ? count(kept.gems, 'gem')
      : `${count(kept.gems, 'gem')}, the starting amount`,
  ];
  if (kept.hasBattlePassPremium) keeps.push(`Premium Pass for ${getCurrentSeason(now).name}`);
  const packs = [
    kept.premiumPacks > 0 && `${kept.premiumPacks.toLocaleString()} Premium`,
    kept.legendaryPacks > 0 && `${kept.legendaryPacks.toLocaleString()} Legendary`,
  ].filter(Boolean);
  if (packs.length) {
    const total = kept.premiumPacks + kept.legendaryPacks;
    keeps.push(`${packs.join(' and ')} ${total === 1 ? 'pack' : 'packs'}, unopened`);
  }
  if (kept.coinDoublerExpiresAt) {
    const hours = Math.max(1, Math.ceil((kept.coinDoublerExpiresAt - now.getTime()) / 3_600_000));
    keeps.push(`Coin Doubler, ${hours}h left`);
  }
  if (kept.unlockedCosmetics.length) keeps.push(count(kept.unlockedCosmetics.length, 'cosmetic'));

  return {
    deletes,
    keeps,
    note: "Rewards you've already claimed (Battle Pass tiers, and today's and this week's challenges) stay claimed.",
  };
}
