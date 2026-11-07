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
    label: 'House Felt',
    blurb: 'The back every deck shows up in.',
    swatch: '#2f2344',
  },
  {
    id: 'velvet-rope',
    slot: 'back',
    price: 400,
    currency: 'coins',
    label: 'Velvet Rope',
    blurb: 'Burgundy, for the booth they know you in.',
    swatch: '#9f1239',
  },
  {
    id: 'neon-stall',
    slot: 'back',
    price: 900,
    currency: 'coins',
    label: 'Neon Stall',
    blurb: 'Pink tubing. The stall at the back.',
    swatch: '#be185d',
  },
  {
    id: 'brass-knuckles',
    slot: 'back',
    price: 30,
    currency: 'gems',
    label: 'Brass Knuckles',
    blurb: 'A brass stamp. Paid for in gems.',
    swatch: '#b45309',
  },
  {
    id: 'house-board',
    slot: 'board',
    price: 0,
    currency: 'coins',
    label: 'House Cloth',
    blurb: 'The green the house has always used.',
    swatch: '#163423',
  },
  {
    id: 'after-hours',
    slot: 'board',
    price: 600,
    currency: 'coins',
    label: 'After Hours',
    blurb: 'Plum felt, once the respectable crowd leaves.',
    swatch: '#241433',
  },
  {
    id: 'red-room',
    slot: 'board',
    price: 1500,
    currency: 'coins',
    label: 'Red Room',
    blurb: 'Burgundy cloth. The stains are the decor.',
    swatch: '#3a1218',
  },
  {
    id: 'cold-open',
    slot: 'board',
    price: 40,
    currency: 'gems',
    label: 'Cold Open',
    blurb: 'Blue felt under a light that tells the truth.',
    swatch: '#102433',
  },
]);

export const DEFAULT_CARD_BACK = 'house-back';
export const DEFAULT_BOARD = 'house-board';

const BY_ID = new Map(WARDROBE.map((item) => [item.id, item]));

export const wardrobeItem = (id) => BY_ID.get(id) ?? null;

export const wardrobeLong = (item) => (
  item ? `${item.label} ${item.slot === 'back' ? 'card back' : 'board'}` : ''
);

export const isFreeWardrobe = (item) => !!item && item.price === 0;

/** A free look, or one sitting in unlockedCosmetics. */
export const ownsWardrobe = (owned, item) => (
  !!item && (isFreeWardrobe(item) || (Array.isArray(owned) && owned.includes(item.id)))
);

export const cardBackId = (id) => (
  wardrobeItem(id)?.slot === 'back' ? id : DEFAULT_CARD_BACK
);

export const boardId = (id) => (
  wardrobeItem(id)?.slot === 'board' ? id : DEFAULT_BOARD
);

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
      patch: item.slot === 'back' ? { equippedCardBack: item.id } : { equippedBoard: item.id },
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
      ...(item.slot === 'back' ? { equippedCardBack: item.id } : { equippedBoard: item.id }),
    },
  };
};
