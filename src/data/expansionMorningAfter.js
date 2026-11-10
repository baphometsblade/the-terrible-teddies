// Morning After. Ten cards about the walk home: regrettable texts, a kebab
// queue that will not shut up, and cures that are just the night again.
// Every bear here is a grown adult. Ids stay `ma-` so the other expansions
// shipping at the same time cannot collide with them.
//
// The ladder still files a deck as integers (no new migration). `toGhostId`
// in src/lib/social/ghostDeck.js writes ma-1..ma-10 as 151..160, a gap no
// catalog id uses, and reads those numbers back as these cards.

const MORNING_AFTER_LIST = [
  {
    id: 'ma-1',
    name: 'Heels-in-Hand Holly',
    attack: 2,
    defense: 3,
    type: 'action',
    cost: 2,
    ability: 'stealth',
    epithet: 'Sneak-out',
    rarity: 'common',
    description: 'One heel, an open coat, and the doorman she will not text back.',
  },
  {
    id: 'ma-2',
    name: 'Sent-at-3am Tess',
    attack: 3,
    defense: 3,
    type: 'action',
    cost: 2,
    ability: 'hungover',
    epithet: 'Regrets',
    rarity: 'common',
    description: 'She texted come back. Her head will not let her swing twice.',
  },
  {
    id: 'ma-3',
    name: 'Sauce-Stain Sam',
    attack: 3,
    defense: 3,
    type: 'action',
    cost: 3,
    ability: 'smitten',
    epithet: 'Handsy',
    rarity: 'uncommon',
    description: 'Sauce on the shirt. He hits harder if the booth is still full.',
  },
  {
    id: 'ma-4',
    name: 'Cab-of-Shame Cara',
    attack: 3,
    defense: 2,
    type: 'action',
    cost: 3,
    ability: 'rush',
    epithet: "Meter's on",
    rarity: 'uncommon',
    description: "Still in last night's dress. Bodies now. The face can wait.",
  },
  {
    id: 'ma-5',
    name: 'Kebab Aristotle',
    attack: 3,
    defense: 3,
    type: 'action',
    cost: 4,
    ability: 'royal',
    epithet: 'Lecture',
    rarity: 'rare',
    description: 'The grill\'s philosopher. The queue hits harder while he talks.',
  },
  {
    id: 'ma-6',
    name: 'Blackout Brunch',
    attack: 4,
    defense: 4,
    type: 'action',
    cost: 5,
    ability: 'blackout',
    epithet: 'No memory',
    rarity: 'epic',
    description: "Eggs, someone else's shirt, and a swing she does not aim.",
  },
  {
    id: 'ma-7',
    name: 'Still-Warm Stella',
    attack: 6,
    defense: 5,
    type: 'action',
    cost: 6,
    ability: 'hungover',
    epithet: 'Once more',
    rarity: 'legendary',
    description: 'One last swing from the sheets. Then she is finished until noon.',
  },
  {
    id: 'ma-8',
    name: 'Read Receipt',
    attack: 0,
    defense: 0,
    type: 'trap',
    cost: 2,
    effect: 'damage',
    amount: 3,
    rarity: 'common',
    description: 'They opened it. They did not answer. It still lands.',
  },
  {
    id: 'ma-9',
    name: 'Hair of the Dog',
    attack: 0,
    defense: 0,
    type: 'special',
    cost: 2,
    effect: 'heal',
    amount: 4,
    rarity: 'uncommon',
    description: 'Another pour of the thing that ruined you. Almost decent.',
  },
  {
    id: 'ma-10',
    name: 'The Unsent Thread',
    attack: 0,
    defense: 0,
    type: 'special',
    cost: 4,
    effect: 'draw',
    amount: 4,
    rarity: 'epic',
    description: 'Four drafts of u up. Only the filthy one was honest.',
  },
];

// The file the generator writes, and the URL the card face requests. Until
// that webp is committed, ArtOrEmoji's existing chain (thumb, full plate,
// then the emoji) still draws the card. The age gate holds the photo back
// whenever the document is in SFW mode.
export const morningAfterArtFile = (id) => `public/cards/${id}.webp`;

export const MORNING_AFTER_CARDS = MORNING_AFTER_LIST.map((card) => ({
  ...card,
  art: `/cards/${card.id}.webp`,
}));
