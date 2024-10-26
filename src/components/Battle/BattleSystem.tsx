import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Shield, Sword, Zap, Heart } from 'lucide-react';
import { TeddyCard } from '../../types/types';
import { calculateDamage } from '../../utils/battleUtils';

interface BattleSystemProps {
  playerTeddy: TeddyCard;
  opponentTeddy: TeddyCard;
  onBattleEnd: (winner: 'player' | 'opponent') => void;
}

const BattleSystem = ({ playerTeddy, opponentTeddy, onBattleEnd }: BattleSystemProps) => {
  const [playerHealth, setPlayerHealth] = useState(100);
  const [opponentHealth, setOpponentHealth] = useState(100);
  const [playerEnergy, setPlayerEnergy] = useState(3);
  const [opponentEnergy, setOpponentEnergy] = useState(3);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (playerHealth <= 0) {
      onBattleEnd('opponent');
    } else if (opponentHealth <= 0) {
      onBattleEnd('player');
    }
  }, [playerHealth, opponentHealth, onBattleEnd]);

  const addToBattleLog = (message: string) => {
    setBattleLog(prev => [...prev, message]);
  };

  const performAction = async (action: 'attack' | 'defend' | 'special') => {
    if (!isPlayerTurn || isAnimating) return;
    setIsAnimating(true);

    let damage = 0;
    let energyCost = 1;

    switch (action) {
      case 'attack':
        damage = calculateDamage(playerTeddy, opponentTeddy);
        addToBattleLog(`${playerTeddy.name} attacks for ${damage} damage!`);
        setOpponentHealth(prev => Math.max(0, prev - damage));
        break;
      case 'defend':
        addToBattleLog(`${playerTeddy.name} takes a defensive stance!`);
        setPlayerHealth(prev => Math.min(100, prev + 10));
        break;
      case 'special':
        if (playerEnergy < 2) {
          toast({
            title: "Not enough energy!",
            description: "Special moves require 2 energy points.",
            variant: "destructive",
          });
          setIsAnimating(false);
          return;
        }
        energyCost = 2;
        damage = calculateDamage(playerTeddy, opponentTeddy) * 1.5;
        addToBattleLog(`${playerTeddy.name} uses ${playerTeddy.specialMove} for ${damage} damage!`);
        setOpponentHealth(prev => Math.max(0, prev - damage));
        break;
    }

    setPlayerEnergy(prev => Math.max(0, prev - energyCost));
    
    // Delay for animation
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsAnimating(false);
    setIsPlayerTurn(false);

    // Opponent's turn
    setTimeout(() => {
      performOpponentTurn();
    }, 1500);
  };

  const performOpponentTurn = () => {
    const actions = ['attack', 'defend', 'special'];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    let damage = 0;

    switch (randomAction) {
      case 'attack':
        damage = calculateDamage(opponentTeddy, playerTeddy);
        addToBattleLog(`${opponentTeddy.name} attacks for ${damage} damage!`);
        setPlayerHealth(prev => Math.max(0, prev - damage));
        break;
      case 'defend':
        addToBattleLog(`${opponentTeddy.name} takes a defensive stance!`);
        setOpponentHealth(prev => Math.min(100, prev + 10));
        break;
      case 'special':
        if (opponentEnergy >= 2) {
          damage = calculateDamage(opponentTeddy, playerTeddy) * 1.5;
          addToBattleLog(`${opponentTeddy.name} uses ${opponentTeddy.specialMove} for ${damage} damage!`);
          setPlayerHealth(prev => Math.max(0, prev - damage));
          setOpponentEnergy(prev => prev - 2);
        } else {
          damage = calculateDamage(opponentTeddy, playerTeddy);
          addToBattleLog(`${opponentTeddy.name} attacks for ${damage} damage!`);
          setPlayerHealth(prev => Math.max(0, prev - damage));
        }
        break;
    }

    setOpponentEnergy(prev => Math.min(3, prev + 1));
    setPlayerEnergy(prev => Math.min(3, prev + 1));
    setIsPlayerTurn(true);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Player Side */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>{playerTeddy.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Heart className="text-red-500" />
                <Progress value={playerHealth} className="h-2" />
                <span className="text-sm font-medium">{playerHealth}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="text-yellow-500" />
                <div className="flex gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full ${
                        i < playerEnergy ? 'bg-yellow-500' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Opponent Side */}
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>{opponentTeddy.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Heart className="text-red-500" />
                <Progress value={opponentHealth} className="h-2" />
                <span className="text-sm font-medium">{opponentHealth}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="text-yellow-500" />
                <div className="flex gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full ${
                        i < opponentEnergy ? 'bg-yellow-500' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Battle Actions */}
      <div className="mt-8">
        <div className="flex justify-center gap-4">
          <Button
            onClick={() => performAction('attack')}
            disabled={!isPlayerTurn || isAnimating}
            className="flex items-center gap-2"
          >
            <Sword className="w-4 h-4" />
            Attack
          </Button>
          <Button
            onClick={() => performAction('defend')}
            disabled={!isPlayerTurn || isAnimating}
            className="flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Defend
          </Button>
          <Button
            onClick={() => performAction('special')}
            disabled={!isPlayerTurn || isAnimating || playerEnergy < 2}
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Special
          </Button>
        </div>
      </div>

      {/* Battle Log */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Battle Log</CardTitle>
        </CardHeader>
        <CardContent className="h-48 overflow-y-auto">
          <AnimatePresence>
            {battleLog.map((log, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-gray-600 mb-2"
              >
                {log}
              </motion.div>
            ))}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
};

export default BattleSystem;