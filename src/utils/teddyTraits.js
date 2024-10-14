const traits = [
  {
    name: "Fluffy",
    description: "Increases defense by 10%",
    effect: (teddy) => ({ ...teddy, defense: Math.floor(teddy.defense * 1.1) })
  },
  {
    name: "Fierce",
    description: "Increases attack by 10%",
    effect: (teddy) => ({ ...teddy, attack: Math.floor(teddy.attack * 1.1) })
  },
  {
    name: "Lucky",
    description: "5% chance to dodge attacks",
    effect: (teddy) => ({ ...teddy, dodgeChance: (teddy.dodgeChance || 0) + 0.05 })
  },
  {
    name: "Resilient",
    description: "Recovers 5% health at the end of each turn",
    effect: (teddy) => ({ ...teddy, healthRecovery: 0.05 })
  },
  {
    name: "Energetic",
    description: "Starts battle with 1 extra energy",
    effect: (teddy) => ({ ...teddy, initialEnergy: (teddy.initialEnergy || 3) + 1 })
  },
  {
    name: "Berserker",
    description: "Gains 5% attack for each 10% health lost",
    effect: (teddy) => ({ ...teddy, berserk: true })
  },
  {
    name: "Vampiric",
    description: "Heals for 10% of damage dealt",
    effect: (teddy) => ({ ...teddy, vampiric: 0.1 })
  },
  {
    name: "Thorny",
    description: "Reflects 10% of received damage back to the attacker",
    effect: (teddy) => ({ ...teddy, thornDamage: 0.1 })
  }
];

export const getRandomTrait = () => traits[Math.floor(Math.random() * traits.length)];

export const applyTrait = (teddy, trait) => trait.effect(teddy);

export const getTraitDescription = (traitName) => {
  const trait = traits.find(t => t.name === traitName);
  return trait ? trait.description : "Unknown trait";
};