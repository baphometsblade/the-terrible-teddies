import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useGameStore } from '../stores/gameStore';
import { supabase } from '../utils/supabaseClient';
import { useDialog } from '@/hooks/useDialog';

const Settings = ({ onClose }) => {
  const {
    soundEnabled, setSoundEnabled,
    musicEnabled, setMusicEnabled,
    animationsEnabled, setAnimationsEnabled,
    difficulty, setDifficulty,
    resetProgress,
  } = useGameStore();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const [signingOut, setSigningOut] = useState(false);

  const dialogRef = useDialog(onClose);

  const handleReset = () => {
    if (resetConfirmText === 'RESET') {
      resetProgress();
      setShowResetConfirm(false);
      setResetConfirmText('');
      onClose();
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    // The auth listener (hooks/useSupabaseAuth) nulls the session on sign-out,
    // which drops the app back to the Auth screen automatically.
    await supabase.auth.signOut();
    onClose();
  };

  const SettingRow = ({ icon, label, description, children }) => (
    <div className="flex items-center justify-between py-4 border-b border-white/10">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-white font-semibold">{label}</div>
          {description && <div className="text-white/50 text-sm">{description}</div>}
        </div>
      </div>
      {children}
    </div>
  );

  const DifficultyButton = ({ value, label, description, color }) => (
    <button
      onClick={() => setDifficulty(value)}
      aria-pressed={difficulty === value}
      className={`flex-1 p-4 rounded-lg border-2 transition-all ${
        difficulty === value ? `${color} border-white scale-105` : 'bg-white/5 border-white/20 hover:border-white/40'
      }`}
    >
      <div className="text-white font-bold">{label}</div>
      <div className="text-white/60 text-xs mt-1">{description}</div>
    </button>
  );

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-b from-night-900 to-night-700 rounded-2xl max-w-lg w-full shadow-2xl"
      >
        <div className="bg-night-800 p-6 rounded-t-2xl flex justify-between items-center border-b border-white/10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">⚙️ Settings</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl" aria-label="Close settings">×</button>
        </div>

        <div className="p-6 space-y-2 max-h-[70vh] overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-white/50 text-sm uppercase tracking-wider mb-2">Audio</h3>
            <SettingRow icon="🔊" label="Sound Effects" description="Card plays, attacks, and abilities">
              <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
            </SettingRow>
            <SettingRow icon="🎵" label="Music" description="Background music">
              <Switch checked={musicEnabled} onCheckedChange={setMusicEnabled} />
            </SettingRow>
          </div>

          <div className="mb-6">
            <h3 className="text-white/50 text-sm uppercase tracking-wider mb-2">Visual</h3>
            <SettingRow icon="✨" label="Animations" description="Card animations and effects">
              <Switch checked={animationsEnabled} onCheckedChange={setAnimationsEnabled} />
            </SettingRow>
          </div>

          <div className="mb-6">
            <h3 className="text-white/50 text-sm uppercase tracking-wider mb-4">AI Difficulty</h3>
            <div className="flex gap-3">
              <DifficultyButton value="easy" label="😊 Easy" description="Relaxed" color="bg-green-600" />
              <DifficultyButton value="normal" label="😐 Normal" description="Balanced" color="bg-brass-600" />
              <DifficultyButton value="hard" label="😈 Hard" description="Challenge" color="bg-red-600" />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-white/50 text-sm uppercase tracking-wider mb-4">Account</h3>
            <Button
              onClick={handleSignOut}
              disabled={signingOut}
              variant="outline"
              className="w-full border-white/30 text-white hover:bg-white/10"
            >
              {signingOut ? 'Signing out…' : '🚪 Sign Out'}
            </Button>
          </div>

          <div className="pt-6 border-t border-white/10">
            <h3 className="text-red-400 text-sm uppercase tracking-wider mb-4">Danger Zone</h3>
            {!showResetConfirm ? (
              <Button
                variant="destructive"
                onClick={() => setShowResetConfirm(true)}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                🗑️ Reset All Progress
              </Button>
            ) : (
              <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
                <p className="text-red-300 text-sm mb-3">
                  This will delete ALL progress. Type &quot;RESET&quot; to confirm.
                </p>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Type RESET"
                  aria-label="Type RESET to confirm deleting all progress"
                  className="w-full bg-black/50 border border-red-500 text-white px-3 py-2 rounded mb-3"
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleReset}
                    disabled={resetConfirmText !== 'RESET'}
                    className="flex-1"
                  >
                    Confirm Reset
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setShowResetConfirm(false); setResetConfirmText(''); }}
                    className="flex-1 text-white border-white/30"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-night-800/50 p-4 rounded-b-2xl text-center">
          <p className="text-white/30 text-sm">Terrible Teddies v1.0</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Settings;
