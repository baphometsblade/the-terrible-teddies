const AIOpponent = {
  generateTeddy: () => {
    // This is a placeholder. In a real game, you'd fetch this from the server or generate it dynamically.
    return {
      name: "Evil McFluffles",
      title: "The Diabolical Cuddle Master",
      attack: 5,
      defense: 5,
      specialMove: "Fluff Explosion"
    };
  },

  chooseAction: (aiTeddy, playerTeddy, energy) => {
    const actions = ['attack', 'defend'];
    if (energy >= 2) actions.push('special');

    // Simple AI logic
    if (aiTeddy.health < playerTeddy.health && actions.includes('special')) {
      return 'special';
    } else if (aiTeddy.defense < playerTeddy.attack) {
      return 'defend';
    } else {
      return 'attack';
    }
  }
};

export default AIOpponent;