import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { useGameStore } from '../stores/gameStore';

const MOCK_LEADERBOARD = [
  { rank: 1, name: "TeddyMaster99", level: 47, wins: 342, streak: 15, trophies: 2850 },
  { rank: 2, name: "FluffyDestroyer", level: 45, wins: 315, streak: 8, trophies: 2720 },
  { rank: 3, name: "BearKing2024", level: 42, wins: 298, streak: 12, trophies: 2590 },
  { rank: 4, name: "CuddleChampion", level: 40, wins: 276, streak: 6, trophies: 2480 },
  { rank: 5, name: "StuffingSlayer", level: 38, wins: 254, streak: 4, trophies: 2350 },
  { rank: 6, name: "ButtonBasher", level: 36, wins: 231, streak: 9, trophies: 2220 },
  { rank: 7, name: "FurryFighter", level: 35, wins: 218, streak: 3, trophies: 2100 },
  { rank: 8, name: "HugHero", level: 33, wins: 195, streak: 7, trophies: 1980 },
  { rank: 9, name: "PlushPunisher", level: 31, wins: 178, streak: 2, trophies: 1850 },
  { rank: 10, name: "TeddyTitan", level: 30, wins: 165, streak: 5, trophies: 1720 },
];

const RANK_REWARDS = [
  { rank: 1, gems: 500, coins: 5000, packs: 10, title: "Teddy Champion" },
  { rank: 2, gems: 300, coins: 3000, packs: 7, title: "Teddy Legend" },
  { rank: 3, gems: 200, coins: 2000, packs: 5, title: "Teddy Master" },
  { rank: "4-10", gems: 100, coins: 1000, packs: 3, title: "Teddy Elite" },
  { rank: "11-50", gems: 50, coins: 500, packs: 2, title: "Teddy Warrior" },
  { rank: "51-100", gems: 25, coins: 250, packs: 1, title: "Teddy Fighter" },
];

