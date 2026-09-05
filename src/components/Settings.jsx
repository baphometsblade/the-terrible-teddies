import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useGameStore } from '../stores/gameStore';
import { supabase } from '../utils/supabaseClient';
import { useDialog } from '@/hooks/useDialog';

// Declared at module scope, NOT inside Settings.
//
// Defining a component inside a render creates a brand-new component TYPE on
// every render, so React unmounts the previous subtree and mounts a fresh one
// instead of updating it. That destroys the DOM node the user is interacting
// with: pressing Enter on a difficulty button re-rendered Settings, remounted
// all three buttons, and dropped focus to <body> — a keyboard user lost their
// place on every single toggle. (An axe audit can't see this; it inspects a
// static snapshot, not focus across interactions.)
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

// `difficulty`/`setDifficulty` were closed over when this lived inside the
// component; hoisting means they arrive as props instead.
const DifficultyButton = ({ value, label, description, color, difficulty, setDifficulty }) => (
  <button
    onClick={() => setDifficulty(value)}
    aria-pressed={difficulty === value}
    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
      difficulty === value ? `${color} border-white scale-105` : 'bg-white/5 border-white/20 hover:border-white/40'
    }`}
  >
    <div className="text-white font-bold">{label}</div>
    {/* Full-opacity (not /60) so the description clears 4.5:1 against all
        three selected-state backgrounds (green-700/brass-600/red-600) —
        see contrast notes on the `color` values below. */}
    <div className="text-white text-xs mt-1">{description}</div>
  </button>
);

const Settings = ({ onClose }) => {
  const {
    soundEnabled, setSoundEnabled,

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

  const [signOutError, setSignOutError] = useState(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    // The auth listener (hooks/useSupabaseAuth) nulls the session on sign-out,
    // which drops the app back to the Auth screen automatically.
    //
    // The {error} was previously discarded and the dialog closed regardless.
    // When sign-out fails — offline, or the token endpoint unreachable — the
    // session survives, the auth listener never fires, and the app stays
    // signed in while the UI reports success by simply closing. On a shared
    // device that hands the next person a live session, so this must fail
    // loudly and keep the dialog open.
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);
    if (error) {
      console.error('Sign-out failed:', error);
      setSignOutError("Couldn't sign out — check your connection and try again. You are still signed in.");
      return;
    }
    onClose();
  };


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
              <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} aria-label="Sound Effects" />
            </SettingRow>
            {/* No "Music" row. It toggled a persisted musicEnabled flag that
                nothing in the app has ever read, and there is no music to
                control: public/sounds/ holds four effect clips and no track.
                A switch that changes nothing is the same defect as a reward
                table with no payout behind it — restore it with the music. */}
          </div>

          <div className="mb-6">
            <h3 className="text-white/50 text-sm uppercase tracking-wider mb-2">Visual</h3>
            <SettingRow icon="✨" label="Animations" description="Card animations and effects">
              <Switch checked={animationsEnabled} onCheckedChange={setAnimationsEnabled} aria-label="Animations" />
            </SettingRow>
          </div>

          <div className="mb-6">
            <h3 className="text-white/50 text-sm uppercase tracking-wider mb-4">AI Difficulty</h3>
            <div className="flex gap-3">
              {/* bg-green-600 measured 3.29:1 for white bold text against AA's
                  4.5:1 minimum (and only 2.07:1 for the dimmed description).
                  green-700 clears it: white-on-green-700 = 5.02:1 for both
                  the bold label and the (now full-opacity) description. */}
              <DifficultyButton difficulty={difficulty} setDifficulty={setDifficulty} value="easy" label="😊 Easy" description="Relaxed" color="bg-green-700" />
              {/* Sibling shades already clear AA at full opacity: white-on-
                  brass-600 = 5.02:1, white-on-red-600 = 4.83:1 — unchanged. */}
              <DifficultyButton difficulty={difficulty} setDifficulty={setDifficulty} value="normal" label="😐 Normal" description="Balanced" color="bg-brass-600" />
              <DifficultyButton difficulty={difficulty} setDifficulty={setDifficulty} value="hard" label="😈 Hard" description="Challenge" color="bg-red-600" />
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
            {signOutError && (
              <p role="alert" className="mt-2 text-amber-300 text-xs">{signOutError}</p>
            )}
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
