// One aside from Chuck on the menu, picked from where the player actually is.
// Behind the age door: the menu does not mount until the door has passed.

export const CHUCK_TIP_MAX = 72;

const TIPS = Object.freeze({
  first: 'Sit down. I will be gentle. That was a lie.',
  streak: 'Keep winning. It makes you unbearable, and I like that.',
  broke: 'Skint already. The bar has seen this act before.',
  look: 'The wardrobe is open. What you wear is a confession.',
  regular: 'You came back. I told them you would.',
  crew: 'His crew is in your case. He will be unbearable.',
});

export const CHUCK_TIPS = Object.freeze(Object.values(TIPS));

/** The line for this save. First night, a streak, an empty purse, a bare look, or a regular. */
export const chuckTip = (state = {}) => {
  const battles = Number(state.totalBattles) || 0;
  if (!state.tutorialCompleted && battles === 0) return TIPS.first;
  if ((Number(state.currentWinStreak) || 0) >= 3) return TIPS.streak;
  if ((Number(state.coins) || 0) < 80) return TIPS.broke;
  const cosmetics = Array.isArray(state.unlockedCosmetics) ? state.unlockedCosmetics : [];
  const dressed = cosmetics.some((id) => id !== 'house-back' && id !== 'house-board');
  if (!dressed && state.equippedCardBack === 'house-back' && state.equippedBoard === 'house-board') return TIPS.look;
  const cards = Array.isArray(state.ownedCards) ? state.ownedCards : [];
  if (cards.some((id) => String(id).startsWith('ck-'))) return TIPS.crew;
  return TIPS.regular;
};
