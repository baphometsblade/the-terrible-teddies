// Last Orders. Bouncers, bartenders and the bears who are still swinging
// when the lights come up. Every one of them is a grown regular.
//
// Ids are prefixed so a parallel set cannot take the same number. `ladderId`
// is only the integer the ghost-deck column already stores (1–200). It is
// not the card's id. This set reserves ladder ids 150–159. The picture
// itself is public/cards/<id>.webp, same as the other expansions.

const plate = (id) => ({ art: `/cards/${id}.webp`, artThumb: `/cards/thumbs/${id}.webp` });

export const LAST_ORDERS_CARDS = [
  {
    id: 'lo-velvet-rope',
    ladderId: 150,
    ...plate('lo-velvet-rope'),
    name: 'Velvet Rope Vera',
    attack: 1,
    defense: 3,
    type: 'action',
    cost: 2,
    ability: 'taunt',
    rarity: 'common',
    description: 'The rope lifts for a look. Make it a grown one, and make it worth the night.',
  },
  {
    id: 'lo-two-for-one',
    ladderId: 151,
    ...plate('lo-two-for-one'),
    name: 'Two-for-One Tess',
    attack: 2,
    defense: 2,
    type: 'action',
    cost: 2,
    ability: 'swarm',
    rarity: 'common',
    description: 'The second drink is free. So is the second pair of hands.',
  },
  {
    id: 'lo-last-pour',
    ladderId: 152,
    ...plate('lo-last-pour'),
    name: 'Last Pour Lola',
    attack: 1,
    defense: 3,
    type: 'action',
    cost: 3,
    ability: 'rush',
    rarity: 'uncommon',
    description: 'She sends the last pour down the bar. It arrives already in trouble.',
  },
  {
    id: 'lo-on-the-house',
    ladderId: 153,
    ...plate('lo-on-the-house'),
    name: 'On the House Hope',
    attack: 2,
    defense: 3,
    type: 'action',
    cost: 3,
    ability: 'smitten',
    rarity: 'uncommon',
    description: 'Stay for the free round. She hits harder when someone stays with her.',
  },
  {
    id: 'lo-firm-hand',
    ladderId: 154,
    ...plate('lo-firm-hand'),
    name: 'Firm Hand Frankie',
    attack: 2,
    defense: 3,
    type: 'action',
    cost: 3,
    ability: 'shield',
    rarity: 'uncommon',
    description: 'Palms on the chest, bottle on the floor. He calls that hospitality.',
  },
  {
    id: 'lo-sorry-mate',
    ladderId: 155,
    ...plate('lo-sorry-mate'),
    name: 'Sorry Mate Mack',
    attack: 3,
    defense: 3,
    type: 'action',
    cost: 4,
    ability: 'hungover',
    rarity: 'rare',
    description: 'One beautiful throw at the door. Then he needs a lie and a minute.',
  },
  {
    id: 'lo-lights-down',
    ladderId: 156,
    ...plate('lo-lights-down'),
    name: 'Lights-Down Dana',
    attack: 3,
    defense: 3,
    type: 'action',
    cost: 4,
    ability: 'blackout',
    rarity: 'rare',
    description: 'The lights drop. She swings at whoever the dark puts under her paws.',
  },
  {
    id: 'lo-cut-the-line',
    ladderId: 157,
    ...plate('lo-cut-the-line'),
    name: 'Cut-the-Line Cole',
    attack: 4,
    defense: 2,
    type: 'action',
    cost: 4,
    ability: 'piercing',
    rarity: 'rare',
    description: 'Velvet, rubber, a firm hand. The line still comes undone for him.',
  },
  {
    id: 'lo-still-standing',
    ladderId: 158,
    ...plate('lo-still-standing'),
    name: 'Still Standing Sal',
    attack: 3,
    defense: 3,
    type: 'action',
    cost: 5,
    ability: 'fury',
    rarity: 'epic',
    description: 'Every refusal puts a knot in her jaw. By the third, she is smiling.',
  },
  {
    id: 'lo-owners-round',
    ladderId: 159,
    ...plate('lo-owners-round'),
    name: "The Owner's Round",
    attack: 3,
    defense: 4,
    type: 'action',
    cost: 6,
    ability: 'royal',
    rarity: 'legendary',
    description: 'He buys the last round. Anyone he keeps gets a little meaner.',
  },
];

const BY_LADDER = new Map(LAST_ORDERS_CARDS.map((card) => [card.ladderId, card.id]));

/** Integer the ladder can store, or the id unchanged when it already is one. */
export const toLadderId = (id) => LAST_ORDERS_CARDS.find((card) => card.id === id)?.ladderId ?? id;

/** Catalog id for a ladder integer, or the value unchanged. */
export const fromLadderId = (id) => BY_LADDER.get(id) ?? id;

/** Repo path the Fooocus manifest writes. The board serves it as /cards/<id>.webp. */
export const artTargetFor = (id) => (LAST_ORDERS_CARDS.some((card) => card.id === id) ? `public/cards/${id}.webp` : null);
