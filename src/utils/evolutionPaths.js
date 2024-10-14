const evolutionPaths = {
  'Cuddly Warrior': [
    { level: 1, name: 'Fluffy Novice', attack: 5, defense: 5, special: 'Cuddle Tackle' },
    { level: 2, name: 'Plush Apprentice', attack: 8, defense: 7, special: 'Stuffing Surge' },
    { level: 3, name: 'Velvet Knight', attack: 12, defense: 10, special: 'Fabric Fortress' },
    { level: 4, name: 'Furry Paladin', attack: 18, defense: 15, special: 'Righteous Fluff' },
    { level: 5, name: 'Legendary Cuddle Champion', attack: 25, defense: 22, special: 'Eternal Embrace' },
  ],
  'Mischievous Trickster': [
    { level: 1, name: 'Playful Prankster', attack: 6, defense: 4, special: 'Tickle Trap' },
    { level: 2, name: 'Sneaky Jester', attack: 10, defense: 6, special: 'Confetti Blast' },
    { level: 3, name: 'Cunning Illusionist', attack: 15, defense: 8, special: 'Mirror Mirage' },
    { level: 4, name: 'Master of Mischief', attack: 22, defense: 12, special: 'Chaos Carnival' },
    { level: 5, name: 'Legendary Trickster King', attack: 30, defense: 18, special: 'Reality Warp' },
  ],
  'Elemental Guardian': [
    { level: 1, name: 'Spark of Nature', attack: 4, defense: 6, special: 'Gentle Breeze' },
    { level: 2, name: 'Elemental Apprentice', attack: 7, defense: 9, special: 'Aqua Pulse' },
    { level: 3, name: 'Fury of the Elements', attack: 11, defense: 13, special: 'Flame Vortex' },
    { level: 4, name: 'Elemental Harbinger', attack: 16, defense: 18, special: 'Tectonic Shift' },
    { level: 5, name: 'Legendary Force of Nature', attack: 23, defense: 25, special: 'Primordial Tempest' },
  ],
};

export const getEvolutionPath = (teddyType) => {
  return evolutionPaths[teddyType] || evolutionPaths['Cuddly Warrior'];
};

export const getNextEvolution = (teddyType, currentLevel) => {
  const path = getEvolutionPath(teddyType);
  return path.find(stage => stage.level === currentLevel + 1);
};