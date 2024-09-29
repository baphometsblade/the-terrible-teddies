const AIOpponent = {
  generateTeddy: () => {
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
