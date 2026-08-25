import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { useGameStore } from '../stores/gameStore';
import { getDailyChallenges, getWeeklyChallenges, challengeProgress } from '../stores/challenges';
import confetti from 'canvas-confetti';
import { useDialog } from '@/hooks/useDialog';

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

// Hoisted to module scope so it keeps a stable component identity across
// renders. Declared inside Challenges, it got a fresh type every render — and
// the 60s syncPeriods/countdown tick re-renders the panel once a minute, so
// every card visibly re-ran its entrance animation and any focused Claim button
// lost focus each minute. Reads nothing from the closure now; the parent passes
// the derived progress/claimed state and the claim handler.
const ChallengeCard = ({ challenge, progress, isClaimed, onClaim }) => {
  const isComplete = progress >= challenge.target;
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
            ? 'bg-brass-600/15 border-brass-400/50 shadow-lg shadow-brass-400/20'
            : 'bg-white/5 border-white/10'}
      `}
    >
      {isClaimed && (
        <div className="absolute top-2 right-2 text-2xl">✅</div>
      )}

      <div className="flex items-start gap-3">
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center text-2xl
          ${isComplete ? 'bg-brass-400/20' : 'bg-white/10'}
        `}>
          {challenge.icon}
        </div>

        <div className="flex-1">
          <h3 className={`font-bold ${isComplete ? 'text-brass-300' : 'text-white'}`}>
            {challenge.name}
          </h3>
          <p className="text-white/50 text-sm">{challenge.description}</p>

          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-white/70">{progress} / {challenge.target}</span>
              <span className={isComplete ? 'text-brass-300' : 'text-white/50'}>
                {progressPercent.toFixed(0)}%
              </span>
            </div>
            <Progress
              value={progressPercent}
              className="h-2 bg-night-950/50 [&>div]:bg-brass-400"
              aria-label={`${challenge.name} progress: ${progress} of ${challenge.target}`}
            />
          </div>
        </div>

        <div className="text-right">
          <div className={`
            px-3 py-1 rounded-lg text-sm font-semibold mb-2
            ${challenge.reward.type === 'gems' ? 'bg-purple-500/30 text-purple-300' :
              challenge.reward.type === 'coins' ? 'bg-brass-400/20 text-brass-200' :
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
              onClick={onClaim}
              className="bg-brass-400 hover:bg-brass-500 text-night-950 font-bold"
            >
              Claim
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const Challenges = ({ onClose }) => {
  const {
    addCoins, addGems, addXP, addCardPack, claimChallenge, claimedChallenges, syncPeriods,
    // Daily stats (auto-reset each day)
    todayWins, todayBattles, todayDamageDealt, todayCardsPlayed,
    // Weekly stats (auto-reset each Monday)
    weekWins, weekCoinsEarned, weekBestStreak, weekNewCards,
  } = useGameStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('daily');
  const [dailyResetTime, setDailyResetTime] = useState(getTimeUntilReset(false));
  const [weeklyResetTime, setWeeklyResetTime] = useState(getTimeUntilReset(true));
  const dialogRef = useDialog(onClose);

  // The visible set rotates deterministically by calendar date (see
  // src/stores/challenges.js) — same 4 all day/week, different set on the
  // next day/week. Recomputed every render (cheap: a shuffle over ~12 items)
  // so a dialog left open across midnight/Monday picks up the new set
  // without a remount.
  const DAILY_CHALLENGES = getDailyChallenges();
  const WEEKLY_CHALLENGES = getWeeklyChallenges();

  // Roll over daily/weekly stats and the claimed ledger if the calendar has
  // advanced, so the panel never shows stale challenges.
  //
  // This must keep firing, not run once on mount: the visible challenge SET is
  // recomputed every render and rotates at midnight/Monday, but the STATS
  // (todayWins etc.) only roll over when syncPeriods runs. A dialog left open
  // across midnight would otherwise show tomorrow's challenges scored against
  // today's progress — e.g. yesterday's 3 wins auto-completing today's
  // "win 3 games". Re-syncing on the same 60s tick as the reset countdown
  // keeps the set and the stats on the same calendar day (syncPeriods
  // early-returns when the date is unchanged, so the extra calls are free).
  useEffect(() => {
    syncPeriods();
    const timer = setInterval(() => {
      syncPeriods();
      setDailyResetTime(getTimeUntilReset(false));
      setWeeklyResetTime(getTimeUntilReset(true));
    }, 60000);
    return () => clearInterval(timer);
  }, [syncPeriods]);

  // Single source of truth for stat -> progress; MainMenu's claimable badge
  // reads the same helper, so the two can't disagree about what's finished.
  const challengeStats = {
    todayWins, todayBattles, todayDamageDealt, todayCardsPlayed,
    weekWins, weekBestStreak, weekNewCards, weekCoinsEarned,
  };
  const getChallengeProgress = (challenge) => challengeProgress(challenge, challengeStats);

  const claimReward = (challenge) => {
    const progress = getChallengeProgress(challenge);
    if (progress < challenge.target) return;

    // Claim first — claimChallenge is atomic and idempotent in the store, so a
    // double-click (or any re-entry) can't grant the reward twice.
    if (!claimChallenge(challenge.id)) return;

    switch (challenge.reward.type) {
      case 'coins':         addCoins(challenge.reward.amount); break;
      case 'gems':          addGems(challenge.reward.amount); break;
      case 'xp':            addXP(challenge.reward.amount); break;
      case 'legendaryPack': addCardPack(challenge.reward.amount, 'legendary'); break;
      case 'pack':          addCardPack(challenge.reward.amount); break;
    }

    confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
    toast({
      title: "Challenge Complete!",
      description: `Claimed: ${challenge.reward.amount} ${challenge.reward.type}`,
    });
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
    if (!bonus.allDone) return;
    // Claim first — atomic and idempotent, so a double-click can't double-grant.
    if (!claimChallenge(bonus.key)) return;
    addGems(bonus.gems);
    addCoins(bonus.coins);
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#fbbf24', '#a855f7', '#34d399'] });
    toast({ title: "Bonus Claimed!", description: `+${bonus.gems} 💎 and +${bonus.coins} 🪙` });
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Challenges"
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-b from-night-700 via-night-800 to-night-950 rounded-2xl max-w-2xl w-full shadow-2xl border border-plush-700/40 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-900 to-night-700 border-b border-brass-400/30 p-4 flex justify-between items-center">
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
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
        <div
          role="region"
          aria-label={`${activeTab === 'daily' ? 'Daily' : 'Weekly'} challenges`}
          tabIndex={0}
          className="p-4 flex-1 overflow-y-auto space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400"
        >
          <AnimatePresence mode="wait">
            {activeTab === 'daily' && (
              <motion.div key="daily" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {DAILY_CHALLENGES.map((challenge) => (
                  <div key={challenge.id} className="mb-3">
                    <ChallengeCard
                      challenge={challenge}
                      progress={getChallengeProgress(challenge)}
                      isClaimed={(claimedChallenges ?? []).includes(challenge.id)}
                      onClaim={() => claimReward(challenge)}
                    />
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'weekly' && (
              <motion.div key="weekly" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {WEEKLY_CHALLENGES.map((challenge) => (
                  <div key={challenge.id} className="mb-3">
                    <ChallengeCard
                      challenge={challenge}
                      progress={getChallengeProgress(challenge)}
                      isClaimed={(claimedChallenges ?? []).includes(challenge.id)}
                      onClaim={() => claimReward(challenge)}
                    />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bonus Progress */}
        <div className="bg-gradient-to-r from-night-800/70 to-night-700/70 p-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-semibold">Complete All {activeTab === 'daily' ? 'Daily' : 'Weekly'} Challenges</div>
              <div className="text-white/50 text-sm">Bonus reward for completing all challenges</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-purple-400">💎 {BONUS[activeTab].gems}</div>
                <div className="text-brass-300">🪙 {BONUS[activeTab].coins}</div>
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
                      ? 'bg-brass-400 text-night-950 hover:scale-105 cursor-pointer animate-pulse'
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
