// Hen Do Havoc. Ten grown bears from a bachelorette night: sashes, a veil,
// a chorus, a shot, a private dance, and the bride who makes the table
// behave. Ids are prefixed so a parallel wave cannot take the same one.
// The ladder still stores integers, so each card also carries a ladderId
// in the open range above the goons (101-109) and at or under MAX_CARD_ID.
// The catalog id stays the string. No tribe: none of these need a mate.

export const HEN_DO_CARDS = [
  { id: 'hd-sash', ladderId: 191, art: '/cards/hd-sash.webp', artThumb: '/cards/thumbs/hd-sash.webp', name: 'Sash-Snatch Sue', attack: 1, defense: 1, type: 'action', cost: 1, ability: 'none', rarity: 'common', description: 'The sash says bride. The hands say otherwise, and she keeps both.' },
  { id: 'hd-veil', ladderId: 192, art: '/cards/hd-veil.webp', artThumb: '/cards/thumbs/hd-veil.webp', name: 'Veil of Bad Ideas', attack: 1, defense: 2, type: 'action', cost: 1, ability: 'stealth', rarity: 'common', description: 'You do not see her coming. You see the hotel bill.' },
  { id: 'hd-chorus', ladderId: 193, art: '/cards/hd-chorus.webp', artThumb: '/cards/thumbs/hd-chorus.webp', name: 'Chorus of Yes', attack: 1, defense: 1, type: 'action', cost: 2, ability: 'swarm', rarity: 'common', description: 'One of them is loud. The rest arrive cheaper, and none of them whisper.' },
  { id: 'hd-shot', ladderId: 194, art: '/cards/hd-shot.webp', artThumb: '/cards/thumbs/hd-shot.webp', name: 'Shot-Glass Shannon', attack: 1, defense: 1, type: 'action', cost: 2, ability: 'rush', rarity: 'common', description: 'In, down, and already swinging. The face waits until she finds her feet.' },
  { id: 'hd-lap', ladderId: 195, art: '/cards/hd-lap.webp', artThumb: '/cards/thumbs/hd-lap.webp', name: 'Lap-Line Lola', attack: 2, defense: 4, type: 'action', cost: 3, ability: 'taunt', rarity: 'uncommon', description: 'You asked for a private dance. The whole room is watching, and she is in the way.' },
  { id: 'hd-bree', ladderId: 196, art: '/cards/hd-bree.webp', artThumb: '/cards/thumbs/hd-bree.webp', name: 'Bridesmaid Bree', attack: 4, defense: 2, type: 'action', cost: 3, ability: 'smitten', rarity: 'uncommon', description: 'Useless until someone is watching. Then she puts on a show.' },
  { id: 'hd-honour', ladderId: 197, art: '/cards/hd-honour.webp', artThumb: '/cards/thumbs/hd-honour.webp', name: 'Maid of Honour', attack: 4, defense: 4, type: 'action', cost: 4, ability: 'hungover', rarity: 'rare', description: 'One spectacular swing. The next round she negotiates with the carpet.' },
  { id: 'hd-petra', ladderId: 198, art: '/cards/hd-petra.webp', artThumb: '/cards/thumbs/hd-petra.webp', name: 'Private-Dance Petra', attack: 3, defense: 3, type: 'action', cost: 4, ability: 'blackout', rarity: 'rare', description: 'She picks who gets the dance. You pick up the tab.' },
  { id: 'hd-bride', ladderId: 199, art: '/cards/hd-bride.webp', artThumb: '/cards/thumbs/hd-bride.webp', name: 'The Bride Says So', attack: 4, defense: 3, type: 'action', cost: 5, ability: 'royal', rarity: 'epic', description: 'Her table hits harder. She watches, and the room behaves.' },
  { id: 'hd-luxe', ladderId: 200, art: '/cards/hd-luxe.webp', artThumb: '/cards/thumbs/hd-luxe.webp', name: 'Last-Dance Luxe', attack: 5, defense: 4, type: 'action', cost: 6, ability: 'shield', rarity: 'legendary', description: 'The encore is not optional. The shirt was, and it lost.' },
];

const BY_LADDER = new Map(HEN_DO_CARDS.map((card) => [card.ladderId, card.id]));

/** Integer the ladder can store, or the id unchanged when it already is one. */
export const toLadderId = (id) => HEN_DO_CARDS.find((card) => card.id === id)?.ladderId ?? id;

/** Catalog id for a ladder integer, or the value unchanged. */
export const fromLadderId = (id) => BY_LADDER.get(id) ?? id;
