// Pure decision logic for the AI opponent — extracted from GameBoard so the
// behavior is unit-testable and difficulty actually changes how the opponent
// plays (not just its stat mods).

// Per-turn energy budget by difficulty: the behavioral half of the difficulty
// setting. Hard can afford its most expensive cards; easy is limited to cheap
// plays (its costlier cards simply skip until never — a weaker board by
// design, without ever stalling).
export const OPPONENT_ENERGY_BY_DIFFICULTY = { easy: 2, normal: 3, hard: 4 };

/**
 * Decide which cards the opponent plays this turn.
 *
 * Scans the deck in order and plays every card it can afford within the
 * energy budget while the field has room, leaving the rest in their original
 * order. Skipping unaffordable cards (instead of stopping at the first) is
 * what prevents a permanent stall: a top card costing more than the per-turn
 * budget would otherwise block the opponent for the rest of the game.
 *
 * @returns {{ plays: object[], remainingDeck: object[], energyLeft: number }}
 */
export function chooseOpponentPlays(deck, fieldCount, energy, maxField = 3) {
  const plays = [];
  const remainingDeck = [];
  let energyLeft = energy;

  for (const card of deck) {
    const cost = card.cost ?? 0;
    if (fieldCount + plays.length < maxField && cost <= energyLeft) {
      plays.push(card);
      energyLeft -= cost;
    } else {
      remainingDeck.push(card);
    }
  }

  return { plays, remainingDeck, energyLeft };
}

/**
 * Pick which valid target to attack: the biggest threat first (highest
 * attack), tie-broken by the cheapest kill (lowest defense). The caller is
 * responsible for taunt/protect/stealth filtering — every target passed in
 * is assumed legal.
 */
export function chooseAttackTarget(validTargets) {
  if (!validTargets || validTargets.length === 0) return null;
  return validTargets.reduce((best, t) => {
    if ((t.attack ?? 0) !== (best.attack ?? 0)) {
      return (t.attack ?? 0) > (best.attack ?? 0) ? t : best;
    }
    return (t.defense ?? 0) < (best.defense ?? 0) ? t : best;
  });
}
