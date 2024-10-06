import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BattleStats = ({ playerStats, opponentStats }) => {
  return (
    <div className="grid grid-cols-2 gap-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle>Your Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Damage Dealt: {playerStats.damageDealt}</p>
          <p>Damage Taken: {playerStats.damageTaken}</p>
          <p>Healing Done: {playerStats.healingDone}</p>
          <p>Stuffing Gained: {playerStats.stuffingGained}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Opponent Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Damage Dealt: {opponentStats.damageDealt}</p>
          <p>Damage Taken: {opponentStats.damageTaken}</p>
          <p>Healing Done: {opponentStats.healingDone}</p>
          <p>Stuffing Gained: {opponentStats.stuffingGained}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BattleStats;