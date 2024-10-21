import React from 'react';
import { useGameActions } from '../hooks/useGameActions';
import { TeddyCard } from '../types/types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BattleArena: React.FC = () => {
  const {
    playerHand,
    playerField,
    opponentField,
    playerEnergy,
    opponentHealth,
    playCard,
    drawCard,
    attack,
    useSpecialAbility,
    endTurn,
  } = useGameActions();

  const renderCard = (card: TeddyCard, isPlayable: boolean) => (
    <Card key={card.id} className="w-32 h-48 m-2">
      <CardHeader>
        <CardTitle>{card.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Attack: {card.attack}</p>
        <p>Defense: {card.defense}</p>
        <p>Energy: {card.energyCost}</p>
        {isPlayable && (
          <Button onClick={() => playCard(card)} disabled={playerEnergy < card.energyCost}>
            Play
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="battle-arena p-4">
      <h2 className="text-2xl font-bold mb-4">Battle Arena</h2>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">Opponent</h3>
        <p>Health: {opponentHealth}</p>
        <div className="flex flex-wrap">
          {opponentField.map(card => renderCard(card, false))}
        </div>
      </div>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">Your Field</h3>
        <div className="flex flex-wrap">
          {playerField.map(card => renderCard(card, false))}
        </div>
      </div>
      <div className="mb-4">
        <h3 className="text-xl font-semibold">Your Hand</h3>
        <p>Energy: {playerEnergy}</p>
        <div className="flex flex-wrap">
          {playerHand.map(card => renderCard(card, true))}
        </div>
      </div>
      <div className="flex space-x-2">
        <Button onClick={drawCard}>Draw Card</Button>
        <Button onClick={endTurn}>End Turn</Button>
      </div>
    </div>
  );
};

export default BattleArena;