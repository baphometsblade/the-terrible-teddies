const battleEffects = [
  {
    name: "Stuffing Storm",
    description: "A flurry of stuffing fills the air, reducing all attacks by 1 for this turn.",
    effect: (attacker, defender) => {
      attacker.attack = Math.max(1, attacker.attack - 1);
      defender.attack = Math.max(1, defender.attack - 1);
    }
  },
  {
    name: "Thread Tangle",
    description: "Loose threads entangle the teddies, reducing their defense by 1 for this turn.",
    effect: (attacker, defender) => {
      attacker.defense = Math.max(1, attacker.defense - 1);
      defender.defense = Math.max(1, defender.defense - 1);
    }
  },
  {
    name: "Button Boost",
    description: "A shower of buttons rains down, increasing all attacks by 1 for this turn.",
    effect: (attacker, defender) => {
      attacker.attack += 1;
      defender.attack += 1;
    }
  },
  {
    name: "Fabric Fortification",
    description: "A magical fabric reinforces the teddies, increasing their defense by 1 for this turn.",
    effect: (attacker, defender) => {
      attacker.defense += 1;
      defender.defense += 1;
    }
  },
  {
    name: "Seam Surge",
    description: "The teddies' seams glow with power, doubling the effect of their special moves for this turn.",
    effect: (attacker, defender) => {
      attacker.specialMultiplier = 2;
      defender.specialMultiplier = 2;
    }
  },
  {
    name: "Fluff Frenzy",
    description: "A whirlwind of fluff surrounds the battlefield, swapping the attack and defense values of both teddies.",
    effect: (attacker, defender) => {
      [attacker.attack, attacker.defense] = [attacker.defense, attacker.attack];
      [defender.attack, defender.defense] = [defender.defense, defender.attack];
    }
  },
  {
    name: "Cuddle Confusion",
    description: "A wave of cuddliness washes over the teddies, causing them to forget their moves. Randomly reassign attack and defense values.",
    effect: (attacker, defender) => {
      const reassignStats = (teddy) => {
        const totalStats = teddy.attack + teddy.defense;
        teddy.attack = Math.floor(Math.random() * totalStats);
        teddy.defense = totalStats - teddy.attack;
      };
      reassignStats(attacker);
      reassignStats(defender);
    }
  }
];

export const generateRandomBattleEffect = () => {
  return battleEffects[Math.floor(Math.random() * battleEffects.length)];
};

export const applyBattleEffect = (effect, attacker, defender) => {
  effect.effect(attacker, defender);
};

export const describeBattleEffect = (effect) => {
  return `${effect.name}: ${effect.description}`;
};