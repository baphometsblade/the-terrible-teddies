import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { useGameStore } from '../stores/gameStore';
import confetti from 'canvas-confetti';

const DAILY_CHALLENGES = [
  { id: 'd1', name: 'Win 3 Battles', description: 'Achieve victory in 3 battles', target: 3, reward: { type: 'coins', amount: 150 }, icon: '⚔️', stat: 'dailyWins' },
  { id: 'd2', name: 'Play 5 Games', description: 'Complete 5 battles (win or lose)', target: 5, reward: { type: 'xp', amount: 100 }, icon: '🎮', stat: 'dailyGames' },
  { id: 'd3', name: 'Deal 50 Damage', description: 'Deal a total of 50 damage', target: 50, reward: { type: 'coins', amount: 100 }, icon: '💥', stat: 'dailyDamage' },
  { id: 'd4', name: 'Use 10 Cards', description: 'Play 10 cards in battles', target: 10, reward: { type: 'pack', amount: 1 }, icon: '🃏', stat: 'dailyCardsPlayed' },
];

const WEEKLY_CHALLENGES = [
  { id: 'w1', name: 'Win 15 Battles', description: 'Achieve 15 victories this week', target: 15, reward: { type: 'gems', amount: 50 }, icon: '🏆', stat: 'weeklyWins' },
  { id: 'w2', name: 'Win Streak of 5', description: 'Achieve a 5 game win streak', target: 5, reward: { type: 'pack', amount: 3 }, icon: '🔥', stat: 'weeklyBestStreak' },
  { id: 'w3', name: 'Collect 5 New Cards', description: 'Add 5 new cards to your collection', target: 5, reward: { type: 'gems', amount: 30 }, icon: '📚', stat: 'weeklyNewCards' },
  { id: 'w4', name: 'Earn 500 Coins', description: 'Earn 500 coins from battles', target: 500, reward: { type: 'legendaryPack', amount: 1 }, icon: '🪙', stat: 'weeklyCoinsEarned' },
];

const getTimeUntilReset = (isWeekly = false) => {
  const now = new Date();
  const reset = new Date();
  
  if (isWeekly) {
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    reset.setDate(now.getDate() + daysUntilMonday);
    reset.setHours(0, 0, 0, 0);
  } else {
    reset.setDate(now.getDate() + 1);
    reset.setHours(0, 0, 0, 0);
  }
  
  const diff = reset - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return isWeekly 
    ? `${Math.floor(diff / (1000 * 60 * 60 * 24))}d ${hours % 24}h`
    : `${hours}h ${minutes}m`;
};

