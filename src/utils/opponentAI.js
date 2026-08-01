// Pure decision logic for the AI opponent — extracted from GameBoard so the
// behavior is unit-testable and difficulty actually changes how the opponent
// plays (not just its stat mods).
import { damageToCreatureHp, effectiveCost } from './battleUtils';

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
 * Pricing goes through `effectiveCost` (same helper the player's UI uses) so
 * a `swarm` card is budgeted at its discounted cost once the opponent already
 * controls another creature — either one already on the field (`fieldCards`)
 * or one it played earlier in this same loop (`plays`, folded in as we go).
 * `fieldCards` is optional and defaults to empty so existing callers that
 * only pass a `fieldCount` number keep their old (no-discount) behavior.
 *
 * @returns {{ plays: object[], remainingDeck: object[], energyLeft: number }}
 */
export function chooseOpponentPlays(deck, fieldCount, energy, maxField = 3, fieldCards = []) {
  const plays = [];
  const remainingDeck = [];
  let energyLeft = energy;

  for (const card of deck) {
    const cost = effectiveCost(card, [...fieldCards, ...plays]) ?? 0;
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
 * Pick which valid target to attack. The caller handles taunt/protect/stealth
 * filtering — every target passed in is assumed legal.
 *
 * HP-aware (pass the attacking creature): under the creature-HP model, prefer a
 * target this attacker can KILL outright, taking the biggest threat among those
 * — securing a kill beats merely chipping. With nothing killable, chip the
 * biggest threat, tie-broken toward the lowest remaining HP (closest to dead,
 * least wasted overkill).
 *
 * Legacy (no attacker): biggest threat, tie-broken by lowest defense. Retained
 * so callers without attacker context keep their old behavior.
 */
export function chooseAttackTarget(validTargets, attacker = null) {
  if (!validTargets || validTargets.length === 0) return null;

  const atk = (t) => t.attack ?? 0;
  const hp = (t) => t.currentHp ?? t.defense ?? 0;

  if (attacker) {
    const lethal = validTargets.filter((t) => damageToCreatureHp(attacker, t) >= hp(t));
    const pool = lethal.length > 0 ? lethal : validTargets;
    return pool.reduce((best, t) => {
      if (atk(t) !== atk(best)) return atk(t) > atk(best) ? t : best;
      return hp(t) < hp(best) ? t : best;
    });
  }

  return validTargets.reduce((best, t) => {
    if (atk(t) !== atk(best)) return atk(t) > atk(best) ? t : best;
    return (t.defense ?? 0) < (best.defense ?? 0) ? t : best;
  });
}
