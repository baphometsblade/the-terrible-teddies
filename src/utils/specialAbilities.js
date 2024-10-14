const specialAbilities = {
  'Fluff Explosion': {
    description: 'Unleash a devastating explosion of fluff',
    effect: (attacker, defender, battleState) => {
      const damage = attacker.attack * 2;
      return {
        damage,
        battleState: {
          ...battleState,
          opponentHealth: Math.max(0, battleState.opponentHealth - damage),
          opponentStatusEffect: 'stunned',
        },
        logMessage: `${attacker.name} unleashes Fluff Explosion, dealing ${damage} damage and stunning the opponent!`,
      };
    }
  },
  'Cuddle Therapy': {
    description: 'Heal yourself and apply a positive status effect',
    effect: (attacker, defender, battleState) => {
      const healAmount = attacker.defense * 2;
      return {
        damage: 0,
        battleState: {
          ...battleState,
          playerHealth: Math.min(100, battleState.playerHealth + healAmount),
          playerStatusEffect: 'regenerating',
        },
        logMessage: `${attacker.name} uses Cuddle Therapy, healing for ${healAmount} and gaining regeneration!`,
      };
    }
  },
  'Button Barrage': {
    description: 'Launch a flurry of buttons at the opponent',
    effect: (attacker, defender, battleState) => {
      const damage = attacker.attack * 1.5;
      return {
        damage,
        battleState: {
          ...battleState,
          opponentHealth: Math.max(0, battleState.opponentHealth - damage),
          opponentStatusEffect: 'disoriented',
        },
        logMessage: `${attacker.name} unleashes a Button Barrage, dealing ${damage} damage and disorienting the opponent!`,
      };
    }
  },
  'Stuffing Surge': {
    description: 'Temporarily boost your attack and defense',
    effect: (attacker, defender, battleState) => {
      const boostAmount = 5;
      return {
        damage: 0,
        battleState: {
          ...battleState,
          playerAttackBoost: (battleState.playerAttackBoost || 0) + boostAmount,
          playerDefenseBoost: (battleState.playerDefenseBoost || 0) + boostAmount,
        },
        logMessage: `${attacker.name} uses Stuffing Surge, boosting attack and defense by ${boostAmount}!`,
      };
    }
  },
  'Seam Ripper': {
    description: 'Reduce the opponent\'s defense',
    effect: (attacker, defender, battleState) => {
      const defenseReduction = 3;
      return {
        damage: 0,
        battleState: {
          ...battleState,
          opponentDefenseBoost: Math.max(0, (battleState.opponentDefenseBoost || 0) - defenseReduction),
        },
        logMessage: `${attacker.name} uses Seam Ripper, reducing the opponent's defense by ${defenseReduction}!`,
      };
    }
  }
};

export const getSpecialAbility = (teddyName) => {
  // In a real implementation, this would fetch the ability based on the teddy's name or ID
  // For now, we'll just return a random ability
  const abilityNames = Object.keys(specialAbilities);
  const randomAbility = abilityNames[Math.floor(Math.random() * abilityNames.length)];
  return {
    name: randomAbility,
    ...specialAbilities[randomAbility],
  };
};

export const useSpecialAbility = (attacker, defender, battleState) => {
  const ability = attacker.specialAbility;
  return ability.effect(attacker, defender, battleState);
};
