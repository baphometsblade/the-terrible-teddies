export const evolutionPaths = [
  {
    id: 1,
    base_teddy_id: null,
    evolved_name: "Mystic Moonbear",
    required_level: 10,
    required_battles: 20,
    required_special_moves: 15,
    new_ability: {
      name: "Lunar Blessing",
      description: "Heals all friendly teddies and increases their defense for 2 turns",
      effect: (state, card) => ({
        ...state,
        playerField: state.playerField.map(c => ({
          ...c,
          defense: c.defense * 1.5,
          health: Math.min(c.maxHealth, c.health + 10)
        })),
        playerStatusEffects: [...state.playerStatusEffects, {
          type: 'defense_boost',
          duration: 2,
          magnitude: 1.5
        }]
      }),
      energyCost: 3,
      cooldown: 4
    }
  },
  {
    id: 2,
    base_teddy_id: null,
    evolved_name: "Infernal Teddylord",
    required_level: 15,
    required_battles: 30,
    required_special_moves: 25,
    new_ability: {
      name: "Stuffing Inferno",
      description: "Deals massive damage to all enemy teddies and applies a burning effect",
      effect: (state, card) => ({
        ...state,
        opponentField: state.opponentField.map(c => ({
          ...c,
          health: c.health - 15
        })),
        opponentStatusEffects: [...state.opponentStatusEffects, {
          type: 'burning',
          duration: 3,
          damage: 5
        }]
      }),
      energyCost: 4,
      cooldown: 5
    }
  },
  {
    id: 3,
    base_teddy_id: null,
    evolved_name: "Quantum Plushie",
    required_level: 20,
    required_battles: 40,
    required_special_moves: 35,
    new_ability: {
      name: "Timeline Split",
      description: "Creates a copy of this teddy with temporary invulnerability",
      effect: (state, card) => {
        const teddyCopy = {
          ...card,
          id: `${card.id}_copy`,
          temporary: true,
          invulnerable: true
        };
        return {
          ...state,
          playerField: [...state.playerField, teddyCopy],
          playerStatusEffects: [...state.playerStatusEffects, {
            type: 'copy_duration',
            duration: 2,
            targetId: teddyCopy.id
          }]
        };
      },
      energyCost: 5,
      cooldown: 6
    }
  }
];

export const getEvolutionRequirements = (teddyId) => {
  return evolutionPaths.find(path => path.base_teddy_id === teddyId) || null;
};

export const checkEvolutionEligibility = (teddy, requirements) => {
  if (!requirements) return false;
  
  return (
    teddy.level >= requirements.required_level &&
    teddy.battles_won >= requirements.required_battles &&
    teddy.special_moves_used >= requirements.required_special_moves
  );
};

export const evolveCharacter = (teddy, evolutionPath) => {
  return {
    ...teddy,
    name: evolutionPath.evolved_name,
    attack: Math.floor(teddy.attack * 1.5),
    defense: Math.floor(teddy.defense * 1.3),
    special_ability: evolutionPath.new_ability,
    evolution_level: (teddy.evolution_level || 0) + 1,
    evolved_from: teddy.name
  };
};