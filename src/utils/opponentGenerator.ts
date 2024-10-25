import { TeddyCard } from '../types/types';

export const generateOpponent = (wave: number): TeddyCard => {
  const baseStats = {
    attack: 5 + Math.floor(wave * 1.5),
    defense: 4 + Math.floor(wave * 1.2),
    health: 20 + wave * 5,
    energyCost: Math.min(5, 2 + Math.floor(wave / 3)),
  };

  const specialAbilities = [
    {
      name: 'Rage Mode',
      description: 'Increases attack but decreases defense',
      effect: (state, card) => ({
        ...state,
        opponentField: state.opponentField.map(c =>
          c.id === card.id ? { ...c, attack: c.attack * 1.5, defense: c.defense * 0.7 } : c
        ),
      }),
      energyCost: 2,
      cooldown: 3,
    },
    {
      name: 'Iron Defense',
      description: 'Doubles defense for two turns',
      effect: (state, card) => ({
        ...state,
        opponentField: state.opponentField.map(c =>
          c.id === card.id ? { ...c, defense: c.defense * 2 } : c
        ),
      }),
      energyCost: 2,
      cooldown: 4,
    },
    {
      name: 'Berserker Strike',
      description: 'Deals damage based on missing health',
      effect: (state, card) => {
        const missingHealth = 100 - state.opponentHealth;
        const damage = Math.floor(missingHealth * 0.5);
        return {
          ...state,
          playerHealth: Math.max(0, state.playerHealth - damage),
        };
      },
      energyCost: 3,
      cooldown: 4,
    },
  ];

  const names = [
    'Nightmare Ted',
    'Chaos Bear',
    'Shadow Plush',
    'Doom Cuddles',
    'Vengeance Paw',
  ];

  const titles = [
    'the Merciless',
    'the Destroyer',
    'the Unstoppable',
    'the Corrupted',
    'the Fearsome',
  ];

  const randomName = names[Math.floor(Math.random() * names.length)];
  const randomTitle = titles[Math.floor(Math.random() * titles.length)];
  const randomAbility = specialAbilities[Math.floor(Math.random() * specialAbilities.length)];

  return {
    id: `opponent-${wave}-${Date.now()}`,
    name: `${randomName} ${wave}`,
    title: randomTitle,
    description: `A powerful opponent from wave ${wave}`,
    attack: baseStats.attack,
    defense: baseStats.defense,
    energyCost: baseStats.energyCost,
    specialAbility: randomAbility,
    image_url: '', // You would generate or select an appropriate image URL here
  };
};