const Leaderboard = ({ onClose }) => {
  const { playerName, level, totalWins, currentWinStreak, bestWinStreak } = useGameStore();
  const [activeTab, setActiveTab] = useState('global');
  const [timeframe, setTimeframe] = useState('season');

  const playerTrophies = Math.floor(totalWins * 8 + level * 10 + bestWinStreak * 5);
  const playerRank = MOCK_LEADERBOARD.filter(p => p.trophies > playerTrophies).length + 1;

  const getRankDisplay = (rank) => {
    if (rank === 1) return { icon: '🥇', color: 'text-yellow-400', bg: 'from-yellow-600/30 to-amber-600/30' };
    if (rank === 2) return { icon: '🥈', color: 'text-gray-300', bg: 'from-gray-500/30 to-gray-600/30' };
    if (rank === 3) return { icon: '🥉', color: 'text-orange-400', bg: 'from-orange-600/30 to-amber-700/30' };
    return { icon: rank.toString(), color: 'text-white/70', bg: 'from-white/5 to-white/10' };
  };

  const LeaderboardRow = ({ player, isPlayer = false }) => {
    const rankDisplay = getRankDisplay(player.rank);
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: player.rank * 0.05 }}
        className={`
          flex items-center gap-3 p-3 rounded-xl mb-2 transition-all
          bg-gradient-to-r ${rankDisplay.bg}
          ${isPlayer ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-500/20' : 'hover:bg-white/5'}
          ${player.rank <= 3 ? 'border border-white/20' : ''}
        `}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
          player.rank <= 3 ? 'text-2xl' : 'bg-white/10 ' + rankDisplay.color
        }`}>
          {player.rank <= 3 ? rankDisplay.icon : `#${player.rank}`}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-bold ${isPlayer ? 'text-yellow-400' : 'text-white'}`}>
              {player.name}
            </span>
            {isPlayer && <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded">YOU</span>}
            {player.streak >= 5 && <span className="text-xs">🔥{player.streak}</span>}
          </div>
          <div className="text-white/50 text-xs">
            Level {player.level} • {player.wins} wins
          </div>
        </div>

        <div className="text-right">
          <div className={`font-bold ${rankDisplay.color}`}>
            🏆 {player.trophies.toLocaleString()}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-b from-indigo-900 via-purple-900 to-black rounded-2xl max-w-2xl w-full shadow-2xl border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-3xl">🏆</span> Leaderboard
          </h2>
          <div className="flex items-center gap-3">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-white/20 text-white border-0 rounded-lg px-3 py-1 text-sm"
            >
              <option value="season">This Season</option>
              <option value="weekly">This Week</option>
              <option value="daily">Today</option>
              <option value="alltime">All Time</option>
            </select>
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl">×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { id: 'global', label: 'Global', icon: '🌍' },
            { id: 'friends', label: 'Friends', icon: '👥' },
            { id: 'rewards', label: 'Rewards', icon: '🎁' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-center font-semibold transition-all ${
                activeTab === tab.id ? 'text-white bg-white/10 border-b-2 border-purple-400' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'global' && (
              <motion.div key="global" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Your Position */}
                <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-xl p-4 mb-4">
                  <div className="text-yellow-400 text-sm mb-2">Your Ranking</div>
                  <LeaderboardRow
                    player={{
                      rank: playerRank,
                      name: playerName,
                      level: level,
                      wins: totalWins,
                      streak: currentWinStreak,
                      trophies: playerTrophies,
                    }}
                    isPlayer={true}
                  />
                </div>

                {/* Top Players */}
                <div className="text-white/50 text-sm mb-2">Top Players</div>
                {MOCK_LEADERBOARD.map(player => (
                  <LeaderboardRow key={player.rank} player={player} />
                ))}
              </motion.div>
            )}

            {activeTab === 'friends' && (
              <motion.div key="friends" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">👥</div>
                  <h3 className="text-white text-xl font-bold mb-2">Coming Soon!</h3>
                  <p className="text-white/50">Add friends to compete against them directly!</p>
                  <Button className="mt-4 bg-purple-600 hover:bg-purple-700">
                    Connect Social Account
                  </Button>
                </div>
              </motion.div>
            )}

            {activeTab === 'rewards' && (
              <motion.div key="rewards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-white/50 text-sm mb-4">Season End Rewards (24 days left)</div>

                {RANK_REWARDS.map((reward, idx) => (
                  <div
                    key={idx}
                    className={`
                      flex items-center gap-4 p-4 rounded-xl mb-3 border transition-all
                      ${typeof reward.rank === 'number' && reward.rank <= 3
                        ? 'bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-yellow-500/50'
                        : 'bg-white/5 border-white/10'}
                    `}
                  >
                    <div className={`w-16 text-center font-bold ${
                      reward.rank === 1 ? 'text-yellow-400 text-2xl' :
                      reward.rank === 2 ? 'text-gray-300 text-2xl' :
                      reward.rank === 3 ? 'text-orange-400 text-2xl' :
                      'text-white/70 text-lg'
                    }`}>
                      {typeof reward.rank === 'number' ? (
                        reward.rank === 1 ? '🥇' : reward.rank === 2 ? '🥈' : '🥉'
                      ) : (
                        `#${reward.rank}`
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="text-white font-semibold">{reward.title}</div>
                      <div className="flex gap-4 mt-1 text-sm">
                        <span className="text-purple-400">💎 {reward.gems}</span>
                        <span className="text-yellow-400">🪙 {reward.coins.toLocaleString()}</span>
                        <span className="text-blue-400">📦 {reward.packs}</span>
                      </div>
                    </div>

                    {typeof reward.rank === 'number' && reward.rank <= 3 && (
                      <div className="text-yellow-500 text-2xl">👑</div>
                    )}
                  </div>
                ))}

                <div className="mt-4 p-4 bg-purple-600/20 border border-purple-500/30 rounded-xl text-center">
                  <div className="text-purple-300 text-sm">Your Current Rank: #{playerRank}</div>
                  <div className="text-white font-semibold mt-1">
                    {playerRank <= 3 ? "You're in the top 3! Keep it up!" :
                     playerRank <= 10 ? "You're in the top 10! Push for higher!" :
                     "Win more battles to climb the ranks!"}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default Leaderboard;
