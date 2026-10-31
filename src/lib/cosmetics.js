// Battle Pass 'exclusive' cosmetics — the rendering side of the entitlements
// that unlockCosmetic() records (keyed by the reward's `name` string in
// src/lib/battlePass.js's BATTLE_PASS_REWARDS). They are the player's to keep:
// a season's end resets the pass, never what it unlocked. Every exclusive the pass sells must
// map to something here, or the player pays for a reward that renders nothing;
// cosmetics.test.js fails the build if the two sets drift.

// Border cosmetics upgrade the player's card frames. Diamond (tier 15)
// outranks Gold (tier 5) when both are owned.
const BORDER_RANK = ['Diamond Border', 'Gold Border'];
const BORDER_KEY = { 'Diamond Border': 'diamond', 'Gold Border': 'gold' };

// What each border draws: the metal that replaces the rarity's on the card
// frame (a gradient border, see TeddyCard) and the glow around it. Here rather
// than in TeddyCard so the Battle Pass can show a border's real metal on the
// tier that sells it.
export const COSMETIC_FRAMES = {
  gold: {
    metal: 'linear-gradient(145deg, #fffbeb 0%, #f59e0b 30%, #fef3c7 50%, #b45309 75%, #fde68a 100%)',
    glow: '0 0 12px rgba(251, 191, 36, 0.55)',
  },
  diamond: {
    metal: 'linear-gradient(145deg, #ffffff 0%, #67e8f9 30%, #ecfeff 50%, #0891b2 75%, #a5f3fc 100%)',
    glow: '0 0 12px rgba(103, 232, 249, 0.6)',
  },
};

/** The frame a border cosmetic draws, by its reward name, or null for anything else. */
export const frameFor = (name) => COSMETIC_FRAMES[BORDER_KEY[name]] ?? null;

// Emote cosmetics unlock battle-table emotes.
export const EMOTES = [
  { name: 'Teddy Emote', icon: '🎭', effect: 'quip' },
  { name: 'Confetti Cannon Emote', icon: '🎉', effect: 'confetti' },
];

// What a cosmetic is CALLED where a player reads it: the pass's reward tile, its
// claim toast, the Premium confirm's list and a season's delivery. DISPLAY
// only. The key (the name above, 'Gold Border') is save data (unlockedCosmetics),
// the reward's identity in battlePass.js and the render lookup here, and never
// changes. `long` says what the thing is (a frame or an emote), for a sentence or
// a screen-reader name that must not hide a purchase behind a joke; it is
// literal, never templated from the label.
export const COSMETIC_LABELS = Object.freeze({
  'Gold Border': { label: 'Gold Tooth', long: 'Gold Tooth card frame' },
  'Diamond Border': { label: 'Diamond Pinky Ring', long: 'Diamond Pinky Ring card frame' },
  'Teddy Emote': { label: 'Trash Talk', long: 'Trash Talk emote' },
  'Confetti Cannon Emote': { label: 'Premature Confetti', long: 'Premature Confetti emote' },
});

// The longest a label may be: the reward tile is 80px wide and clamps to two lines.
export const COSMETIC_LABEL_MAX = 21;

/** The display label for a cosmetic key; an unknown key reads as itself. */
export const cosmeticLabel = (key) => COSMETIC_LABELS[key]?.label ?? key;

/** The label with its type ("Gold Tooth card frame"); an unknown key reads as itself. */
export const cosmeticLong = (key) => COSMETIC_LABELS[key]?.long ?? key;

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
