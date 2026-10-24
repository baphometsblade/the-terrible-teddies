import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon, Volume2, Sparkles, Smile, Meh, Angry,
  LogOut, Trash2, TriangleAlert, Minus, Check,
  Cloud, CloudUpload, CloudOff, HardDrive, ArrowLeftRight,
} from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { useGameStore } from '../stores/gameStore';
import { supabase } from '../utils/supabaseClient';
import { useDialog } from '@/hooks/useDialog';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';
import { Medallion, DialogClose } from '@/components/ui/game-chrome';
import { describeReset } from '@/lib/resetSummary';
import {
  useCloudSave, describeSaveStatus, formatSavedAt, switchToBackupSave, saveNow,
} from '@/lib/cloudSave';

// The save's state, as an icon beside its words (describeSaveStatus).
const SAVE_ICON = {
  saved: Cloud,
  pending: CloudUpload,
  saving: CloudUpload,
  checking: CloudUpload,
  offline: CloudOff,
};

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
//
// `htmlFor` names the row's control (a Switch's id): the row is then its
// <label>, so a tap anywhere on it — the words included — toggles the switch,
// not just the 44x24 track at its end. The control takes its name and
// description from the row's text (`${htmlFor}-label` / `-desc`), through
// aria-labelledby and aria-describedby. Spans throughout, since a label
// holds phrasing content only.
const SettingRow = ({ icon: Icon, label, description, htmlFor, children }) => {
  const Row = htmlFor ? 'label' : 'div';
  return (
    <Row
      htmlFor={htmlFor}
      className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-3.5 sm:gap-4 sm:px-4 ${
        htmlFor ? 'cursor-pointer transition-colors hover:bg-white/[0.03]' : ''}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg bg-brass-400/10 ring-1 ring-inset ring-brass-300/25 min-[360px]:grid"
        >
          <Icon className="h-[18px] w-[18px] text-brass-300" strokeWidth={2} />
        </span>
        <span className="block min-w-0">
          <span id={htmlFor && `${htmlFor}-label`} className="block font-display font-bold leading-tight text-plush-100">{label}</span>
          {description && (
            <span id={htmlFor && `${htmlFor}-desc`} className="mt-0.5 block text-[13px] leading-snug text-plush-300">{description}</span>
          )}
        </span>
      </span>
      {children}
    </Row>
  );
};

