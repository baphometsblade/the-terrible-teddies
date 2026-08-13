// Battle Pass 'exclusive' cosmetics — the rendering side of the entitlements
// that unlockCosmetic() records (keyed by the reward's `name` string in
// BattlePass.jsx's BATTLE_PASS_REWARDS). Every exclusive the pass sells must
// map to something here, or the player pays for a reward that renders nothing;
// cosmetics.test.js fails the build if the two sets drift.

// Border cosmetics upgrade the player's card frames. Diamond (tier 15)
// outranks Gold (tier 5) when both are owned.
const BORDER_RANK = ['Diamond Border', 'Gold Border'];
const BORDER_KEY = { 'Diamond Border': 'diamond', 'Gold Border': 'gold' };

// Emote cosmetics unlock battle-table emotes.
export const EMOTES = [
  { name: 'Teddy Emote', icon: '🎭', effect: 'quip' },
  { name: 'Confetti Cannon Emote', icon: '🎉', effect: 'confetti' },
];

/** The highest-ranked owned border key ('diamond' | 'gold'), or null. */
export const bestOwnedBorder = (owned = []) => {
  for (const name of BORDER_RANK) {
    if (owned.includes(name)) return BORDER_KEY[name];
  }
  return null;
};

/** The emote definitions the player has unlocked, in display order. */
export const ownedEmotes = (owned = []) => EMOTES.filter((e) => owned.includes(e.name));

/** Every cosmetic name this module can render — the drift guard's anchor. */
export const RENDERABLE_COSMETICS = [...BORDER_RANK, ...EMOTES.map((e) => e.name)];
