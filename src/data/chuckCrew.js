// Chuck's Crew. The bartender, two of his worse ideas, the regulars who
// never leave, and the tricks he pulls with a bottle. Ids are prefixed so
// a parallel wave cannot take the same one. The ladder still stores
// integers, so each card also carries a ladderId in the open range above
// the goons (101-108) and below the hen-do block (191-200).
// Every one of them is a grown adult. Chuck is the same bear on every card
// that is him.

export const CHUCK_CARDS = [
  {
    id: 'ck-chuck', ladderId: 171, set: 'chuck', tribe: 'house',
    art: '/cards/ck-chuck.webp', artThumb: '/cards/thumbs/ck-chuck.webp',
    name: 'Chuck', attack: 3, defense: 5, type: 'action', cost: 6, ability: 'pour', rarity: 'legendary',
    description: 'Sit down. I will be gentle. That was a lie, and the towel is not clean.',
  },
  {
    id: 'ck-closing', ladderId: 172, set: 'chuck', tribe: 'house',
    art: '/cards/ck-closing.webp', artThumb: '/cards/thumbs/ck-closing.webp',
    name: 'Closing-Time Chuck', attack: 3, defense: 4, type: 'action', cost: 5, ability: 'orders', rarity: 'epic',
    description: 'Last orders. He says it like a threat and pours it like a promise.',
  },
  {
    id: 'ck-offduty', ladderId: 173, set: 'chuck', tribe: 'house',
    art: '/cards/ck-offduty.webp', artThumb: '/cards/thumbs/ck-offduty.webp',
    name: 'Off-Duty Chuck', attack: 3, defense: 3, type: 'action', cost: 4, ability: 'cutoff', rarity: 'rare',
    description: 'Shirt half off, standards gone. He still takes the bottle away.',
  },
  {
    id: 'ck-rita', ladderId: 174, set: 'chuck', tribe: 'house',
    art: '/cards/ck-rita.webp', artThumb: '/cards/thumbs/ck-rita.webp',
    name: 'Regular Rita', attack: 2, defense: 2, type: 'action', cost: 2, ability: 'none', rarity: 'common',
    description: 'She has a stool, a tab, and opinions about your mouth.',
  },
  {
    id: 'ck-tabitha', ladderId: 175, set: 'chuck', tribe: 'house',
    art: '/cards/ck-tabitha.webp', artThumb: '/cards/thumbs/ck-tabitha.webp',
    name: 'Tabitha', attack: 2, defense: 3, type: 'action', cost: 3, ability: 'tab', rarity: 'rare',
    description: 'She puts it on the tab. The tab has your name and a lipstick print.',
  },
  {
    id: 'ck-last-orders', ladderId: 176, set: 'chuck',
    art: '/cards/ck-last-orders.webp', artThumb: '/cards/thumbs/ck-last-orders.webp',
    name: 'Last Orders', attack: 0, defense: 0, type: 'special', cost: 4, effect: 'lastOrders', amount: 6, rarity: 'rare',
    description: 'The lights are up. He pours one more and tells you that you are pretty.',
  },
  {
    id: 'ck-top-up', ladderId: 177, set: 'chuck',
    art: '/cards/ck-top-up.webp', artThumb: '/cards/thumbs/ck-top-up.webp',
    name: 'Top-Up', attack: 0, defense: 0, type: 'special', cost: 3, effect: 'topUp', amount: 2, rarity: 'uncommon',
    description: 'He tops the glass, then the rest of you. He calls it hospitality.',
  },
  {
    id: 'ck-cut-off', ladderId: 178, set: 'chuck',
    art: '/cards/ck-cut-off.webp', artThumb: '/cards/thumbs/ck-cut-off.webp',
    name: "You're Cut Off", attack: 0, defense: 0, type: 'special', cost: 3, effect: 'cutOff', amount: 2, rarity: 'uncommon',
    description: 'He takes the bottle. The look he gives you is not a no.',
  },
  {
    id: 'ck-on-the-tab', ladderId: 179, set: 'chuck',
    art: '/cards/ck-on-the-tab.webp', artThumb: '/cards/thumbs/ck-on-the-tab.webp',
    name: 'On the Tab', attack: 0, defense: 0, type: 'special', cost: 1, effect: 'onTab', amount: 2, rarity: 'common',
    description: 'Two cards now. The bill comes due, and he watches you pay it.',
  },
  {
    id: 'ck-quiet-word', ladderId: 180, set: 'chuck',
    art: '/cards/ck-quiet-word.webp', artThumb: '/cards/thumbs/ck-quiet-word.webp',
    name: 'The Quiet Word', attack: 0, defense: 0, type: 'trap', cost: 3, effect: 'damage', amount: 4, interest: 1, rarity: 'uncommon',
    description: 'He leans in, says one filthy thing, and the night gets smaller.',
  },
];

// Where they sit in the catalog. The seeded field the older sets were
// measured against is sensitive to this order.
const CATALOG_ORDER = [
  'ck-tabitha', 'ck-cut-off', 'ck-chuck', 'ck-offduty', 'ck-on-the-tab',
  'ck-top-up', 'ck-last-orders', 'ck-quiet-word', 'ck-rita', 'ck-closing',
];

export const CHUCK_CATALOG = CATALOG_ORDER.map((id) => CHUCK_CARDS.find((card) => card.id === id));

const BY_LADDER = new Map(CHUCK_CARDS.map((card) => [card.ladderId, card.id]));

/** Integer the ladder can store, or the id unchanged when it already is one. */
export const toLadderId = (id) => CHUCK_CARDS.find((card) => card.id === id)?.ladderId ?? id;

/** Catalog id for a ladder integer, or the value unchanged. */
export const fromLadderId = (id) => BY_LADDER.get(id) ?? id;
