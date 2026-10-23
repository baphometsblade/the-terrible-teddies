import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  X, Pencil, Coins, Gem, BarChart3, Trophy, Gamepad2, HeartCrack, TrendingUp, Flame, Star,
  CalendarDays, LibraryBig, Bomb, HeartPulse, Sparkles, Check, Lock,
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { useGameStore, ACHIEVEMENTS, ALL_CARDS } from '../stores/gameStore';
import { useDialog } from '@/hooks/useDialog';
import { setPlayerUsername } from '../utils/supabaseClient';
import { RARITY_METAL } from '@/lib/rarity';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';
import { BalanceChip } from '@/components/ui/game-chrome';

// The avatar ring the menu's player chip wears.
const AVATAR_RING = 'linear-gradient(145deg, #fde68a, #b45309 45%, #fbbf24)';

// Module scope (not inside PlayerStats), so a re-render updates the tiles in
// place instead of remounting them. The icon carries the colour; the number
// stays white so the grid reads as one set.
const StatTile = ({ icon: Icon, label, value, tone = 'text-plush-200', bar, className = '' }) => (
  <div className={`panel-glass rounded-xl p-3.5 sm:p-4 ${className}`}>
    <span
      aria-hidden="true"
      className={`grid h-8 w-8 place-items-center rounded-lg bg-white/5 ring-1 ring-inset ring-white/10 ${tone}`}
    >
      <Icon className="h-4 w-4" strokeWidth={2.2} />
    </span>
    <div className="mt-3 font-display text-2xl font-extrabold leading-none tabular-nums text-white sm:text-[28px]">{value}</div>
    <div className="label-caps mt-1.5 text-plush-300">{label}</div>
    {/* The meter repeats the number above it, so it is hidden from a screen
        reader rather than announced a second time. */}
    {bar != null && (
      <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-night-950/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brass-300 to-brass-500"
          style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
        />
      </div>
    )}
  </div>
);

