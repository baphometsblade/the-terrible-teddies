// Card backs and table cloths the player can buy with coins or with gems
// already in the wallet. Nothing here opens a checkout. The id is save data
// (unlockedCosmetics, plus equippedCardBack / equippedBoard). The label is
// what a player reads; `long` names the kind of thing, so a joke cannot hide
// whether they are buying a back or a cloth.

export const WARDROBE_LABEL_MAX = 16;

export const WARDROBE = Object.freeze([
  {
    id: 'house-back',
    slot: 'back',
    price: 0,
    currency: 'coins',
    label: 'The Usual',
    blurb: 'What everyone wears in. It still counts as dressed.',
    swatch: '#36281e',
  },
  {
    id: 'velvet-rope',
    slot: 'back',
    price: 400,
    currency: 'coins',
    label: 'Velvet Rope',
    blurb: 'They only lift it if they like what they see.',
    swatch: '#9f1239',
  },
  {
    id: 'neon-stall',
    slot: 'back',
    price: 900,
    currency: 'coins',
    label: 'Peep Show',
    blurb: 'Pink light, thin walls, and a very committed audience.',
    swatch: '#be185d',
  },
  {
    id: 'brass-frame',
    slot: 'back',
    price: 20,
    currency: 'gems',
    label: 'Brass Frame',
    blurb: 'A frame. The card inside is the same card.',
    swatch: '#d6b25e',
  },
  {
    id: 'brass-knuckles',
    slot: 'back',
    price: 30,
    currency: 'gems',
    label: 'Firm Hand',
    blurb: 'Costs gems. Leaves a mark. You did ask.',
    swatch: '#b45309',
  },
  {
    id: 'house-board',
    slot: 'board',
    price: 0,
    currency: 'coins',
    label: 'Open Table',
    blurb: 'The green everyone learns on. Nobody stays green.',
    swatch: '#163423',
  },
  {
    id: 'after-hours',
    slot: 'board',
    price: 600,
    currency: 'coins',
    label: 'After Hours',
    blurb: 'Plum felt. The respectable ones went home. You did not.',
    swatch: '#241433',
  },
  {
    id: 'red-room',
    slot: 'board',
    price: 1500,
    currency: 'coins',
    label: 'Red Room',
    blurb: 'The cloth they leave off the tour. Mind the knees.',
    swatch: '#3a1218',
  },
  {
    id: 'cold-open',
    slot: 'board',
    price: 40,
    currency: 'gems',
    label: 'Cold Shower',
    blurb: 'Blue felt, for when the night got ahead of you.',
    swatch: '#102433',
  },
  {
    id: 'dive-bar',
    slot: 'board',
    price: 1100,
    currency: 'coins',
    label: 'Dive Bar',
    blurb: 'Sticky floor, warm beer, and a light that flatters nobody.',
    swatch: '#1c140c',
  },
  {
    id: 'neon-pit',
    slot: 'board',
    price: 1800,
    currency: 'coins',
    label: 'Neon Pit',
    blurb: 'Pink tubing and a stage nobody admits they watched.',
    swatch: '#240818',
  },
  {
    id: 'last-table',
    slot: 'board',
    price: 25,
    currency: 'gems',
    label: 'Last Table',
    blurb: 'A cloth. The rules on it do not change.',
    swatch: '#3f2a4a',
  },
  {
    id: 'casino-felt',
    slot: 'board',
    price: 50,
    currency: 'gems',
    label: 'The Casino',
    blurb: 'Green that costs gems. The house still wins.',
    swatch: '#0e2418',
  },
  {
    id: 'matte',
    slot: 'finish',
    price: 0,
    currency: 'coins',
    label: 'Matte',
    blurb: 'No shine. The honest way to be looked at.',
    swatch: '#524368',
  },
  {
    id: 'wet-look',
    slot: 'finish',
    price: 800,
    currency: 'coins',
    label: 'Wet Look',
    blurb: 'The cards look like someone has been handling them.',
    swatch: '#67e8f9',
  },
  {
    id: 'bare-ring',
    slot: 'avatar',
    price: 0,
    currency: 'coins',
    label: 'Bare Ring',
    blurb: 'Brass, and nothing else on it.',
    swatch: '#fbbf24',
  },
  {
    id: 'lipstick',
    slot: 'avatar',
    price: 500,
    currency: 'coins',
    label: 'Lipstick',
    blurb: 'A ring that looks kissed. It was.',
    swatch: '#fb7185',
  },
  {
    id: 'high-roller',
    slot: 'avatar',
    price: 25,
    currency: 'gems',
    label: 'High Roller',
    blurb: 'The frame they notice from the door.',
    swatch: '#e9d5ff',
  },
  {
    id: 'house-line',
    slot: 'line',
    price: 0,
    currency: 'coins',
    label: 'The Offer',
    blurb: 'Buy you a drink. Then we see.',
    swatch: '#cbb59a',
  },
  {
    id: 'slow-line',
    slot: 'line',
    price: 350,
    currency: 'coins',
    label: 'Say It Slow',
    blurb: 'The line for when he wants you to stay.',
    swatch: '#f9a8d4',
  },
  {
    id: 'closing-line',
    slot: 'line',
    price: 20,
    currency: 'gems',
    label: 'After Close',
    blurb: 'What he says once the chairs are up.',
    swatch: '#fdba74',
  },
]);

