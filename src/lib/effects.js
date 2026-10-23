// What a trap or special card does, in plain words, for the screens that
// explain a card (the collection's detail view). The card face only has room
// for "+5 HP" or "3 DMG"; this is the sentence behind it.
//
// Each line states what the battle engine actually does (GameBoard.jsx's
// applySpecialEffect and its direct-attack path), not what the effect's name
// suggests: a heal stops at the player's maximum, a buff lands only on the
// creatures already on the table, and a trap does nothing to an attack on a
// creature — it springs on the next attack aimed at the player directly,
// stops it, and is spent. effects.test.js holds these to the engine.

// The player's health cap (PLAYER_MAX_HEALTH in GameBoard.jsx).
export const PLAYER_MAX_HEALTH = 30;
// A trap with no amount of its own still springs for this much (the engine's
// `trap.amount || 3`).
export const TRAP_DEFAULT_DAMAGE = 3;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * The short value for a card's effect (the detail view's "Effect" stat), or
 * '' for a card with none.
 */
export const effectLabel = (card) => {
  if (!card) return '';
  if (card.type === 'trap') return `${card.amount || TRAP_DEFAULT_DAMAGE} damage`;
  if (card.type !== 'special') return '';
  switch (card.effect) {
    case 'heal': return `Heal ${card.amount}`;
    case 'draw': return `Draw ${card.amount}`;
    case 'buff': return `+${card.amount} attack`;
    default: return '';
  }
};

/**
 * One plain sentence saying what playing this trap or special does, or '' for
 * a creature (its ability, if any, has its own rules text in abilities.js).
 */
export const effectRules = (card) => {
  if (!card) return '';
  if (card.type === 'trap') {
    const damage = card.amount || TRAP_DEFAULT_DAMAGE;
    return `Springs on the next attack aimed straight at you: the attack is stopped and your opponent takes ${damage} damage. Then it's spent.`;
  }
  if (card.type !== 'special') return '';
  switch (card.effect) {
    case 'heal':
      return `Restores ${card.amount} of your health, up to your maximum of ${PLAYER_MAX_HEALTH}.`;
    case 'draw':
      return `Draws ${plural(card.amount, 'card', 'cards')} from your deck.`;
    case 'buff':
      return `Every creature you have on the table gains +${card.amount} attack for the rest of the battle.`;
    default:
      return '';
  }
};
