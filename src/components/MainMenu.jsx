import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useGameStore } from '../stores/gameStore';
import { pressable } from '@/lib/a11y';

const MainMenu = ({
  onStartGame,
  onDeckBuilder,
  onCollection,
  onTutorial,
  onCardPacks,
  onPlayerStats,
  onSettings,
  onDailyRewards,
  onShop,
  onBattlePass,
  onLeaderboard,
  onChallenges,
}) => {
  const {
    playerName, level, xp, getXPForNextLevel,
    coins, gems, cardPacks,
    totalWins, currentWinStreak, consecutiveLogins, lastLoginDate,
  } = useGameStore();

  const [hoveredOption, setHoveredOption] = useState(null);

  const today = new Date().toDateString();
  const dailyAvailable = lastLoginDate !== today;

  const xpForNext = getXPForNextLevel();
  const xpProgress = (xp / xpForNext) * 100;

  const menuOptions = [
    { id: 'battle', title: 'Battle', description: 'Go make Chuck cry', icon: '⚔️', color: 'from-red-500 to-orange-500', action: onStartGame, badge: currentWinStreak > 0 ? `🔥 ${currentWinStreak}` : null },
    { id: 'challenges', title: 'Challenges', description: 'Prove you have a problem', icon: '🎯', color: 'from-orange-500 to-red-600', action: onChallenges, badge: dailyAvailable ? '!' : null },
    { id: 'battlepass', title: 'Battle Pass', description: 'Grind. Flex. Repeat.', icon: '🏆', color: 'from-yellow-500 to-orange-600', action: onBattlePass, badge: '⭐', highlight: true },
    { id: 'shop', title: 'Shop', description: 'Spend money you don’t have', icon: '🏪', color: 'from-emerald-500 to-green-600', action: onShop, badge: '💎' },
    { id: 'packs', title: 'Card Packs', description: 'Gambling, but cuter', icon: '📦', color: 'from-purple-500 to-pink-500', action: onCardPacks, badge: cardPacks > 0 ? `${cardPacks}` : null, highlight: cardPacks > 0 },
    { id: 'leaderboard', title: 'Rankings', description: 'See who has no life', icon: '🏅', color: 'from-indigo-500 to-purple-600', action: onLeaderboard },
    { id: 'deck', title: 'Deck Builder', description: 'Assemble your goon squad', icon: '🃏', color: 'from-blue-500 to-indigo-500', action: onDeckBuilder },
    { id: 'collection', title: 'Collection', description: 'Your emotional support army', icon: '🧸', color: 'from-amber-500 to-yellow-500', action: onCollection },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 flex flex-col p-4 md:p-6 overflow-y-auto">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-4xl opacity-10"
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
              y: -50,
              rotate: 0
            }}
            animate={{
              y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 50,
              rotate: 360
            }}
            transition={{
              duration: 15 + Math.random() * 10,
              repeat: Infinity,
              delay: Math.random() * 5
            }}
          >
            🧸
          </motion.div>
        ))}
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex flex-wrap justify-between items-center mb-4 gap-3">
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          {...pressable(onPlayerStats, 'View player stats')}
          className="flex items-center gap-3 bg-white/10 rounded-xl p-3 backdrop-blur-sm cursor-pointer hover:bg-white/15 transition-colors"
        >
          <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-2xl border-2 border-white shadow-lg">
            🧸
          </div>
          <div>
            <div className="text-white font-bold">{playerName}</div>
            <div className="flex items-center gap-2">
              <span className="bg-yellow-500 text-black px-2 py-0.5 rounded text-xs font-bold">Lv. {level}</span>
              <div className="w-24"><Progress value={xpProgress} className="h-2" /></div>
            </div>
            <div className="text-white/50 text-xs mt-0.5">
              {totalWins} wins • {consecutiveLogins} day streak
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex items-center gap-2"
        >
          <motion.button
            onClick={onDailyRewards}
            className={`relative p-3 rounded-xl transition-all ${
              dailyAvailable
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 shadow-lg shadow-yellow-500/50'
                : 'bg-white/10'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-2xl">🎁</span>
            {dailyAvailable && (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
              />
            )}
          </motion.button>

          <div className="bg-yellow-500/20 px-3 py-2 rounded-xl flex items-center gap-2">
            <span className="text-lg">🪙</span>
            <span className="text-yellow-400 font-bold">{coins.toLocaleString()}</span>
          </div>

          <div className="bg-purple-500/20 px-3 py-2 rounded-xl flex items-center gap-2">
            <span className="text-lg">💎</span>
            <span className="text-purple-400 font-bold">{gems}</span>
          </div>

          <motion.button
            onClick={onTutorial}
            className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="How to play"
          >
            <span className="text-2xl">❓</span>
          </motion.button>

          <motion.button
            onClick={onSettings}
            className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
            whileHover={{ scale: 1.05, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Settings"
          >
            <span className="text-2xl">⚙️</span>
          </motion.button>
        </motion.div>
      </div>

      {/* Title */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, type: 'spring' }}
        className="text-center mb-6 relative z-10"
      >
        <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 mb-2 drop-shadow-lg">
          Terrible Teddies
        </h1>
        <p className="text-purple-200 text-base md:text-lg">Bad bears. Worse decisions.</p>
        <div className="flex justify-center gap-2 mt-2">
          <span className="text-2xl">🧸</span>
          <span className="text-2xl">⚔️</span>
          <span className="text-2xl">🧸</span>
        </div>
      </motion.div>

      {/* Menu Options */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3 md:gap-4 max-w-7xl w-full">
          {menuOptions.map((option, index) => (
            <motion.div
              key={option.id}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 + index * 0.08, duration: 0.4 }}
              onMouseEnter={() => setHoveredOption(option.id)}
              onMouseLeave={() => setHoveredOption(null)}
            >
              <Card
                className={`
                  w-full h-40 md:h-48 cursor-pointer overflow-hidden
                  bg-gradient-to-b ${option.color}
                  border-4 border-white/30 shadow-xl
                  transition-all duration-300
                  ${hoveredOption === option.id ? 'scale-105 shadow-2xl' : 'scale-100'}
                  ${option.highlight ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-purple-900' : ''}
                `}
                {...pressable(option.action, option.title)}
              >
                <div className="h-full flex flex-col items-center justify-center p-3 text-white relative">
                  {option.badge && (
                    <div className="absolute top-2 right-2 bg-black/40 px-2 py-1 rounded-full text-xs font-bold">
                      {option.badge}
                    </div>
                  )}

                  <motion.div
                    className="text-4xl md:text-5xl mb-2"
                    animate={hoveredOption === option.id ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    {option.icon}
                  </motion.div>
                  <h2 className="text-base md:text-lg font-bold text-center">{option.title}</h2>
                  <p className="text-xs text-white/80 text-center hidden md:block">{option.description}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-center text-purple-300/50 text-xs relative z-10 mt-4"
      >
        <p>Version 1.0 • No teddies were harmed (lie)</p>
      </motion.div>
    </div>
  );
};

export default MainMenu;
