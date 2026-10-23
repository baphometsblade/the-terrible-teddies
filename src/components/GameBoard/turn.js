// The turn's rules that more than one part of the board needs: how much
// energy a turn grants, and whether the player still has anything worth doing
// before ending it. Pure, so the board and its tests read the same answer.
import { canAttack, effectiveCost } from '@/utils/battleUtils';

// Cap the hand so unbounded draw (per-turn + draw specials) can't overflow the
// fixed-width hand layout into an unclickable, off-screen stack.
export const MAX_HAND_SIZE = 10;
// A side holds at most this many cards on the table.
export const MAX_FIELD_SIZE = 3;
// A full momentum gauge unlocks the Rally payoff.
export const MOMENTUM_MAX = 10;
export const MAX_ENERGY = 10;

// The energy a turn starts with: 3 on turn 1, one more every second turn, up
// to 10. The same number is the turn's maximum, which the rail shows as
// "2/4", so both read it from here.
export const energyForTurn = (turn) => Math.min(MAX_ENERGY, 3 + Math.floor(turn / 2));

// Would playing this card now change anything? A heal at full HP, a draw from
// an empty deck and a buff with no creature to pump are legal plays that do
// nothing; a creature or trap needs a free place on the table.
export const cardWouldDoSomething = (card, { field, health, maxHealth, deckSize }) => {
  if (card.type !== 'special') return field.length < MAX_FIELD_SIZE;
  switch (card.effect) {
    case 'heal': return health < maxHealth;
    // The card being played frees its own slot, so the hand always has room.
    case 'draw': return deckSize > 0;
    case 'buff': return field.some((c) => c.type === 'action');
    default: return true;
  }
};

// Whether this card is a move right now: affordable and worth playing.
export const isUsefulPlay = (card, state) =>
  state.energy >= effectiveCost(card, state.field) && cardWouldDoSomething(card, state);

// Can the player Rally? A full gauge and a teddy to pump: Rally buffs and
// restuffs creatures only, so with none on the table it would spend the whole
// gauge on nothing. The board offers the button on exactly this, so it is never
// lit (brass) beside an End Turn that is lit because no move is left.
export const canRally = ({ momentum, field }) =>
  momentum >= MOMENTUM_MAX && field.some((c) => c.type === 'action');

// Does the player have a move left this turn? A ready attacker, a card worth
// playing, or a Rally. When the answer is no, End Turn becomes the board's
// primary action (Hearthstone's "no moves left").
export const hasMoveLeft = (state) =>
  state.field.some(canAttack)
  || state.hand.some((card) => isUsefulPlay(card, state))
  || canRally(state);
