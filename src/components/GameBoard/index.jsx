import React from 'react';
import { PlayerArea } from './PlayerArea';
import { OpponentArea } from './OpponentArea';
import { GameInfo } from './GameInfo';
import { LastPlayedCard } from './LastPlayedCard';
import { GameLog } from './GameLog';
import { useGameLogic } from '../../hooks/useGameLogic';

export const GameBoard = ({ gameMode, onExit }) => {
  const {
    playerHP, opponentHP, playerHand, opponentHand, currentTurn,
    momentumGauge, lastPlayedCard, gameLog, playCard, endTurn
  } = useGameLogic(gameMode);

  return (
    <div className="game-board p-4 bg-gradient-to-b from-pink-100 to-purple-200 rounded-lg shadow-xl">
      <OpponentArea hp={opponentHP} hand={opponentHand} />
      <GameInfo currentTurn={currentTurn} momentumGauge={momentumGauge} />
      <div className="flex mb-6">
        <LastPlayedCard card={lastPlayedCard} />
        <GameLog log={gameLog} />
      </div>
      <PlayerArea 
        hp={playerHP} 
        hand={playerHand} 
        onPlayCard={playCard} 
        onEndTurn={endTurn}
        currentTurn={currentTurn}
      />
    </div>
  );
};