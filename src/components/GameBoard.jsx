import React, { useState, useEffect } from 'react';
import { teddyData } from '../data/teddyData';
import PlayerArea from './PlayerArea';
import BattleArena from './BattleArena';

const GameBoard = () => {
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [playerHP, setPlayerHP] = useState(30);
  const [opponentHP, setOpponentHP] = useState(30);

  useEffect(() => {
    // Initialize hands
    const shuffledTeddies = [...teddyData].sort(() => 0.5 - Math.random());
    setPlayerHand(shuffledTeddies.slice(0, 5));
    setOpponentHand(shuffledTeddies.slice(5, 10));
  }, []);

  const handleCardPlay = (card) => {
    if (currentTurn === 'player') {
      setOpponentHP(prevHP => Math.max(0, prevHP - card.attack));
      setPlayerHand(prevHand => prevHand.filter(c => c.id !== card.id));
      setCurrentTurn('opponent');
      setTimeout(opponentTurn, 1000);
    }
  };

  const opponentTurn = () => {
    const randomCard = opponentHand[Math.floor(Math.random() * opponentHand.length)];
    setPlayerHP(prevHP => Math.max(0, prevHP - randomCard.attack));
    setOpponentHand(prevHand => prevHand.filter(c => c.id !== randomCard.id));
    setCurrentTurn('player');
  };

  return (
    <div className="game-board">
      <PlayerArea 
        hand={opponentHand} 
        hp={opponentHP} 
        isOpponent={true} 
      />
      <BattleArena 
        currentTurn={currentTurn}
      />
      <PlayerArea 
        hand={playerHand} 
        hp={playerHP} 
        isOpponent={false} 
        onCardPlay={handleCardPlay}
      />
    </div>
  );
};

export default GameBoard;