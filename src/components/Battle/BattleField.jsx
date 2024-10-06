import React from 'react';
import { motion } from 'framer-motion';
import TeddyCard from '../TeddyCard';
import { Progress } from "@/components/ui/progress";

const BattleField = ({
  playerTeddy,
  opponentTeddy,
  playerHealth,
  opponentHealth,
  playerStuffing,
  opponentStuffing,
  playerDefenseBoost,
  opponentDefenseBoost,
  currentTurn,
  roundCount
}) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <h2 className="text-xl font-bold mb-2">Your Teddy</h2>
        <motion.div
          animate={{ scale: currentTurn === 'player' ? 1.05 : 1 }}
          transition={{ duration: 0.3 }}
        >
          <TeddyCard teddy={playerTeddy} />
        </motion.div>
        <p>Health: {playerHealth}/30</p>
        <Progress value={(playerHealth / 30) * 100} className="w-full h-2 mt-1" />
        <p>Stuffing Points: {playerStuffing}/3</p>
        <Progress value={(playerStuffing / 3) * 100} className="w-full h-2 mt-1" />
        <p>Defense Boost: +{playerDefenseBoost}</p>
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2">Opponent's Teddy</h2>
        <motion.div
          animate={{ scale: currentTurn === 'opponent' ? 1.05 : 1 }}
          transition={{ duration: 0.3 }}
        >
          <TeddyCard teddy={opponentTeddy} />
        </motion.div>
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