const Section = ({ title, children }) => (
  <section>
    <div className="mb-3 flex items-center gap-3">
      <h3 className="label-caps shrink-0 text-plush-300">{title}</h3>
      <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
    </div>
    {children}
  </section>
);

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
  const dialogRef = useDialog(onClose);
  const bodyRef = useRef(null);
  const editButtonRef = useRef(null);
  const refocusEdit = useRef(false);

  // Saving swaps the rename field back for the name and its pencil, so the
  // control that had focus is gone and focus fell to <body>; the next Tab
  // then restarted at the top of the dialog. Hand it to the pencil instead,
  // the control that opened the field.
  useEffect(() => {
    if (!editingName && refocusEdit.current) {
      refocusEdit.current = false;
      editButtonRef.current?.focus();
    }
  }, [editingName]);

  // Each tab opens at its top: both share one scroller, so without this the
  // achievements list opened wherever the statistics had been scrolled to.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [activeTab]);

  const xpForNext = getXPForNextLevel();
  const xpProgress = (xp / xpForNext) * 100;
  const winRate = totalBattles > 0 ? ((totalWins / totalBattles) * 100).toFixed(1) : 0;
  const completion = (ownedCards.length / ALL_CARDS.length) * 100;

  const [nameError, setNameError] = useState(null);

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    refocusEdit.current = true;
    if (!trimmed) { setEditingName(false); return; }

    // Apply locally first so the rename still feels instant.
    setPlayerName(trimmed);
    setEditingName(false);
    setNameError(null);

    // ...but do NOT discard what the server says. This was fire-and-forget, on
    // the reasoning that the server "is the source of truth for what other
    // players see" — which is exactly why a rejection matters. set_player_username
    // enforces 2-20 characters and a charset, and is rate limited; on any of
    // those, setPlayerUsername returns null, the leaderboard keeps the OLD name,
    // and the player was never told. They saw their new name everywhere in the
    // app and appeared to everyone else under the previous one, with nothing
    // anywhere indicating a mismatch.
    const stored = await setPlayerUsername(trimmed);
    if (stored === null) {
      setNameError("Couldn't save that name for the leaderboard — other players still see your old one.");
      return;
    }
    // The server trims and may return a normalised form; adopt it so local and
    // public names cannot drift apart.
    if (stored !== trimmed) setPlayerName(stored);
  };

  const TABS = [
    { id: 'stats', icon: BarChart3, label: 'Statistics' },
    { id: 'achievements', icon: Trophy, label: 'Achievements', done: completedAchievements.length, total: ACHIEVEMENTS.length },
  ];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Player stats"
      // The scrim scrolls and the panel centres with my-auto (not
      // items-center: a centred flex item taller than its box overflows at
      // both ends).
      className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
    >
      {/* Capped to the viewport, with the profile and the tabs pinned and only
          the tab content scrolling, only where the screen is tall enough to
          spare that. The pinned chrome is about 300px when the profile
          stacks, so on a short screen — a landscape phone, or a laptop at
          200% zoom (about 640x400) — a capped panel left the stats a window of
          0-60px, and the rest could not be scrolled into view at all. Below
          600px the panel takes its natural height instead and the scrim
          scrolls the whole of it. */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative my-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl dialog-panel [@media(min-height:600px)]:max-h-[calc(100dvh-1.5rem)] sm:[@media(min-height:600px)]:max-h-[calc(100dvh-3rem)]"
      >
        {/* Lamplight over the profile. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(ellipse_60%_90%_at_50%_0%,rgba(251,191,36,0.12),transparent_70%)] md:bg-[radial-gradient(ellipse_45%_90%_at_15%_0%,rgba(251,191,36,0.12),transparent_70%)]"
        />

        {/* Profile. Below md it stacks and centres, so the name — and the
            rename field, which needs room for twenty characters and a Save
            button — gets the panel's full width rather than what is left
            beside the avatar and the balances. From md up it is one row. The
            close control is last in the markup and positioned into the corner,
            so the dialog's first focus still lands on the name's edit button,
            as it did. */}
        <div className="relative px-4 pb-4 pt-5 sm:px-6">
          <div className="flex flex-col items-center gap-3 text-center md:flex-row md:gap-4 md:pr-14 md:text-left">
            <div
              aria-hidden="true"
              className="h-16 w-16 shrink-0 rounded-full p-[3px] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.8)] md:h-[72px] md:w-[72px]"
              style={{ background: AVATAR_RING }}
            >
              <div className="grid h-full w-full place-items-center rounded-full bg-night-800 text-3xl md:text-4xl">🧸</div>
            </div>

            <div className="w-full min-w-0 md:flex-1">
              {editingName ? (
                <div className="mx-auto flex w-full max-w-xs items-center gap-2 md:mx-0">
                  {/* A plain input, so its focus may be a ring. */}
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    aria-label="Player name"
                    className="h-10 min-w-0 flex-1 rounded-xl bg-night-950/70 px-3 font-display text-lg font-bold text-white ring-1 ring-inset ring-white/15 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] focus:outline-none focus:ring-2 focus:ring-brass-300"
                    maxLength={20}
                    autoFocus
                    // preventDefault, because saving hands focus to the pencil
                    // before this key's keypress is dispatched — and a keypress
                    // Enter on a button clicks it, reopening the field.
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      handleSaveName();
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    className={`btn-brass inline-flex h-10 shrink-0 items-center rounded-xl px-4 font-display font-bold ${FOCUS_OUTLINE}`}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex min-w-0 items-center justify-center gap-2 md:justify-start">
                  {/* text-xl on the narrowest phones, where it keeps a
                      twenty-character name on one line beside its pencil. */}
                  <h2 className="min-w-0 break-words font-display text-xl font-extrabold leading-tight text-white min-[360px]:text-2xl">{playerName}</h2>
                  <button
                    ref={editButtonRef}
                    type="button"
                    onClick={() => setEditingName(true)}
                    aria-label="Edit player name"
                    className={`btn-glass grid h-8 w-8 shrink-0 place-items-center rounded-lg text-plush-200 hover:text-white ${FOCUS_OUTLINE}`}
                  >
                    <Pencil aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
                  </button>
                </div>
              )}
              {/* role=alert so the failure is announced, not merely drawn —
                  a rename that silently did not reach the leaderboard is
                  precisely the thing a player cannot otherwise discover. */}
              {nameError && (
                <p role="alert" className="mx-auto mt-1.5 max-w-xs text-xs text-amber-300 md:mx-0">{nameError}</p>
              )}
              <div className="mx-auto mt-2 w-full max-w-[16rem] md:mx-0">
                <div className="flex items-center justify-center gap-2 text-xs text-plush-200 md:justify-start">
                  <span className="btn-brass whitespace-nowrap rounded-md px-1.5 py-[3px] text-[11px] font-extrabold leading-none">Lv. {level}</span>
                  <span className="whitespace-nowrap tabular-nums">{xp} / {xpForNext} XP</span>
                </div>
                <Progress
                  value={xpProgress}
                  className="mt-1.5 h-1.5 bg-night-950/70 [&>div]:bg-gradient-to-r [&>div]:from-brass-300 [&>div]:to-brass-500"
                  aria-label={`Level ${level} XP progress: ${xp} of ${xpForNext}`}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 md:shrink-0">
              <BalanceChip icon={Coins} value={coins.toLocaleString()} tone="text-brass-300" noun="coins" />
              <BalanceChip icon={Gem} value={gems.toLocaleString()} tone="text-fuchsia-300" noun="gems" />
            </div>
          </div>

          {/* Positioned by a wrapper: centred on the row from md up without a
              translate on the button, whose material owns transform for its
              press. */}
          <div className="absolute right-4 top-4 sm:right-6 md:inset-y-0 md:top-0 md:flex md:items-center">
            <button
              type="button"
              onClick={onClose}
              className={`btn-glass grid h-10 w-10 place-items-center rounded-xl text-plush-200 hover:text-white ${FOCUS_OUTLINE}`}
              aria-label="Close stats"
            >
              <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* Tabs: the segmented control's recessed well, the selected tab
            raised out of it as a glass key with a lit brass lip. */}
        <div className="relative px-4 pb-4 sm:px-6">
          {/* Equal halves where they fit, and never narrower than the tab's
              one line (flex-1 with min-w-fit): at 320 "Achievements" and its
              count need more than half the switch, so that segment takes it
              from "Statistics", which needs less. The count used to wrap
              under the label in parentheses (at 390 as well as below 360),
              which made the tab taller than its neighbour and off-centre. It
              is the pill Challenges' tabs use now. The icons join from sm
              up, where there is room. Below 360 the tabs and the pill pad
              tighter: with a two-digit count ("10/16") the two tabs' one-line
              widths came to a pixel more than the well, and the pill sat on
              its rim. */}
          <div className="seg-well flex gap-1">
            {TABS.map((tab) => {
              const on = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={on}
                  data-tab={tab.id}
                  className={`flex min-h-9 min-w-fit flex-1 items-center justify-center gap-x-1 whitespace-nowrap rounded-lg px-1 py-1.5 min-[360px]:px-1.5 text-[13px] font-semibold leading-tight transition-colors sm:gap-x-2 sm:px-2 sm:text-sm ${FOCUS_OUTLINE} ${
                    on ? 'seg-on' : 'seg-off'
                  }`}
                >
                  <tab.icon aria-hidden="true" className="hidden h-4 w-4 shrink-0 sm:block" strokeWidth={2.2} />
                  <span>{tab.label}</span>
                  {tab.total !== undefined && (
                    <>
                      <span
                        aria-hidden="true"
                        data-count=""
                        className={`rounded-full px-1.5 py-0.5 text-[11px] leading-tight tabular-nums min-[360px]:px-2 ${
                          on ? 'bg-brass-400/15 text-brass-200' : 'bg-white/5 text-plush-300'}`}
                      >
                        {tab.done}/{tab.total}
                      </span>
                      <span className="sr-only"> ({tab.done} of {tab.total} unlocked)</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Focusable, because neither tab's content holds a control: without a
            tab stop a keyboard user could not scroll it. A plain element, so
            its focus may be an (inset) ring. On a short screen the panel is
            not capped, so this never overflows and the scrim scrolls instead. */}
        <div
          ref={bodyRef}
          role="region"
          aria-label={activeTab === 'stats' ? 'Statistics' : 'Achievements'}
          tabIndex={0}
          className="relative min-h-0 flex-1 overflow-y-auto border-t border-white/[0.06] px-4 pb-6 pt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brass-300/70 sm:px-6"
        >
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <Section title="Battle Statistics">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatTile icon={Gamepad2} label="Battles" value={totalBattles} />
                  <StatTile icon={Trophy} label="Victories" value={totalWins} tone="text-emerald-300" />
                  <StatTile icon={HeartCrack} label="Defeats" value={totalLosses} tone="text-red-300" />
                  <StatTile icon={TrendingUp} label="Win Rate" value={`${winRate}%`} tone="text-brass-300" bar={Number(winRate)} />
                </div>
              </Section>

              <Section title="Streaks">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatTile icon={Flame} label="Current" value={currentWinStreak} tone="text-orange-300" />
                  <StatTile icon={Star} label="Best Streak" value={bestWinStreak} tone="text-brass-300" />
                  <StatTile icon={CalendarDays} label="Login Streak" value={consecutiveLogins} tone="text-sky-300" />
                  <StatTile icon={LibraryBig} label={`Cards (${ALL_CARDS.length})`} value={ownedCards.length} tone="text-sky-300" />
                </div>
              </Section>

              <Section title="Combat Performance">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <StatTile icon={Bomb} label="Total Damage" value={totalDamageDealt.toLocaleString()} tone="text-red-300" />
                  <StatTile icon={HeartPulse} label="Total Healing" value={totalHealingDone.toLocaleString()} tone="text-emerald-300" />
                  <StatTile
                    icon={Sparkles}
                    label="Completion"
                    value={`${completion.toFixed(0)}%`}
                    tone="text-purple-300"
                    bar={completion}
                    className="col-span-2 md:col-span-1"
                  />
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'achievements' && (
            <ul className="space-y-2">
              {ACHIEVEMENTS.map((achievement, i) => {
                const isCompleted = completedAchievements.includes(achievement.id);
                return (
                  <motion.li
                    key={achievement.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
                    // Medal | text | reward from sm up; on a phone the reward
                    // drops under the text, which keeps the row's full width.
                    className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-xl p-3 ring-1 ring-inset sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4 sm:px-4 ${
                      isCompleted
                        ? 'bg-emerald-500/[0.07] ring-emerald-400/25'
                        : 'bg-white/[0.03] ring-white/[0.06]'
                    }`}
                  >
                    {/* Only the badge dims on a locked achievement — never the
                        row, which would take its text below AA with it. */}
                    <div
                      aria-hidden="true"
                      className="row-span-2 h-12 w-12 rounded-full p-[2px] sm:row-span-1"
                      style={{ background: isCompleted ? RARITY_METAL.legendary : 'rgba(255, 255, 255, 0.1)' }}
                    >
                      <div className="grid h-full w-full place-items-center rounded-full bg-night-900">
                        <span className={`text-2xl leading-none ${isCompleted ? '' : 'opacity-50 grayscale'}`}>{achievement.icon}</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-bold leading-tight text-plush-100">
                        {achievement.name}
                        {/* The tick and the lock are the only marks of
                            state, so each carries its word for a screen
                            reader. */}
                        {isCompleted ? (
                          <span className="ml-1.5 inline-grid h-4 w-4 place-items-center rounded-full bg-emerald-400 align-[-2px] text-night-950">
                            <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3.5} />
                            <span className="sr-only">Unlocked</span>
                          </span>
                        ) : (
                          <span className="ml-1.5 inline-block align-[-2px] text-plush-300">
                            <Lock aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
                            <span className="sr-only">Locked</span>
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-sm text-plush-300">{achievement.description}</div>
                    </div>
                    <div
                      className={`col-start-2 inline-flex items-center gap-1 justify-self-start rounded-full px-2.5 py-1 font-display text-sm font-extrabold tabular-nums ring-1 ring-inset sm:col-start-3 sm:row-start-1 sm:justify-self-end ${
                        isCompleted ? 'bg-brass-400/10 text-brass-300 ring-brass-300/30' : 'bg-white/[0.04] text-plush-300 ring-white/10'
                      }`}
                    >
                      +{achievement.reward}
                      <Coins aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
                      <span className="sr-only">coins</span>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PlayerStats;
