import { teddyCards } from '../data/teddyCards';

export const calculateDamage = (attackerAttack, defenderDefense) => {
  const baseDamage = Math.max(0, attackerAttack - defenderDefense);
  const randomFactor = Math.random() * 0.2 + 0.9; // Random factor between 0.9 and 1.1
  return Math.round(baseDamage * randomFactor);
};

export const calculateSpecialMoveDamage = (attackerAttack, defenderDefense, specialMovePower) => {
  const baseDamage = Math.max(0, (attackerAttack * specialMovePower) - defenderDefense);
  const randomFactor = Math.random() * 0.3 + 0.85; // Random factor between 0.85 and 1.15
  return Math.round(baseDamage * randomFactor);
};

export const calculateDefenseBoost = (currentDefense, boostAmount) => {
  return Math.min(currentDefense + boostAmount, currentDefense * 2); // Cap at double the original defense
};

export const isActionSuccessful = (successRate) => {
  return Math.random() < successRate;
};

export const calculateStuffingGain = (baseGain) => {
  const randomFactor = Math.random() * 0.4 + 0.8; // Random factor between 0.8 and 1.2
  return Math.round(baseGain * randomFactor);
};

export const calculateHealAmount = (baseHeal, currentHealth, maxHealth) => {
  const actualHeal = Math.min(baseHeal, maxHealth - currentHealth);
  const randomFactor = Math.random() * 0.2 + 0.9; // Random factor between 0.9 and 1.1
  return Math.round(actualHeal * randomFactor);
};


export const drawCard = (count) => {
  const drawnCards = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * teddyCards.length);
    drawnCards.push(teddyCards[randomIndex]);
  }
  return drawnCards;
};

export const simulateAIAction = (battleState, playerTeddy, opponentTeddy, playerHand, opponentHand, playerAction, playerCardId) => {
export const simulateAIAction = (battleState, playerTeddy, opponentTeddy, playerHand, opponentHand, playerAction, playerCardId) => {
  if (!playerTeddy || !opponentTeddy) {
    throw new Error("Missing teddy information");
  }

  let {
    playerHealth,
    opponentHealth,
    playerStuffing,
    opponentStuffing,
    playerDefenseBoost,
    opponentDefenseBoost,
    roundCount
  } = battleState;
  let battleLog = [];
  let updatedPlayerHand = [...playerHand];
  let updatedOpponentHand = [...opponentHand];

  // Player action
  const playerCard = playerHand.find(card => card.id === playerCardId);
  if (playerCard && playerStuffing >= playerCard.stuffingCost) {
    playerStuffing -= playerCard.stuffingCost;
    if (playerCard.effect === 'damage') {
      const damage = calculateDamage(playerTeddy.attack + playerCard.value, opponentTeddy.defense + opponentDefenseBoost);
      opponentHealth -= damage;
      battleLog.push(`You used ${playerCard.name} for ${damage} damage!`);
    } else if (playerCard.effect === 'defense') {
      playerDefenseBoost += playerCard.value;
      battleLog.push(`You used ${playerCard.name} to increase your defense by ${playerCard.value}!`);
    } else if (playerCard.effect === 'stuffing') {
      playerStuffing += playerCard.value;
      battleLog.push(`You used ${playerCard.name} to gain ${playerCard.value} stuffing!`);
    }
    updatedPlayerHand = updatedPlayerHand.filter(card => card.id !== playerCardId);
  }

  // AI action
  let aiAction = 'attack';
  let aiCardId = null;

  // Simple AI logic
  if (opponentHealth < 10 && opponentHand.some(card => card.effect === 'health')) {
    aiAction = 'heal';
    aiCardId = opponentHand.find(card => card.effect === 'health').id;
  } else if (playerHealth < 15 && opponentHand.some(card => card.effect === 'damage')) {
    aiAction = 'attack';
    aiCardId = opponentHand.find(card => card.effect === 'damage').id;
  } else if (opponentDefenseBoost < 5 && opponentHand.some(card => card.effect === 'defense')) {
    aiAction = 'defend';
    aiCardId = opponentHand.find(card => card.effect === 'defense').id;
  } else {
    // Random action if no specific condition is met
    const randomIndex = Math.floor(Math.random() * opponentHand.length);
    aiCardId = opponentHand[randomIndex].id;
    aiAction = opponentHand[randomIndex].effect === 'damage' ? 'attack' : 
               opponentHand[randomIndex].effect === 'defense' ? 'defend' : 'heal';
  }

  const aiCard = opponentHand.find(card => card.id === aiCardId);
  if (aiCard && opponentStuffing >= aiCard.stuffingCost) {
    opponentStuffing -= aiCard.stuffingCost;
    if (aiAction === 'attack') {
      const damage = calculateDamage(opponentTeddy.attack + aiCard.value, playerTeddy.defense + playerDefenseBoost);
      playerHealth -= damage;
      battleLog.push(`Opponent used ${aiCard.name} for ${damage} damage!`);
    } else if (aiAction === 'defend') {
      opponentDefenseBoost += aiCard.value;
      battleLog.push(`Opponent used ${aiCard.name} to increase their defense by ${aiCard.value}!`);
    } else if (aiAction === 'heal') {
      opponentHealth = Math.min(30, opponentHealth + aiCard.value);
      battleLog.push(`Opponent used ${aiCard.name} to heal for ${aiCard.value}!`);
    }
    updatedOpponentHand = updatedOpponentHand.filter(card => card.id !== aiCardId);
  }

  roundCount++;

  return {
    playerHealth,
    opponentHealth,
    playerStuffing,
    opponentStuffing,
    playerDefenseBoost,
    opponentDefenseBoost,
    currentTurn: 'player',
    roundCount,
    battleLog: battleLog.join('\n'),
    updatedPlayerHand,
    updatedOpponentHand,
  };
};

// ... keep existing code
