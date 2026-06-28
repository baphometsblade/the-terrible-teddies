import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { useGameStore, DAILY_REWARDS } from '../stores/gameStore';
import confetti from 'canvas-confetti';
import { useDialog } from '@/hooks/useDialog';

const DailyRewards = ({ onClose }) => {
  const { checkDailyLogin, consecutiveLogins } = useGameStore();
  const [reward, setReward] = useState(null);
  const [claimed, setClaimed] = useState(false);
  const dialogRef = useDialog(onClose);

  useEffect(() => {
    const dailyReward = checkDailyLogin();
    if (dailyReward) {
      setReward(dailyReward);
      setTimeout(() => {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }, 500);
    } else {
      setClaimed(true);
    }
  }, [checkDailyLogin]);

  const RewardDay = ({ day, isToday, isClaimed, coins, gems, cards, packs }) => (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: day * 0.1 }}
      className={`relative p-3 rounded-xl text-center ${
        isToday
          ? 'bg-gradient-to-br from-yellow-500 to-orange-500 border-4 border-yellow-300 shadow-lg shadow-yellow-500/50'
          : isClaimed
          ? 'bg-green-600/30 border-2 border-green-500'
          : 'bg-white/10 border-2 border-white/20'
      }`}
    >
      <div className={`text-xs font-bold mb-1 ${isToday ? 'text-black' : 'text-white/70'}`}>Day {day}</div>
      <div className="space-y-0.5">
        {coins > 0 && <div className={`text-sm font-bold ${isToday ? 'text-black' : 'text-yellow-400'}`}>🪙 {coins}</div>}
        {gems > 0 && <div className={`text-sm font-bold ${isToday ? 'text-black' : 'text-cyan-400'}`}>💎 {gems}</div>}
        {cards > 0 && <div className={`text-sm font-bold ${isToday ? 'text-black' : 'text-blue-400'}`}>🃏 x{cards}</div>}
        {packs > 0 && <div className={`text-sm font-bold ${isToday ? 'text-black' : 'text-purple-400'}`}>📦 x{packs}</div>}
      </div>
      {isClaimed && !isToday && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
          <span className="text-2xl">✅</span>
        </div>
      )}
    </motion.div>
  );

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Daily Rewards"
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-b from-indigo-900 to-purple-900 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden"
      >
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-6 text-center">
          <h2 className="text-3xl font-bold text-black">🎁 Daily Rewards</h2>
          <p className="text-black/70 mt-1">Login streak: {consecutiveLogins} day{consecutiveLogins !== 1 ? 's' : ''}</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-7 gap-2 mb-6">
            {DAILY_REWARDS.map((dayReward, index) => {
              const day = index + 1;
              const isToday = reward && day === reward.day;
              const isClaimed = claimed || (reward && day < reward.day);
              return (
                <RewardDay
                  key={day}
                  day={day}
                  isToday={isToday}
                  isClaimed={isClaimed}
                  coins={dayReward.coins}
                  gems={dayReward.gems || 0}
                  cards={dayReward.cards}
                  packs={dayReward.packs}
                />
              );
            })}
          </div>

          <AnimatePresence>
            {reward && !claimed && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500 rounded-xl p-6 text-center"
              >
                <h3 className="text-white text-xl font-bold mb-4">🎉 Today&apos;s Reward Claimed!</h3>
                <div className="flex justify-center gap-8">
                  {reward.coins > 0 && (
                    <div className="text-center">
                      <div className="text-4xl mb-1">🪙</div>
                      <div className="text-yellow-400 font-bold text-xl">+{reward.coins}</div>
                    </div>
                  )}
                  {reward.gems > 0 && (
                    <div className="text-center">
                      <div className="text-4xl mb-1">💎</div>
                      <div className="text-cyan-400 font-bold text-xl">+{reward.gems}</div>
                    </div>
                  )}
                  {reward.cards > 0 && (
                    <div className="text-center">
                      <div className="text-4xl mb-1">🃏</div>
                      <div className="text-blue-400 font-bold text-xl">+{reward.cards}</div>
                    </div>
                  )}
                  {reward.packs > 0 && (
                    <div className="text-center">
                      <div className="text-4xl mb-1">📦</div>
                      <div className="text-purple-400 font-bold text-xl">+{reward.packs}</div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {claimed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/5 rounded-xl p-6 text-center">
                <div className="text-4xl mb-2">✅</div>
                <h3 className="text-white text-xl font-bold mb-2">Already Claimed Today!</h3>
                <p className="text-white/50">Come back tomorrow!</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 bg-black/20">
          <Button onClick={onClose} className="w-full bg-purple-600 hover:bg-purple-700">Continue</Button>
        </div>
      </motion.div>
    </div>
  );
};

export default DailyRewards;
