import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon, X, Volume2, Sparkles, Smile, Meh, Angry,
  LogOut, Trash2, TriangleAlert,
} from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { useGameStore } from '../stores/gameStore';
import { supabase } from '../utils/supabaseClient';
import { useDialog } from '@/hooks/useDialog';
import { RARITY_METAL } from '@/lib/rarity';

// Focus on anything wearing a material (btn-glass, btn-brass) is an outline,
// not a ring: a Tailwind ring is a box-shadow, and it would replace the
// material's own rim light and depth.
const FOCUS_OUTLINE =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-300';

// Shape of every full-width action here. Plain <button>s, not the shadcn
// Button: its bg-primary is a utility and would beat a component-layer
// material.
const ACTION = `flex h-11 w-full items-center justify-center gap-2 rounded-xl font-display font-bold ${FOCUS_OUTLINE}`;

// The shadcn Switch recoloured for the room: a brass track when on, a dark
// recessed one when off, the white thumb marking the state in both. These are
// utilities, so tailwind-merge swaps them for the component's own bg-primary /
// bg-input / ring colours rather than fighting them. A Switch carries no
// material, so its focus stays the component's ring.
const SWITCH =
  'border-white/15 data-[state=checked]:border-brass-300/60 data-[state=checked]:bg-brass-400 ' +
  'data-[state=unchecked]:bg-night-950 focus-visible:ring-brass-300 focus-visible:ring-offset-night-800';

// The difficulty switch: the Collection's recessed well with the chosen
// segment raised out of it as a glass key with a lit brass lip. The selected
// key restates .btn-glass's shadow because a shadow utility replaces the
// material's rather than adding to it.
const SEG_GROUP =
  'grid grid-cols-3 gap-1 rounded-xl bg-night-950/55 p-1 ring-1 ring-inset ring-white/[0.07] shadow-[inset_0_1px_3px_rgba(0,0,0,0.45)]';
const SEG_ON =
  'btn-glass shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-2px_0_rgba(251,191,36,0.55),0_4px_10px_-6px_rgba(0,0,0,0.8)]';
const SEG_OFF = 'border border-transparent hover:bg-white/[0.04]';

const SectionHeading = ({ children, tone = 'text-plush-300' }) => (
  <h3 className={`label-caps mb-2.5 ${tone}`}>{children}</h3>
);

// Declared at module scope, NOT inside Settings.
//
// Defining a component inside a render creates a brand-new component TYPE on
// every render, so React unmounts the previous subtree and mounts a fresh one
// instead of updating it. That destroys the DOM node the user is interacting
// with: pressing Enter on a difficulty button re-rendered Settings, remounted
// all three buttons, and dropped focus to <body> — a keyboard user lost their
// place on every single toggle. (An axe audit can't see this; it inspects a
// static snapshot, not focus across interactions.)
//
// The icon tile steps aside below 360px, where the label and its description
// need the width more than the row needs the ornament.
const SettingRow = ({ icon: Icon, label, description, children }) => (
  <div className="flex items-center justify-between gap-3 px-3.5 py-3.5 sm:gap-4 sm:px-4">
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg bg-brass-400/10 ring-1 ring-inset ring-brass-300/25 min-[360px]:grid"
      >
        <Icon className="h-[18px] w-[18px] text-brass-300" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="font-display font-bold leading-tight text-plush-100">{label}</div>
        {description && <div className="mt-0.5 text-[13px] leading-snug text-plush-300">{description}</div>}
      </div>
    </div>
    {children}
  </div>
);

