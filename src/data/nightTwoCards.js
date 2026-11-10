// The second night. Hungover sits out the turn after a swing. Smitten hits
// harder with company. Blackout picks its own bear. A shared tribe (regular,
// staff, ex) is worth +1 attack once a mate is on the table.
// Every one of them is a grown regular.

export const NIGHT_TWO_CARDS = [
  { id: 22, name: 'Hungover Hank', attack: 3, defense: 3, type: 'action', cost: 3, ability: 'hungover', tribe: 'regular', rarity: 'uncommon', description: 'He swings once and spends the next round apologising to the floor.' },
  { id: 23, name: 'Morning-After May', attack: 4, defense: 3, type: 'action', cost: 4, ability: 'hungover', tribe: 'ex', rarity: 'rare', description: 'Spectacular for one round. Then she needs the curtains and a lie.' },
  { id: 24, name: 'Smitten Sid', attack: 2, defense: 2, type: 'action', cost: 2, ability: 'smitten', tribe: 'regular', rarity: 'common', description: 'Useless alone. Give him an audience and he shows off.' },
  { id: 25, name: 'Crush Cora', attack: 2, defense: 2, type: 'action', cost: 3, ability: 'smitten', tribe: 'staff', rarity: 'uncommon', description: 'She hits harder when someone is watching. She always finds someone.' },
  { id: 26, name: 'Blackout Bea', attack: 3, defense: 2, type: 'action', cost: 3, ability: 'blackout', tribe: 'staff', rarity: 'rare', description: 'She picks the bear. You pick up the tab. Nobody argues with the gap.' },
  { id: 27, name: 'Lights-Out Lou', attack: 4, defense: 3, type: 'action', cost: 4, ability: 'blackout', tribe: 'ex', rarity: 'epic', description: 'He remembers the swing. Not the target. The target remembers both.' },
];
