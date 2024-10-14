import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Zap, Shield, Swords } from 'lucide-react';
import TeddyCard from '../TeddyCard';

const BattleField = ({ battleState, playerTeddyData, opponentTeddyData }) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <Card>
        <CardHeader>
          <CardTitle>{playerTeddyData.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <TeddyCard teddy={playerTeddyData} />
          <Progress value={(battleState.playerHealth / 100) * 100} className="mt-2" />
          <div className="flex justify-between mt-2">
            <span><Zap className="inline mr-1" /> {battleState.playerEnergy}</span>
            <span><Shield className="inline mr-1" /> {playerTeddyData.defense}</span>
            <span><Swords className="inline mr-1" /> {playerTeddyData.attack}</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{opponentTeddyData.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <TeddyCard teddy={opponentTeddyData} />
          <Progress value={(battleState.opponentHealth / 100) * 100} className="mt-2" />
          <div className="flex justify-between mt-2">
            <span><Zap className="inline mr-1" /> {battleState.opponentEnergy}</span>
            <span><Shield className="inline mr-1" /> {opponentTeddyData.defense}</span>
            <span><Swords className="inline mr-1" /> {opponentTeddyData.attack}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BattleField;