const AIOpponent = {
  makeMove: (aiTeddies, playerTeddies) => {
    const attacker = aiTeddies[Math.floor(Math.random() * aiTeddies.length)];
    const defender = playerTeddies[Math.floor(Math.random() * playerTeddies.length)];
    return { attacker, defender };
  }
};

export default AIOpponent;