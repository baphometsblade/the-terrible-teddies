import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Coins, Gem, Package, GalleryVerticalEnd, Check, Flame, Sparkles, X } from 'lucide-react';
import { useGameStore, DAILY_REWARDS } from '../stores/gameStore';
import { celebrate } from '@/lib/celebrate';
import { useDialog } from '@/hooks/useDialog';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { Medallion } from '@/components/ui/game-chrome';

// The four things a day can hand out, in display order. lucide icons rather
// than emoji (a different drawing on every platform); the noun is for screen
// readers, since the icon carries the meaning visually.
const PRIZES = [
  { key: 'coins', Icon: Coins, tone: 'text-brass-300', noun: 'coins', format: (n) => n },
  { key: 'gems', Icon: Gem, tone: 'text-fuchsia-300', noun: 'gems', format: (n) => n },
  { key: 'cards', Icon: GalleryVerticalEnd, tone: 'text-emerald-300', noun: 'cards', format: (n) => `x${n}` },
  { key: 'packs', Icon: Package, tone: 'text-sky-300', noun: 'card packs', format: (n) => `x${n}` },
];

// Hoisted to module scope for a stable component identity: declared inside
// DailyRewards it was a fresh type on every render, so the claim landing
// (which re-renders the panel) remounted all seven days and replayed their
// entrance.
//
// Today is lit brass; past days sink into the panel with a quiet tick at the
// foot (an overlay used to sit on top of their numbers); the days ahead are
// smoked glass. Day 7, the big one, is two columns wide.
const RewardDay = ({ day, isToday, isClaimed, coins, gems, cards, packs }) => {
  const amounts = { coins, gems, cards, packs };
  const wide = day === DAILY_REWARDS.length;
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: day * 0.1 }}
      className={`relative flex flex-col items-center rounded-xl px-2 pt-2.5 pb-3 text-center ${wide ? 'col-span-2' : ''} ${
        isToday
          ? 'bg-gradient-to-b from-brass-200 via-brass-300 to-brass-500 text-night-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-2px_0_rgba(124,45,18,0.4),0_10px_28px_-8px_rgba(251,191,36,0.8)]'
          : isClaimed
            ? 'bg-black/25 ring-1 ring-inset ring-white/5'
            : 'panel-glass'
      }`}
    >
      <div className={`label-caps whitespace-nowrap ${isToday ? 'text-night-950' : 'text-plush-300'}`}>Day {day}</div>
      <div className={`mt-2 flex ${wide ? 'flex-wrap justify-center gap-x-3 gap-y-1' : 'flex-col gap-1'}`}>
        {PRIZES.filter((p) => amounts[p.key] > 0).map(({ key, Icon, tone, noun, format }) => (
          <div key={key} className="flex items-center justify-center gap-1 font-display text-sm font-bold leading-tight tabular-nums">
            <Icon
              aria-hidden="true"
              className={`h-3.5 w-3.5 shrink-0 ${isToday ? 'text-night-950' : isClaimed ? 'text-plush-400' : tone}`}
              strokeWidth={2.4}
            />
            <span className={isToday ? 'text-night-950' : isClaimed ? 'text-plush-300' : 'text-white'}>
              {format(amounts[key])}
            </span>
            <span className="sr-only"> {noun}</span>
          </div>
        ))}
      </div>
      {isClaimed && (
        <div className="mt-auto pt-2">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-400/10 ring-1 ring-emerald-300/25">
            <Check aria-hidden="true" className="h-3 w-3 text-emerald-300" strokeWidth={3.5} />
            <span className="sr-only">Claimed</span>
          </span>
        </div>
      )}
      {/* Today is lit brass, and says so in words too: the colour alone told
          a screen reader nothing about which day this is. */}
      {isToday && (
        <div className="mt-auto pt-2">
          <span className="inline-flex h-5 items-center rounded-full bg-night-950/85 px-2 text-[9px] font-bold uppercase leading-none tracking-[0.16em] text-brass-200">
            Today
          </span>
        </div>
      )}
    </motion.div>
  );
};