export const DEFAULT_CARD_BACK = 'house-back';
export const DEFAULT_BOARD = 'house-board';
export const DEFAULT_FINISH = 'matte';
export const DEFAULT_AVATAR = 'bare-ring';
export const DEFAULT_LINE = 'house-line';

const KIND = {
  back: 'card back',
  board: 'board',
  finish: 'finish',
  avatar: 'frame',
  line: 'line',
};

export const SLOT_FIELD = {
  back: 'equippedCardBack',
  board: 'equippedBoard',
  finish: 'equippedFinish',
  avatar: 'equippedAvatar',
  line: 'equippedLine',
};

const DEFAULT_BY_SLOT = {
  back: DEFAULT_CARD_BACK,
  board: DEFAULT_BOARD,
  finish: DEFAULT_FINISH,
  avatar: DEFAULT_AVATAR,
  line: DEFAULT_LINE,
};

const BY_ID = new Map(WARDROBE.map((item) => [item.id, item]));

export const wardrobeItem = (id) => BY_ID.get(id) ?? null;

export const wardrobeLong = (item) => (
  item ? `${item.label} ${KIND[item.slot]}` : ''
);

/** A known id for that slot, or the free house look. */
export const idForSlot = (slot, id) => (
  wardrobeItem(id)?.slot === slot ? id : DEFAULT_BY_SLOT[slot]
);

export const equipPatch = (item) => ({ [SLOT_FIELD[item.slot]]: item.id });

export const isFreeWardrobe = (item) => !!item && item.price === 0;

/** A free look, or one sitting in unlockedCosmetics. */
export const ownsWardrobe = (owned, item) => (
  !!item && (isFreeWardrobe(item) || (Array.isArray(owned) && owned.includes(item.id)))
);

export const cardBackId = (id) => idForSlot('back', id);
export const boardId = (id) => idForSlot('board', id);
export const finishId = (id) => idForSlot('finish', id);
export const avatarId = (id) => idForSlot('avatar', id);
export const lineId = (id) => idForSlot('line', id);

/**
 * What buying `id` does to a save, with no side effects.
 * `bought` spends the price, records the id, and puts it on.
 * `owned` is already theirs. `short` is a purse that cannot cover it.
 * `unknown` is not a look this module sells.
 */
export const quoteWardrobe = (state, id) => {
  const item = wardrobeItem(id);
  if (!item) return { ok: false, reason: 'unknown' };
  const owned = Array.isArray(state?.unlockedCosmetics) ? state.unlockedCosmetics : [];
  if (ownsWardrobe(owned, item)) {
    return {
      ok: true,
      reason: 'owned',
      patch: equipPatch(item),
    };
  }
  const purse = item.currency === 'gems' ? Number(state?.gems) || 0 : Number(state?.coins) || 0;
  if (purse < item.price) return { ok: false, reason: 'short', item };
  const spent = item.currency === 'gems'
    ? { gems: purse - item.price }
    : { coins: purse - item.price };
  return {
    ok: true,
    reason: 'bought',
    item,
    patch: {
      ...spent,
      unlockedCosmetics: [...owned, item.id],
      ...equipPatch(item),
    },
  };
};