// `difficulty`/`setDifficulty` were closed over when this lived inside the
// component; hoisting means they arrive as props instead.
//
// One key of the difficulty switch (.seg-on / .seg-off in the .seg-well).
// Selected, the label and icon are brass on the glass key (brass-200 9.4:1,
// the description plush-200 7.3:1); the others are plush-200 / plush-300 on
// the recessed well, both above 7:1. Each line sets its own colour, so the
// key's own text colour never shows.
const DifficultyButton = ({ value, label, description, icon: Icon, difficulty, setDifficulty }) => {
  const selected = difficulty === value;
  return (
    <button
      type="button"
      onClick={() => setDifficulty(value)}
      aria-pressed={selected}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1.5 py-2.5 text-center transition-colors ${FOCUS_OUTLINE} ${
        selected ? 'seg-on' : 'seg-off'
      }`}
    >
      <Icon aria-hidden="true" className={`h-5 w-5 ${selected ? 'text-brass-300' : 'text-plush-300'}`} strokeWidth={2.2} />
      <span className={`font-display font-extrabold leading-tight ${selected ? 'text-brass-200' : 'text-plush-200'}`}>{label}</span>
      <span className={`text-xs leading-tight ${selected ? 'text-plush-200' : 'text-plush-300'}`}>{description}</span>
    </button>
  );
};

// The reset's two lists, deleted then kept (see describeReset). Inside the
// red confirmation panel; every line is text on that panel's dark red, with
// its own tone (red-100 / red-200 for what goes, emerald-200 for what stays).
const ResetSummary = ({ summary }) => (
  <div className="grid gap-3 text-sm leading-snug">
    <section aria-labelledby="reset-deletes">
      <h4 id="reset-deletes" className="label-caps mb-1.5 text-red-300">Deleted</h4>
      <ul className="space-y-1">
        {summary.deletes.map(({ label, after }) => (
          <li key={label} className="flex gap-2">
            <Minus aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-300" strokeWidth={2.4} />
            <span className="min-w-0 text-red-100">
              {label}
              {after && <span className="text-red-200">{` — ${after}`}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
    <section aria-labelledby="reset-keeps">
      <h4 id="reset-keeps" className="label-caps mb-1.5 text-emerald-300">Kept</h4>
      <ul className="space-y-1">
        {summary.keeps.map((label) => (
          <li key={label} className="flex gap-2">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" strokeWidth={2.6} />
            <span className="min-w-0 font-semibold text-emerald-100">{label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-red-100">{summary.note}</p>
    </section>
  </div>
);

const Settings = ({ onClose }) => {
  // The whole store: the reset confirmation is worded from the live save.
  const store = useGameStore();
  const {
    soundEnabled, setSoundEnabled,

    animationsEnabled, setAnimationsEnabled,
    difficulty, setDifficulty,
    resetProgress,
  } = store;

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const resetButtonRef = useRef(null);
  const refocusReset = useRef(false);

  // Arming and cancelling each swap the focused button for something else,
  // and focus fell to <body> both ways — the next Tab then restarted at the
  // top of the dialog. Arming focuses the RESET field (autoFocus, below);
  // cancelling hands focus back to the button that armed it.
  useEffect(() => {
    if (!showResetConfirm && refocusReset.current) {
      refocusReset.current = false;
      resetButtonRef.current?.focus();
    }
  }, [showResetConfirm]);

  const cancelReset = () => {
    refocusReset.current = true;
    setShowResetConfirm(false);
    setResetConfirmText('');
  };

  const [signingOut, setSigningOut] = useState(false);

  // Where the save is (src/lib/cloudSave.js), and the other save when two
  // did not match. `switched` is said once a switch has happened.
  const cloud = useCloudSave();
  // Every phase but these reaches the account (offline and checking
  // included: the reset is sent once the account can be reached).
  const onAccount = !['off', 'unavailable', 'too-large'].includes(cloud.phase);
  const resetSummary = describeReset(store, undefined, { onAccount });
  const [switched, setSwitched] = useState('');
  const handleSwitch = () => {
    const to = cloud.backup;
    if (switchToBackupSave()) setSwitched(`Switched to the Level ${to.level} save. The one you had is now the other save.`);
  };

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
    // Send the last few seconds of play to the account first. Not reaching
    // it does not hold up signing out: the save stays on this device, and is
    // put aside rather than wiped if another account signs in here.
    await saveNow({ timeoutMs: 4000 });
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
      className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
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
          <Medallion icon={SettingsIcon} />
          <h2 className="min-w-0 flex-1 font-display text-2xl font-extrabold leading-none text-brass-gradient sm:text-3xl">
            Settings
          </h2>
          <DialogClose label="Close settings" onClick={onClose} />
        </div>

        <div className="relative min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
          <section>
            <SectionHeading>Audio</SectionHeading>
            <div className="panel-glass rounded-xl">
              <SettingRow icon={Volume2} label="Sound Effects" description="Card plays, attacks, and abilities" htmlFor="setting-sound">
                <Switch
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                  id="setting-sound"
                  aria-labelledby="setting-sound-label"
                  aria-describedby="setting-sound-desc"
                  className={SWITCH}
                />
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
              <SettingRow icon={Sparkles} label="Animations" description="Card animations and effects" htmlFor="setting-animations">
                <Switch
                  checked={animationsEnabled}
                  onCheckedChange={setAnimationsEnabled}
                  id="setting-animations"
                  aria-labelledby="setting-animations-label"
                  aria-describedby="setting-animations-desc"
                  className={SWITCH}
                />
              </SettingRow>
            </div>
          </section>

          <section>
            <SectionHeading>AI Difficulty</SectionHeading>
            {/* One recessed well, the chosen key raised out of it. Each key is
                still its own aria-pressed button. */}
            <div className="seg-well grid grid-cols-3 gap-1">
              <DifficultyButton difficulty={difficulty} setDifficulty={setDifficulty} value="easy" label="Easy" description="Relaxed" icon={Smile} />
              <DifficultyButton difficulty={difficulty} setDifficulty={setDifficulty} value="normal" label="Normal" description="Balanced" icon={Meh} />
              <DifficultyButton difficulty={difficulty} setDifficulty={setDifficulty} value="hard" label="Hard" description="Challenge" icon={Angry} />
            </div>
          </section>

          <section>
            <SectionHeading>Account</SectionHeading>
            {/* Where the progress is kept, said as it is: on the account once
                it has it, on this device until then, and on this device only
                where the backend has no cloud saves. Sign-up says the same
                (Auth.jsx). */}
            <div className="panel-glass mb-3 rounded-xl">
              <SettingRow
                icon={SAVE_ICON[cloud.phase] ?? HardDrive}
                label="Your progress"
                description={describeSaveStatus(cloud)}
              />
              {cloud.backup && (
                <div className="border-t border-white/[0.06] px-3.5 py-3.5 sm:px-4">
                  <div className="font-display font-bold leading-tight text-plush-100">Other save on this device</div>
                  <div className="mt-0.5 text-[13px] leading-snug text-plush-300">
                    Level {cloud.backup.level} · {cloud.backup.cards} cards · kept {formatSavedAt(cloud.backup.savedAt)}
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitch}
                    className={`${ACTION} btn-glass mt-3`}
                  >
                    <ArrowLeftRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                    Switch to this save
                  </button>
                  <p className="mt-2 text-xs leading-snug text-plush-300">
                    Your current save becomes the other one, so you can switch back.
                  </p>
                </div>
              )}
              {/* Mounted throughout, so the switch is announced when it lands. */}
              <p role="status" className={switched ? 'border-t border-white/[0.06] px-3.5 py-2.5 text-xs font-semibold text-emerald-200 sm:px-4' : 'sr-only'}>
                {switched}
              </p>
            </div>
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
                ref={resetButtonRef}
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-950/40 font-display font-bold text-red-200 ring-1 ring-inset ring-red-400/40 transition-colors hover:bg-red-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                Reset All Progress
              </button>
            ) : (
              <div className="rounded-xl bg-red-950/40 p-4 ring-1 ring-inset ring-red-400/40">
                {/* What goes and what stays, in this player's numbers. It
                    said only "This will delete ALL progress", which was
                    wrong both ways: it hid that bought gems were deleted
                    (they no longer are), and it now keeps several things. */}
                <p className="mb-3 flex gap-2 text-sm font-semibold text-red-100">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-300" strokeWidth={2.2} />
                  <span>
                    Resetting can&apos;t be undone.
                    {/* While the account keeps this save, the reset goes to
                        it too (see describeReset). */}
                    {resetSummary.account && <span data-reset-account="" className="mt-1 block">{resetSummary.account}</span>}
                  </span>
                </p>
                <ResetSummary summary={resetSummary} />
                <p className="mb-2 mt-4 text-sm text-red-100">
                  Type &quot;RESET&quot; to confirm.
                </p>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Type RESET"
                  aria-label="Type RESET to confirm the reset"
                  autoFocus
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
                    onClick={cancelReset}
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
