// The first battle on easy, for someone who has not fought yet. Two beats:
// Warming Up (nobody can swing the turn they sit down), then the first
// creature that actually can. Pure, so the board and the tests share it.
//
// `seen` is the persisted flag. A save from before this existed is treated
// as already seen once it has a battle on it (normalizeSave), so returning
// players are not sat through the lesson.

export const FIRST_FIGHT = {
  warming: {
    title: 'Warming Up',
    body: 'Just sat down. No swinging until their next turn. Yours too.',
  },
  attack: {
    title: 'Your swing',
    body: 'This one can hit. Tap it, then pick a victim.',
  },
};

/**
 * Which beat to show, or null when the lesson is off.
 * A ready attacker (the player's, able to swing right now) advances it.
 */
export const firstFightStep = ({ armed, readyAttacker }) => {
  if (!armed) return null;
  return readyAttacker ? 'attack' : 'warming';
};