const Challenges = ({ onClose }) => {
  const {
    bestWinStreak, ownedCards,
    addCoins, addGems, addXP, addCardPack, claimChallenge, claimedChallenges,
    // Daily stats (auto-reset each day)
    todayWins, todayBattles, todayDamageDealt, todayCardsPlayed,
    // Weekly stats (auto-reset each Monday)
    weekWins, weekCoinsEarned,
  } = useGameStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('daily');
  const [dailyResetTime, setDailyResetTime] = useState(getTimeUntilReset(false));
  const [weeklyResetTime, setWeeklyResetTime] = useState(getTimeUntilReset(true));

  useEffect(() => {
    const timer = setInterval(() => {
      setDailyResetTime(getTimeUntilReset(false));
      setWeeklyResetTime(getTimeUntilReset(true));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const getChallengeProgress = (challenge) => {
    switch (challenge.stat) {
      case 'dailyWins':        return Math.min(todayWins, challenge.target);
      case 'dailyGames':       return Math.min(todayBattles, challenge.target);
      case 'dailyDamage':      return Math.min(todayDamageDealt, challenge.target);
      case 'dailyCardsPlayed': return Math.min(todayCardsPlayed, challenge.target);
      case 'weeklyWins':       return Math.min(weekWins, challenge.target);
      case 'weeklyBestStreak': return Math.min(bestWinStreak, challenge.target);
      case 'weeklyNewCards':   return Math.min(ownedCards.length, challenge.target);
      case 'weeklyCoinsEarned':return Math.min(weekCoinsEarned, challenge.target);
      default: return 0;
    }
  };

  const claimReward = (challenge) => {
    if ((claimedChallenges ?? []).includes(challenge.id)) return;

    const progress = getChallengeProgress(challenge);
    if (progress < challenge.target) return;

    switch (challenge.reward.type) {
      case 'coins':       addCoins(challenge.reward.amount); break;
      case 'gems':        addGems(challenge.reward.amount); break;
      case 'xp':          addXP(challenge.reward.amount); break;
      case 'pack':
      case 'legendaryPack': addCardPack(challenge.reward.amount); break;
    }

    claimChallenge(challenge.id);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
    toast({
      title: "Challenge Complete!",
      description: `Claimed: ${challenge.reward.amount} ${challenge.reward.type}`,
    });
  };

  const ChallengeCard = ({ challenge, isWeekly = false }) => {
    const progress = getChallengeProgress(challenge);
    const isComplete = progress >= challenge.target;
    const isClaimed = (claimedChallenges ?? []).includes(challenge.id);
    const progressPercent = Math.min((progress / challenge.target) * 100, 100);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          relative p-4 rounded-xl border transition-all
          ${isClaimed 
            ? 'bg-green-900/20 border-green-500/30' 
            : isComplete 
              ? 'bg-yellow-900/20 border-yellow-500/50 shadow-lg shadow-yellow-500/20' 
              : 'bg-white/5 border-white/10'}
        `}
      >
        {isClaimed && (
          <div className="absolute top-2 right-2 text-2xl">✅</div>
        )}

        <div className="flex items-start gap-3">
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center text-2xl
            ${isComplete ? 'bg-yellow-500/30' : 'bg-white/10'}
          `}>
            {challenge.icon}
          </div>

          <div className="flex-1">
            <h3 className={`font-bold ${isComplete ? 'text-yellow-400' : 'text-white'}`}>
              {challenge.name}
            </h3>
            <p className="text-white/50 text-sm">{challenge.description}</p>

            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white/70">{progress} / {challenge.target}</span>
                <span className={isComplete ? 'text-yellow-400' : 'text-white/50'}>
                  {progressPercent.toFixed(0)}%
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </div>

          <div className="text-right">
            <div className={`
              px-3 py-1 rounded-lg text-sm font-semibold mb-2
              ${challenge.reward.type === 'gems' ? 'bg-purple-500/30 text-purple-300' :
                challenge.reward.type === 'coins' ? 'bg-yellow-500/30 text-yellow-300' :
                challenge.reward.type === 'pack' || challenge.reward.type === 'legendaryPack' ? 'bg-blue-500/30 text-blue-300' :
                'bg-green-500/30 text-green-300'}
            `}>
              {challenge.reward.type === 'gems' && '💎'}
              {challenge.reward.type === 'coins' && '🪙'}
              {challenge.reward.type === 'pack' && '📦'}
              {challenge.reward.type === 'legendaryPack' && '⭐'}
              {challenge.reward.type === 'xp' && '⭐'}
              {' '}{challenge.reward.amount}
            </div>

            {isComplete && !isClaimed && (
              <Button
                size="sm"
                onClick={() => claimReward(challenge)}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
              >
                Claim
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const dailyComplete = DAILY_CHALLENGES.filter(c => getChallengeProgress(c) >= c.target).length;
  const weeklyComplete = WEEKLY_CHALLENGES.filter(c => getChallengeProgress(c) >= c.target).length;

  // Bonus for clearing every challenge in a tab. Uses the same claim ledger as
  // individual challenges (ids 'd'/'w'-prefixed so they reset on rollover too).
  const BONUS = {
    daily:  { key: 'd_all_bonus', gems: 25,  coins: 200,  allDone: dailyComplete === DAILY_CHALLENGES.length },
    weekly: { key: 'w_all_bonus', gems: 100, coins: 1000, allDone: weeklyComplete === WEEKLY_CHALLENGES.length },
  };

  const claimBonus = (tab) => {
    const bonus = BONUS[tab];
    if (!bonus.allDone || (claimedChallenges ?? []).includes(bonus.key)) return;
    addGems(bonus.gems);
    addCoins(bonus.coins);
    claimChallenge(bonus.key);
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#FFD700', '#9333EA', '#22c55e'] });
    toast({ title: "Bonus Claimed!", description: `+${bonus.gems} 💎 and +${bonus.coins} 🪙` });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-b from-indigo-900 via-purple-900 to-black rounded-2xl max-w-2xl w-full shadow-2xl border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-3xl">🎯</span> Challenges
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl" aria-label="Close challenges">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 py-4 text-center font-semibold transition-all relative ${
              activeTab === 'daily' ? 'text-white bg-white/10' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <span className="mr-2">📅</span>Daily
            <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {dailyComplete}/{DAILY_CHALLENGES.length}
            </span>
            {activeTab === 'daily' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />}
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex-1 py-4 text-center font-semibold transition-all relative ${
              activeTab === 'weekly' ? 'text-white bg-white/10' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <span className="mr-2">📆</span>Weekly
            <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {weeklyComplete}/{WEEKLY_CHALLENGES.length}
            </span>
            {activeTab === 'weekly' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />}
          </button>
        </div>

        {/* Reset Timer */}
        <div className="px-4 py-2 bg-black/30 flex justify-between items-center text-sm">
          <span className="text-white/50">
            {activeTab === 'daily' ? 'Daily' : 'Weekly'} Reset In:
          </span>
          <span className="text-orange-400 font-mono font-bold">
            {activeTab === 'daily' ? dailyResetTime : weeklyResetTime}
          </span>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          <AnimatePresence mode="wait">
            {activeTab === 'daily' && (
              <motion.div key="daily" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {DAILY_CHALLENGES.map((challenge, idx) => (
                  <div key={challenge.id} className="mb-3">
                    <ChallengeCard challenge={challenge} />
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'weekly' && (
              <motion.div key="weekly" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {WEEKLY_CHALLENGES.map((challenge, idx) => (
                  <div key={challenge.id} className="mb-3">
                    <ChallengeCard challenge={challenge} isWeekly />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bonus Progress */}
        <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 p-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-semibold">Complete All {activeTab === 'daily' ? 'Daily' : 'Weekly'} Challenges</div>
              <div className="text-white/50 text-sm">Bonus reward for completing all challenges</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-purple-400">💎 {BONUS[activeTab].gems}</div>
                <div className="text-yellow-400">🪙 {BONUS[activeTab].coins}</div>
              </div>
              {(claimedChallenges ?? []).includes(BONUS[activeTab].key) ? (
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-green-600/40 text-white">
                  ✅
                </div>
              ) : (
                <button
                  onClick={() => claimBonus(activeTab)}
                  disabled={!BONUS[activeTab].allDone}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all ${
                    BONUS[activeTab].allDone
                      ? 'bg-yellow-500 text-black hover:scale-105 cursor-pointer animate-pulse'
                      : 'bg-white/10 text-white/30 cursor-not-allowed'
                  }`}
                  aria-label="Claim all-challenges bonus"
                >
                  🎁
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Challenges;
