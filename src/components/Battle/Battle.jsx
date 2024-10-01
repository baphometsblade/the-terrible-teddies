import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeddyCard from '../TeddyCard';
import { calculateDamage } from '../../utils/battleUtils';
import { captureEvent } from '../../utils/posthog';

const Battle = ({ playerTeddy, opponentTeddy, onBattleEnd }) => {
  const [playerHealth, setPlayerHealth] = useState(30);
  const [opponentHealth, setOpponentHealth] = useState(30);
  const [currentTurn, setCurrentTurn] = useState('player');
  const { toast } = useToast();

  useEffect(() => {
    console.log('Battle started', { playerTeddy, opponentTeddy });
    captureEvent('Battle_Started', { playerTeddyId: playerTeddy.id, opponentTeddyId: opponentTeddy.id });
  }, []);

  useEffect(() => {
    if (playerHealth <= 0 || opponentHealth <= 0) {
      console.log('Battle ended', { playerHealth, opponentHealth });
      onBattleEnd(playerHealth > opponentHealth ? 'win' : 'lose');
    }
  }, [playerHealth, opponentHealth]);

  const handleAttack = () => {
    console.log('Player attacking');
    if (currentTurn === 'player') {
      const damage = calculateDamage(playerTeddy, opponentTeddy);
      console.log('Damage dealt:', damage);
      setOpponentHealth(prev => Math.max(0, prev - damage));
      setCurrentTurn('opponent');
      toast({
        title: "Player Attack",
        description: `You dealt ${damage} damage!`,
      });
      captureEvent('Player_Attack', { damage });
    }
  };

  const handleDefend = () => {
    console.log('Player defending');
    if (currentTurn === 'player') {
      setPlayerTeddy(prev => {
        console.log('Increased defense', prev.defense + 2);
        return { ...prev, defense: prev.defense + 2 };
      });
      setCurrentTurn('opponent');
      toast({
        title: "Player Defend",
        description: "You increased your defense by 2!",
      });
      captureEvent('Player_Defend');
    }
  };

  const handleSpecialMove = () => {
    console.log('Player using special move');
    if (currentTurn === 'player') {
      // Implement special move logic here
      toast({
        title: "Special Move",
        description: `You used ${playerTeddy.specialMove}!`,
      });
      setCurrentTurn('opponent');
      captureEvent('Player_Special_Move', { specialMove: playerTeddy.specialMove });
    }
  };

  const opponentTurn = () => {
    console.log('Opponent turn');
    // Simple AI: randomly choose between attack and defend
    if (Math.random() > 0.5) {
      const damage = calculateDamage(opponentTeddy, playerTeddy);
      console.log('Opponent damage dealt:', damage);
      setPlayerHealth(prev => Math.max(0, prev - damage));
      toast({
        title: "Opponent Attack",
        description: `Opponent dealt ${damage} damage!`,
      });
      captureEvent('Opponent_Attack', { damage });
    } else {
      setOpponentTeddy(prev => {
        console.log('Opponent increased defense', prev.defense + 2);
        return { ...prev, defense: prev.defense + 2 };
      });
      toast({
        title: "Opponent Defend",
        description: "Opponent increased their defense by 2!",
      });
      captureEvent('Opponent_Defend');
    }
    setCurrentTurn('player');
  };

  useEffect(() => {
    if (currentTurn === 'opponent') {
      setTimeout(opponentTurn, 1000);
    }
  }, [currentTurn]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-between w-full mb-4">
        <TeddyCard teddy={playerTeddy} />
        <TeddyCard teddy={opponentTeddy} />
      </div>
      <div className="flex justify-between w-full mb-4">
        <p>Player Health: {playerHealth}</p>
        <p>Opponent Health: {opponentHealth}</p>
      </div>
      <div className="flex space-x-2">
        <Button onClick={handleAttack} disabled={currentTurn !== 'player'}>Attack</Button>
        <Button onClick={handleDefend} disabled={currentTurn !== 'player'}>Defend</Button>
        <Button onClick={handleSpecialMove} disabled={currentTurn !== 'player'}>Special Move</Button>
      </div>
    </div>
  );
};

export default Battle;