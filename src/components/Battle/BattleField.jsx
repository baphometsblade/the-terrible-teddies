import React from 'react';
import TeddyCard from '../TeddyCard';
import { Progress } from "@/components/ui/progress";

const BattleField = ({ playerTeddy, opponentTeddy, battleState }) => {
  const {
    playerHealth,
    opponentHealth,
    playerStuffing,
    opponentStuffing,
    playerDefenseBoost,
    opponentDefenseBoost,
    currentTurn,
    roundCount
  } = battleState;

  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <h2 className="text-xl font-bold mb-2">Your Teddy</h2>
        <TeddyCard teddy={playerTeddy} />
        <p>Health: {playerHealth}/30</p>
        <Progress value={(playerHealth / 30) * 100} className="w-full h-2 mt-1" />
        <p>Stuffing Points: {playerStuffing}/3</p>
        <Progress value={(playerStuffing / 3) * 100} className="w-full h-2 mt-1" />
        <p>Defense Boost: +{playerDefenseBoost}</p>
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2">Opponent's Teddy</h2>
        <TeddyCard teddy={opponentTeddy} />
        <p>Health: {opponentHealth}/30</p>
        <Progress value={(opponentHealth / 30) * 100} className="w-full h-2 mt-1" />
        <p>Stuffing Points: {opponentStuffing}/3</p>
        <Progress value={(opponentStuffing / 3) * 100} className="w-full h-2 mt-1" />
        <p>Defense Boost: +{opponentDefenseBoost}</p>
      </div>
      <div className="col-span-2 text-center mt-4">
        <p className="text-lg font-bold">Round: {roundCount}</p>
        <p className="text-lg">{currentTurn === 'player' ? "Your Turn" : "Opponent's Turn"}</p>
      </div>
    </div>
  );
};

export default BattleField;