const DailyRewards = ({ onClose }) => {
  const { checkDailyLogin, consecutiveLogins } = useGameStore();
  const [reward, setReward] = useState(null);
  const [claimed, setClaimed] = useState(false);
  const dialogRef = useDialog(onClose);

  // checkDailyLogin() records the login as a side effect, so it must run exactly
  // once per mount — StrictMode's double-invoke would otherwise call it twice and
  // the second (now-already-claimed) call flips the panel to "Already Claimed".
  const didRunRef = useRef(false);
  useEffect(() => {
    if (didRunRef.current) return undefined;
    didRunRef.current = true;
    const dailyReward = checkDailyLogin();
    if (!dailyReward) {
      setClaimed(true);
      return undefined;
    }
    setReward(dailyReward);
    // Cleared on unmount so a quick close doesn't burst confetti over the next screen.
    const t = setTimeout(() => {
      celebrate({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }, 500);
    return () => clearTimeout(t);
  }, [checkDailyLogin]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Daily Rewards"
      // Scrolls, with the panel centred by my-auto rather than items-center: a
      // centred flex item taller than its box overflows at both ends, and on a
      // short phone that put Continue out of reach.
      className="fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto p-3 sm:p-6"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative my-auto w-full max-w-2xl overflow-hidden rounded-2xl dialog-panel trim-brass"
      >
        {/* The light the medallion sits in. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(251,191,36,0.28),transparent_70%)]"
        />

        <div className="relative px-5 pt-7 text-center sm:px-6">
          {/* flex: block-level, so mx-auto centres it on a line of its own
              (Medallion is inline-block). The icon is passed as children only
              to keep its lighter 1.75 stroke. */}
          <Medallion size="lg" className="mx-auto flex">
            <Gift className="h-7 w-7 text-brass-300" strokeWidth={1.75} />
          </Medallion>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-brass-gradient sm:text-4xl">
            Daily Rewards
          </h2>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-sm font-semibold text-plush-100 ring-1 ring-white/10">
            <Flame aria-hidden="true" className="h-4 w-4 text-orange-300" strokeWidth={2.2} />
            Login streak: {consecutiveLogins} day{consecutiveLogins !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="relative px-5 pt-6 sm:px-6">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {DAILY_REWARDS.map((dayReward, index) => {
              const day = index + 1;
              // Today's position in the 1..7 cycle. On a fresh claim we read it
              // from the reward; on a same-day reopen (reward === null) we derive
              // it from the persisted streak. The old code fell back to a blanket
              // `claimed` flag, which marked ALL seven days — future days included
              // — as claimed on every reopen, wiping the streak-progress view.
              const cycleDay = consecutiveLogins > 0 ? ((consecutiveLogins - 1) % 7) + 1 : 1;
              const currentDay = reward ? reward.day : cycleDay;
              const isToday = day === currentDay;
              const isClaimed = day < currentDay; // today is always the highlighted tile, not a claimed one
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
                className="mt-5 rounded-xl bg-black/25 px-4 py-5 text-center ring-1 ring-white/5"
              >
                {/* Sized down on narrow phones so it stays one line inside
                    the box at 320px; wrapped, it left the sparkle stranded
                    beside a two-line block. */}
                <h3 className="inline-flex items-center gap-2 whitespace-nowrap font-display text-base font-extrabold text-white min-[360px]:text-lg sm:text-xl">
                  <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-brass-300 sm:h-5 sm:w-5" strokeWidth={2.2} />
                  Today&apos;s Reward Claimed!
                </h3>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {PRIZES.filter((p) => reward[p.key] > 0).map(({ key, Icon, tone, noun }, i) => (
                    <motion.div
                      key={key}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.15 }}
                      className="panel-glass flex items-center gap-2 rounded-xl px-4 py-2.5"
                    >
                      <Icon aria-hidden="true" className={`h-5 w-5 ${tone}`} strokeWidth={2.2} />
                      <span className="font-display text-lg font-extrabold tabular-nums text-white">+{reward[key]}</span>
                      <span className="sr-only"> {noun}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {claimed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-5 rounded-xl bg-black/25 px-4 py-6 text-center ring-1 ring-white/5"
              >
                <div aria-hidden="true" className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-400/10 ring-1 ring-emerald-300/30">
                  <Check className="h-6 w-6 text-emerald-300" strokeWidth={2.6} />
                </div>
                <h3 className="mt-3 font-display text-xl font-extrabold text-white">Already Claimed Today!</h3>
                <p className="mt-1 text-plush-300">Come back tomorrow!</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* A plain button: the shadcn Button's bg-primary is a utility and
            would beat the brass material. */}
        <div className="relative px-5 pt-5 pb-6 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className={`btn-brass h-12 w-full rounded-xl font-display text-lg font-bold ${FOCUS_OUTLINE}`}
          >
            Continue
          </button>
        </div>

        {/* The header's close control, as on every other dialog. Last in the
            DOM on purpose: useDialog focuses the first control on open, and
            that stays Continue — the one thing this dialog asks you to do —
            exactly as before the close button existed. */}
        <button
          type="button"
          onClick={onClose}
          className={`btn-glass absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-xl sm:right-4 sm:top-4 ${FOCUS_OUTLINE}`}
          aria-label="Close daily rewards"
        >
          <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
        </button>
      </motion.div>
    </div>
  );
};

export default DailyRewards;