// `difficulty`/`setDifficulty` were closed over when this lived inside the
// component; hoisting means they arrive as props instead.
//
// One key of the difficulty switch. Selected, the label and icon are brass on
// the glass key (brass-200 9.4:1, the description plush-200 7.3:1); the others
// are plush-200 / plush-300 on the recessed well, both above 7:1.
const DifficultyButton = ({ value, label, description, icon: Icon, difficulty, setDifficulty }) => {
  const selected = difficulty === value;
  return (
    <button
      type="button"
      onClick={() => setDifficulty(value)}
      aria-pressed={selected}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1.5 py-2.5 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brass-300 ${
        selected ? SEG_ON : SEG_OFF
      }`}
    >
      <Icon aria-hidden="true" className={`h-5 w-5 ${selected ? 'text-brass-300' : 'text-plush-300'}`} strokeWidth={2.2} />
      <span className={`font-display font-extrabold leading-tight ${selected ? 'text-brass-200' : 'text-plush-200'}`}>{label}</span>
      <span className={`text-xs leading-tight ${selected ? 'text-plush-200' : 'text-plush-300'}`}>{description}</span>
    </button>
  );
};

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
      // The scrim scrolls and the panel centres with my-auto (not
      // items-center: a centred flex item taller than its box overflows at
      // both ends). Inside the panel only the settings list scrolls.
      className="fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto p-3 sm:p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl dialog-panel sm:max-h-[calc(100dvh-3rem)]"
      >
        {/* Amber light over the bar, pooled behind the title. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(251,191,36,0.1),transparent_70%)]"
        />

        <div className="relative flex items-center gap-3 border-b border-white/[0.06] px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
          <div aria-hidden="true" className="h-11 w-11 shrink-0 rounded-full p-[2px]" style={{ background: RARITY_METAL.legendary }}>
            <div className="grid h-full w-full place-items-center rounded-full bg-night-900">
              <SettingsIcon className="h-5 w-5 text-brass-300" strokeWidth={2} />
            </div>
          </div>
          <h2 className="min-w-0 flex-1 font-display text-2xl font-extrabold leading-none text-brass-gradient sm:text-3xl">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className={`btn-glass grid h-10 w-10 shrink-0 place-items-center rounded-xl text-plush-200 hover:text-white ${FOCUS_OUTLINE}`}
          >
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
          <section>
            <SectionHeading>Audio</SectionHeading>
            <div className="panel-glass rounded-xl">
              <SettingRow icon={Volume2} label="Sound Effects" description="Card plays, attacks, and abilities">
                <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} aria-label="Sound Effects" className={SWITCH} />
              </SettingRow>
            </div>
            {/* No "Music" row. It toggled a persisted musicEnabled flag that
                nothing in the app has ever read, and there is no music to
                control: public/sounds/ holds four effect clips and no track.
                A switch that changes nothing is the same defect as a reward
                table with no payout behind it — restore it with the music. */}
          </section>

          <section>
            <SectionHeading>Visual</SectionHeading>
            <div className="panel-glass rounded-xl">
              <SettingRow icon={Sparkles} label="Animations" description="Card animations and effects">
                <Switch checked={animationsEnabled} onCheckedChange={setAnimationsEnabled} aria-label="Animations" className={SWITCH} />
              </SettingRow>
            </div>
          </section>

          <section>
            <SectionHeading>AI Difficulty</SectionHeading>
            {/* One recessed well, the chosen key raised out of it. Each key is
                still its own aria-pressed button. */}
            <div className={SEG_GROUP}>
              <DifficultyButton difficulty={difficulty} setDifficulty={setDifficulty} value="easy" label="Easy" description="Relaxed" icon={Smile} />
              <DifficultyButton difficulty={difficulty} setDifficulty={setDifficulty} value="normal" label="Normal" description="Balanced" icon={Meh} />
              <DifficultyButton difficulty={difficulty} setDifficulty={setDifficulty} value="hard" label="Hard" description="Challenge" icon={Angry} />
            </div>
          </section>

          <section>
            <SectionHeading>Account</SectionHeading>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className={`${ACTION} btn-glass disabled:cursor-wait disabled:opacity-60`}
            >
              <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </button>
            {signOutError && (
              <p role="alert" className="mt-2 text-xs text-amber-300">{signOutError}</p>
            )}
          </section>

          <section className="border-t border-white/[0.06] pt-5">
            <SectionHeading tone="text-red-300">Danger Zone</SectionHeading>
            {!showResetConfirm ? (
              // A plain button (no material), so its focus may be a ring —
              // in red, the zone's own colour.
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-950/40 font-display font-bold text-red-200 ring-1 ring-inset ring-red-400/40 transition-colors hover:bg-red-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                Reset All Progress
              </button>
            ) : (
              <div className="rounded-xl bg-red-950/40 p-4 ring-1 ring-inset ring-red-400/40">
                <p className="mb-3 flex gap-2 text-sm text-red-200">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
                  <span>This will delete ALL progress. Type &quot;RESET&quot; to confirm.</span>
                </p>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Type RESET"
                  aria-label="Type RESET to confirm deleting all progress"
                  className="mb-3 h-11 w-full rounded-xl bg-night-950/80 px-3 font-semibold tracking-[0.12em] text-white ring-1 ring-inset ring-red-400/40 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] placeholder:font-normal placeholder:tracking-normal placeholder:text-plush-300 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <div className="flex gap-2">
                  {/* White on red-600 is 4.8:1; disabled, it is exempt. Plain
                      fill, no material, so a red ring for focus. */}
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={resetConfirmText !== 'RESET'}
                    className="flex h-11 flex-1 items-center justify-center rounded-xl bg-red-600 font-display font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-night-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-red-600"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowResetConfirm(false); setResetConfirmText(''); }}
                    className={`${ACTION} btn-glass flex-1`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="relative border-t border-white/[0.06] px-4 py-3 text-center sm:px-6">
          <p className="label-caps text-plush-400">Terrible Teddies v1.0</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Settings;
