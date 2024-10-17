export const specialAbilities = {
  'Fluff Explosion': (attacker, defender) => {
    const damage = attacker.attack * 1.5;
    return { damage, effect: 'Opponent is stunned for 1 turn' };
  },
  'Cuddle Therapy': (attacker) => {
    const healing = attacker.defense * 2;
    return { healing, effect: 'Gain 1 energy' };
  },
  'Button Barrage': (attacker, defender) => {
    const damage = attacker.attack;
    return { damage, effect: 'Opponent loses 1 energy' };
  },
};

export const useSpecialAbility = (ability, attacker, defender) => {
  return specialAbilities[ability](attacker, defender);
};