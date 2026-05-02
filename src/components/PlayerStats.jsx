import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useGameStore, ACHIEVEMENTS, ALL_CARDS } from '../stores/gameStore';

const PlayerStats = ({ onClose }) => {
  const {
    playerName, setPlayerName, level, xp, getXPForNextLevel,
    coins, gems, totalWins, totalLosses, currentWinStreak, bestWinStreak,
    totalDamageDealt, totalHealingDone, totalBattles, ownedCards,
    completedAchievements, consecutiveLogins,
  } = useGameStore();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(playerName);
  const [activeTab, setActiveTab] = useState('stats');

  const xpForNext = getXPForNextLevel();
  const xpProgress = (xp / xpForNext) * 100;
  const winRate = totalBattles > 0 ? ((totalWins / totalBattles) * 100).toFixed(1) : 0;

  const handleSaveName = () => {
    if (newName.trim()) setPlayerName(newName.trim());
    setEditingName(false);
  };

  const StatCard = ({ icon, label, value, color = 'text-white' }) => (
    <div className="bg-white/10 rounded-lg p-4 text-center hover:bg-white/15 transition-colors">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-white/60 text-sm">{label}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-b from-indigo-900 to-purple-900 rounded-2xl max-w-4xl w-full shadow-2xl my-8"
      >
        <div className="bg-indigo-800 p-6 rounded-t-2xl flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-4xl border-4 border-white shadow-lg">
              🧸
            </div>
            <div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-white/20 text-white px-3 py-1 rounded border border-white/30 focus:outline-none focus:border-white"
                    maxLength={20}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  />
                  <Button size="sm" onClick={handleSaveName}>Save</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-white">{playerName}</h2>
                  <button onClick={() => setEditingName(true)} className="text-white/50 hover:text-white">
                    ✏️
                  </button>
                </div>
              )}
              <div className="mt-2">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <span className="bg-yellow-500 text-black px-2 py-0.5 rounded font-bold">Lv. {level}</span>
                  <span>{xp} / {xpForNext} XP</span>
                </div>
                <Progress value={xpProgress} className="h-2 mt-1 w-48" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-yellow-400 text-2xl font-bold">{coins.toLocaleString()}</div>
              <div className="text-white/60 text-xs">Coins</div>
            </div>
            <div className="text-center">
              <div className="text-purple-400 text-2xl font-bold">{gems}</div>
              <div className="text-white/60 text-xs">Gems</div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl" aria-label="Close stats">×</button>
          </div>
        </div>

        <div className="flex border-b border-white/10">
          {['stats', 'achievements'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-center font-semibold transition-colors ${
                activeTab === tab ? 'text-white border-b-2 border-yellow-400' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {tab === 'stats' ? '📊 Statistics' : `🏆 Achievements (${completedAchievements.length}/${ACHIEVEMENTS.length})`}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-bold mb-3">⚔️ Battle Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard icon="🎮" label="Battles" value={totalBattles} />
                  <StatCard icon="🏆" label="Victories" value={totalWins} color="text-green-400" />
                  <StatCard icon="💔" label="Defeats" value={totalLosses} color="text-red-400" />
                  <StatCard icon="📈" label="Win Rate" value={`${winRate}%`} color="text-yellow-400" />
                </div>
              </div>

              <div>
                <h3 className="text-white font-bold mb-3">🔥 Streaks</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard icon="🔥" label="Current" value={currentWinStreak} color="text-orange-400" />
                  <StatCard icon="⭐" label="Best Streak" value={bestWinStreak} color="text-yellow-400" />
                  <StatCard icon="📅" label="Login Streak" value={consecutiveLogins} />
                  <StatCard icon="📚" label={`Cards (${ALL_CARDS.length})`} value={ownedCards.length} color="text-blue-400" />
                </div>
              </div>

              <div>
                <h3 className="text-white font-bold mb-3">💪 Combat Performance</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard icon="💥" label="Total Damage" value={totalDamageDealt.toLocaleString()} color="text-red-400" />
                  <StatCard icon="💚" label="Total Healing" value={totalHealingDone.toLocaleString()} color="text-green-400" />
                  <StatCard icon="✨" label="Completion" value={`${((ownedCards.length / ALL_CARDS.length) * 100).toFixed(0)}%`} color="text-purple-400" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div className="space-y-4">
              {ACHIEVEMENTS.map(achievement => {
                const isCompleted = completedAchievements.includes(achievement.id);
                return (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`rounded-lg p-4 flex items-center gap-3 border ${
                      isCompleted
                        ? 'bg-green-500/10 border-green-500/50'
                        : 'bg-white/5 border-white/10 opacity-60'
                    }`}
                  >
                    <div className={`text-4xl ${isCompleted ? '' : 'grayscale'}`}>
                      {achievement.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-semibold flex items-center gap-2">
                        {achievement.name}
                        {isCompleted && <span className="text-green-400 text-sm">✓</span>}
                      </div>
                      <div className="text-white/60 text-sm">{achievement.description}</div>
                    </div>
                    <div className={`font-bold ${isCompleted ? 'text-yellow-400' : 'text-yellow-400/50'}`}>
                      +{achievement.reward} 🪙
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PlayerStats;
