// The Naughty List. Ten grown bears from an office Christmas party that
// took over the dive bar: a sleazy Santa, a mistletoe ambush, Secret Santa
// gone wrong, eggnog, and an elf who bills by the song. Every one of them
// is an adult. Ids are prefixed xm- so a parallel wave (lo-, hd-, ma-, ck-)
// cannot take the same one. The ladder still stores integers, so each card
// also carries a ladderId in the xm- band (181-190), at or under MAX_CARD_ID.

export const NAUGHTY_LIST_CARDS = [
  // 1/1. Two health in this pool pushed Lap-Dance Lila over the after-hours
  // cap and left Crush Cora on the night-two floor.
  { id: 'xm-desk', ladderId: 181, art: '/cards/xm-desk.webp', artThumb: '/cards/thumbs/xm-desk.webp', name: 'Under-Desk Uma', attack: 1, defense: 1, type: 'action', cost: 1, ability: 'stealth', rarity: 'common', description: 'HR thinks she left at five. The desk, and the garter, disagree.' },
  { id: 'xm-reply', ladderId: 182, art: '/cards/xm-reply.webp', artThumb: '/cards/thumbs/xm-reply.webp', name: 'Reply-All Rita', attack: 2, defense: 2, type: 'action', cost: 2, ability: 'swarm', rarity: 'common', description: 'One of her is a mistake. The rest of the thread shows up cheaper.' },
  { id: 'xm-ozzy', ladderId: 183, art: '/cards/xm-ozzy.webp', artThumb: '/cards/thumbs/xm-ozzy.webp', name: 'Open-Bar Ozzy', attack: 2, defense: 2, type: 'action', cost: 2, ability: 'fury', rarity: 'common', description: 'The open bar was a suggestion. He heard a dare and kept the glass.' },
  { id: 'xm-holly', ladderId: 184, art: '/cards/xm-holly.webp', artThumb: '/cards/thumbs/xm-holly.webp', name: 'HR Holly', attack: 1, defense: 3, type: 'action', cost: 2, ability: 'taunt', rarity: 'common', description: 'You have to talk to her. She has a form and not much else on.' },
  { id: 'xm-nog', ladderId: 185, art: '/cards/xm-nog.webp', artThumb: '/cards/thumbs/xm-nog.webp', name: 'Eggnog Eddie', attack: 2, defense: 3, type: 'action', cost: 3, ability: 'eggnog', rarity: 'uncommon', description: 'A coin in the nog. Naughty sits someone down. Nice, and he hits harder.' },
  { id: 'xm-elf', ladderId: 186, art: '/cards/xm-elf.webp', artThumb: '/cards/thumbs/xm-elf.webp', name: 'Clocked-Out Elf', attack: 3, defense: 2, type: 'action', cost: 3, ability: 'strip', rarity: 'uncommon', description: 'A grown elf, off the clock, billing by the song. The costume comes off.' },
  { id: 'xm-secret', ladderId: 187, art: '/cards/xm-secret.webp', artThumb: '/cards/thumbs/xm-secret.webp', name: 'Secret Santa Stan', attack: 2, defense: 4, type: 'action', cost: 4, ability: 'regift', rarity: 'rare', description: 'The present is an attack stat. Check the tag before you thank him.' },
  { id: 'xm-mistletoe', ladderId: 188, art: '/cards/xm-mistletoe.webp', artThumb: '/cards/thumbs/xm-mistletoe.webp', name: 'Mistletoe Mandy', attack: 2, defense: 4, type: 'action', cost: 4, ability: 'mistletoe', rarity: 'rare', description: 'House rule: she kisses the bear opposite, and the two trade seats.' },
  { id: 'xm-list', ladderId: 189, art: '/cards/xm-list.webp', artThumb: '/cards/thumbs/xm-list.webp', name: 'The Naughty List', attack: 3, defense: 4, type: 'action', cost: 5, ability: 'naughty', rarity: 'epic', description: 'Nice is two extra hits. Naughty is two in the face. She flips for you.' },
  { id: 'xm-santa', ladderId: 190, art: '/cards/xm-santa.webp', artThumb: '/cards/thumbs/xm-santa.webp', name: 'Sleazy Santa', attack: 5, defense: 4, type: 'action', cost: 6, ability: 'sack', rarity: 'legendary', description: 'The sack is a coin toss. Nice patches you up. Naughty puts three on the tab.' },
];

// Brisbane is UTC+10 all year. Opens 1 Dec 2026 00:00. The end is exclusive:
// 7 Jan 2027 00:00, so 6 Jan 23:59:59 is still inside the party.
export const NAUGHTY_LIST_SEASON = Object.freeze({
  id: 'naughty-list',
  name: 'The Naughty List',
  theme: 'christmas-party',
  starts_at: '2026-11-30T14:00:00.000Z',
  ends_at: '2027-01-06T14:00:00.000Z',
  card_ids: Object.freeze(NAUGHTY_LIST_CARDS.map((card) => card.id)),
  pack_weight_boost: 3,
});

// Eight of the ten, for the nightly fight while the party is on the door.
export const NAUGHTY_CREW = Object.freeze({
  id: 'naughty',
  name: 'The Naughty List',
  cards: Object.freeze(['xm-desk', 'xm-reply', 'xm-ozzy', 'xm-holly', 'xm-nog', 'xm-elf', 'xm-mistletoe', 'xm-santa']),
});

const BY_LADDER = new Map(NAUGHTY_LIST_CARDS.map((card) => [card.ladderId, card.id]));

/** Integer the ladder can store, or the id unchanged when it already is one. */
export const toLadderId = (id) => NAUGHTY_LIST_CARDS.find((card) => card.id === id)?.ladderId ?? id;

/** Catalog id for a ladder integer, or the value unchanged. */
export const fromLadderId = (id) => BY_LADDER.get(id) ?? id;
