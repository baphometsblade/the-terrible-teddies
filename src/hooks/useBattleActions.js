import { useCallback } from 'react';
import { calculateDamage, applyPowerUp, checkForCombo, applyComboEffect, applyStatusEffect, rollForCritical } from '../utils/battleUtils';
import { checkAchievements } from '../utils/achievementSystem';
import { useToast } from "@/components/ui/use-toast";
import AIOpponent from '../utils/AIOpponent';

export const useBattleActions = (battleState, updateBattleState, playerTeddyData, opponentTeddyData, updatePlayerTeddyMutation) => {
  const { toast } = useToast();

  const performAction = useCallback((action) => {
    let newBattleState = { ...battleState };
    let damage = 0;
    let logMessage = '';

    const isCritical = rollForCritical(playerTeddyData);

    if (action === 'attack') {
      damage = calculateDamage(playerTeddyData, opponentTeddyData, newBattleState.opponentDefenseBoost, isCritical);
      if (newBattleState.opponentShield) {
        logMessage = `${opponentTeddyData.name}'s shield blocks the attack!`;
        newBattleState.opponentShield = false;
      } else {
        newBattleState.opponentHealth -= damage;
        logMessage = `${playerTeddyData.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`;
      }
    } else if (action === 'special') {
      damage = calculateDamage(playerTeddyData, opponentTeddyData, newBattleState.opponentDefenseBoost) * 1.5;
      if (newBattleState.opponentShield) {
        logMessage = `${opponentTeddyData.name}'s shield blocks the special attack!`;
        newBattleState.opponentShield = false;
      } else {
        newBattleState.opponentHealth -= damage;
        newBattleState.opponentStatusEffect = 'elemental';
        logMessage = `${playerTeddyData.name} uses ${playerTeddyData.special_move} for ${damage} damage and applies elemental effect!`;
      }
    } else if (action === 'defend') {
      const defenseBoost = Math.floor(playerTeddyData.defense * 0.5);
      newBattleState.playerDefenseBoost += defenseBoost;
      logMessage = `${playerTeddyData.name} increases defense by ${defenseBoost}!`;
    } else if (action.startsWith('use_item_')) {
      const itemIndex = parseInt(action.split('_')[2]);
      const item = newBattleState.playerItems[itemIndex];
      newBattleState = item.effect(newBattleState, true);
      newBattleState.playerItems = newBattleState.playerItems.filter((_, index) => index !== itemIndex);
      logMessage = `${playerTeddyData.name} uses ${item.name}. ${item.description}`;
    }

    newBattleState.battleLog = [...newBattleState.battleLog, logMessage];
    newBattleState.moveHistory = [...newBattleState.moveHistory, action];
    newBattleState.powerUpMeter = Math.min(newBattleState.powerUpMeter + 10, 100);

    const combo = checkForCombo(newBattleState.moveHistory);
    if (combo) {
      newBattleState.comboMeter = 0;
      const comboEffect = applyComboEffect(combo, playerTeddyData, opponentTeddyData);
      const comboMessage = `${playerTeddyData.name} activates ${combo.name} combo!`;
      newBattleState.battleLog = [...newBattleState.battleLog, comboMessage];
      if (comboEffect.damage) {
        newBattleState.opponentHealth -= comboEffect.damage;
      }
      if (comboEffect.defenseBoost) {
        newBattleState.playerDefenseBoost += comboEffect.defenseBoost;
      }
      if (comboEffect.statusEffect) {
        newBattleState.opponentStatusEffect = comboEffect.statusEffect;
      }
    } else {
      newBattleState.comboMeter = Math.min(newBattleState.comboMeter + 20, 100);
    }

    const newAchievements = checkAchievements(action, damage, newBattleState.playerHealth, newBattleState.opponentHealth);
    if (newAchievements.length > 0) {
      newBattleState.achievements = [...newBattleState.achievements, ...newAchievements];
      newAchievements.forEach(achievement => {
        toast({
          title: "Achievement Unlocked!",
          description: achievement.name,
        });
      });
    }

    if (newBattleState.playerStatusEffect) {
      const updatedPlayerTeddy = applyStatusEffect(playerTeddyData, newBattleState.playerStatusEffect);
      newBattleState.playerHealth = updatedPlayerTeddy.health;
      newBattleState.battleLog = [...newBattleState.battleLog, `${playerTeddyData.name} is affected by ${newBattleState.playerStatusEffect}!`];
    }
    if (newBattleState.opponentStatusEffect) {
      const updatedOpponentTeddy = applyStatusEffect(opponentTeddyData, newBattleState.opponentStatusEffect);
      newBattleState.opponentHealth = updatedOpponentTeddy.health;
      newBattleState.battleLog = [...newBattleState.battleLog, `${opponentTeddyData.name} is affected by ${newBattleState.opponentStatusEffect}!`];
    }

    if (newBattleState.playerAttackBoost > 0) {
      damage *= (1 + newBattleState.playerAttackBoost);
      newBattleState.playerAttackBoostDuration--;
      if (newBattleState.playerAttackBoostDuration === 0) {
        newBattleState.playerAttackBoost = 0;
      }
    }

    newBattleState.playerExperience += Math.floor(damage / 2);
    
    if (newBattleState.playerExperience >= newBattleState.playerLevel * 100) {
      newBattleState.playerLevel++;
      newBattleState.playerExperience -= (newBattleState.playerLevel - 1) * 100;
      toast({
        title: "Level Up!",
        description: `${playerTeddyData.name} has reached level ${newBattleState.playerLevel}!`,
      });
      
      const updatedTeddy = {
        ...playerTeddyData,
        attack: playerTeddyData.attack + 1,
        defense: playerTeddyData.defense + 1,
      };
      updatePlayerTeddyMutation.mutate(updatedTeddy);
    }

    newBattleState.currentTurn = 'opponent';
    newBattleState.roundCount++;
    updateBattleState(newBattleState);

    setTimeout(() => {
      const aiAction = AIOpponent.chooseAction(opponentTeddyData, playerTeddyData, newBattleState);
      performAIAction(aiAction);
    }, 1500);
  }, [battleState, playerTeddyData, opponentTeddyData, updateBattleState, updatePlayerTeddyMutation, toast]);

  const performAIAction = useCallback((action) => {
    let newBattleState = { ...battleState };
    let damage = 0;
    let logMessage = '';

    const isCritical = rollForCritical(opponentTeddyData);

    if (action === 'attack') {
      damage = calculateDamage(opponentTeddyData, playerTeddyData, newBattleState.playerDefenseBoost, isCritical);
      if (newBattleState.playerShield) {
        logMessage = `${playerTeddyData.name}'s shield blocks the attack!`;
        newBattleState.playerShield = false;
      } else {
        newBattleState.playerHealth -= damage;
        logMessage = `${opponentTeddyData.name} attacks for ${damage} damage!${isCritical ? ' Critical hit!' : ''}`;
      }
    } else if (action === 'special') {
      damage = calculateDamage(opponentTeddyData, playerTeddyData, newBattleState.playerDefenseBoost) * 1.5;
      if (newBattleState.playerShield) {
        logMessage = `${playerTeddyData.name}'s shield blocks the special attack!`;
        newBattleState.playerShield = false;
      } else {
        newBattleState.playerHealth -= damage;
        newBattleState.playerStatusEffect = 'elemental';
        logMessage = `${opponentTeddyData.name} uses ${opponentTeddyData.special_move} for ${damage} damage and applies elemental effect!`;
      }
    } else if (action === 'defend') {
      const defenseBoost = Math.floor(opponentTeddyData.defense * 0.5);
      newBattleState.opponentDefenseBoost += defenseBoost;
      logMessage = `${opponentTeddyData.name} increases defense by ${defenseBoost}!`;
    } else if (action.startsWith('use_item_')) {
      const itemIndex = parseInt(action.split('_')[2]);
      const item = newBattleState.opponentItems[itemIndex];
      newBattleState = item.effect(newBattleState, false);
      newBattleState.opponentItems = newBattleState.opponentItems.filter((_, index) => index !== itemIndex);
      logMessage = `${opponentTeddyData.name} uses ${item.name}. ${item.description}`;
    }

    newBattleState.battleLog = [...newBattleState.battleLog, logMessage];

    if (newBattleState.opponentAttackBoost > 0) {
      damage *= (1 + newBattleState.opponentAttackBoost);
      newBattleState.opponentAttackBoostDuration--;
      if (newBattleState.opponentAttackBoostDuration === 0) {
        newBattleState.opponentAttackBoost = 0;
      }
    }

    newBattleState.currentTurn = 'player';
    updateBattleState(newBattleState);
  }, [battleState, playerTeddyData, opponentTeddyData, updateBattleState]);

  const handlePowerUp = useCallback(() => {
    if (battleState.powerUpMeter === 100) {
      const powerUp = applyPowerUp(playerTeddyData);
      const newBattleState = {
        ...battleState,
        powerUpMeter: 0,
        battleLog: [...battleState.battleLog, `${playerTeddyData.name} activates ${powerUp.name}!`],
      };
      updateBattleState(newBattleState);
    }
  }, [battleState, playerTeddyData, updateBattleState]);

  const handleCombo = useCallback(() => {
    if (battleState.comboMeter === 100) {
      const combo = checkForCombo(battleState.moveHistory);
      if (combo) {
        const comboEffect = applyComboEffect(combo, playerTeddyData, opponentTeddyData);
        const newBattleState = {
          ...battleState,
          comboMeter: 0,
          battleLog: [...battleState.battleLog, `${playerTeddyData.name} unleashes ${combo.name} combo!`],
        };
        if (comboEffect.damage) {
          newBattleState.opponentHealth -= comboEffect.damage;
        }
        if (comboEffect.defenseBoost) {
          newBattleState.playerDefenseBoost += comboEffect.defenseBoost;
        }
        if (comboEffect.statusEffect) {
          newBattleState.opponentStatusEffect = comboEffect.statusEffect;
        }
        updateBattleState(newBattleState);
      }
    }
  }, [battleState, playerTeddyData, opponentTeddyData, updateBattleState]);

  return { performAction, handlePowerUp, handleCombo };
};
