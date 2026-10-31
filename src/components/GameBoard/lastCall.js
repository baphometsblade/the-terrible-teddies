// Last call: when the house lights come up on a battle.
//
// The first time either side is down to LAST_CALL_HP or fewer, once per game,
// the board lights the room, logs it, puts up a banner and has Chuck say
// something. The number is the store's (the comeback achievement is the same
// threshold, and gameStore.test.js pins the two), so this file only decides
// who is down.
import { LAST_CALL_HP } from '@/stores/gameStore';

// Whether a side is in last-call range: low, but still standing. At 0 the game
// is over and the result panel has the table, so a side that has just died is
// not "down to 0 HP" in any way the lights should answer.
const inRange = (hp) => hp > 0 && hp <= LAST_CALL_HP;

/**
 * Which side the house lights come up for: 'player', 'opponent', or null when
 * neither is in range. When both are, the one with less left (the player, on a
 * tie): it is the closer call.
 */
export function lastCallSide({ playerHealth, opponentHealth }) {
  const player = inRange(playerHealth);
  const opponent = inRange(opponentHealth);
  if (player && (!opponent || playerHealth <= opponentHealth)) return 'player';
  if (opponent) return 'opponent';
  return null;
}

/**
 * Whether last call fires now, and for whom: `{ side, hp }`, or null.
 *
 * It fires once per game, so `firedIn` is the id of the game it last fired in
 * (null if it has not) and `gameId` the game being played: a new game
 * (Play Again bumps the id) is a new night. It waits for the deal
 * (`deckReady`: before it, the health is the last game's or the defaults')
 * and stops at game over.
 */
export function lastCallDue({ gameId, firedIn, deckReady, gameOver, playerHealth, opponentHealth }) {
  if (!deckReady || gameOver || firedIn === gameId) return null;
  const side = lastCallSide({ playerHealth, opponentHealth });
  if (!side) return null;
  return { side, hp: side === 'player' ? playerHealth : opponentHealth };
}

// Chuck "starts sweating" once a game when he is down to this many HP or fewer
// (oppNearDeath), and it is the same moment last call can arrive for him: one
// hit that takes him from above 8 to LAST_CALL_HP or fewer raises both in a
// commit, and a bubble keeps only the later line.
export const NEAR_DEATH_HP = 8;

/**
 * Whether Chuck says an oppNearDeath line now. `quipped` is whether he has
 * already, this game. `lastCallSpoke` is what the last call effect last said
 * in `{ gameId, playerHealth, opponentHealth }`, or null: when it spoke in
 * this very commit (the same game and the same two healths) it is the bigger
 * moment and wins, and he is not counted as having sweated, so the next change
 * to either health still earns him his line.
 */
export function nearDeathDue({ gameId, quipped, gameOver, playerHealth, opponentHealth, lastCallSpoke }) {
  if (gameOver || quipped) return false;
  if (!(opponentHealth > 0 && opponentHealth <= NEAR_DEATH_HP)) return false;
  const spoke = lastCallSpoke;
  if (spoke && spoke.gameId === gameId
    && spoke.opponentHealth === opponentHealth && spoke.playerHealth === playerHealth) return false;
  return true;
}
