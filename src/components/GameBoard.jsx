import React, { useState } from 'react';
import { PlayerArea } from './PlayerArea';
import { OpponentArea } from './OpponentArea';
import { CardDisplay } from './CardDisplay';
import { Button } from "@/components/ui/button";

export const GameBoard = ({ onExitGame }) => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [playerHand, setPlayerHand] = useState([]);
  const [currentTurn, setCurrentTurn] = useState('player');

  const drawCard = () => {
    // Implement card drawing logic here
    const newCard = { id: Date.now(), name: 'New Card', attack: 5, defense: 5 };
    setPlayerHand([...playerHand, newCard]);
  };

  const endTurn = () => {
    setCurrentTurn(currentTurn === 'player' ? 'opponent' : 'player');
    // Implement turn-end logic here
  };

  return (
    <div className="game-board">
      <OpponentArea health={opponentHealth} />
      <div className="flex justify-between items-center my-4">
        <Button onClick={drawCard} disabled={currentTurn !== 'player'}>Draw Card</Button>
        <div className="text-white text-xl">{currentTurn === 'player' ? 'Your Turn' : 'Opponent\'s Turn'}</div>
        <Button onClick={endTurn} disabled={currentTurn !== 'player'}>End Turn</Button>
      </div>
      <CardDisplay cards={playerHand} />
      <PlayerArea health={playerHealth} />
      <Button onClick={onExitGame} className="mt-8">Exit Game</Button>
    </div>
  );
};
