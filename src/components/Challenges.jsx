import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Clock, Check, Gift, Gem, Coins, Package, Star, Crown, CalendarDays, CalendarRange,
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { useGameStore } from '../stores/gameStore';
import { getDailyChallenges, getWeeklyChallenges, challengeProgress } from '../stores/challenges';
import { celebrate } from '@/lib/celebrate';
import { useDialog } from '@/hooks/useDialog';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';
import { Medallion, DialogClose } from '@/components/ui/game-chrome';
import { getTimeUntilReset } from '@/lib/resetTimer';

// Plain <button>s throughout, not the shadcn Button: its bg-primary is a
// utility and would beat the btn-brass / btn-glass materials. Every button
// takes FOCUS_OUTLINE. An unselected tab has no material for a ring to
// flatten, but it takes the outline too so the two tabs focus alike.

// What each reward type looks like. lucide icons rather than emoji: emoji are
// a different drawing on every platform.
//
// A legendary pack is a pack wearing a crown (the mark legendary carries
// across the game), not just a pack in another colour: the weekly set often
// puts the two side by side, and sky against brass is all a colour-blind
// player, or anyone who has not learned the code, would have had to go on.
//
// `one` and `many` are the reward's name in words, for the claim's
// announcement and every screen-reader label. The claim toast used to print
// the type key itself: "Claimed: 1 legendaryPack", "2 pack", "100 xp".
export const REWARD_LOOK = {
  coins: { Icon: Coins, tone: 'text-brass-300', one: 'coin', many: 'coins' },
  gems: { Icon: Gem, tone: 'text-fuchsia-300', one: 'gem', many: 'gems' },
  xp: { Icon: Star, tone: 'text-brass-300', one: 'XP', many: 'XP' },
  pack: { Icon: Package, tone: 'text-sky-300', one: 'Card Pack', many: 'Card Packs' },
  legendaryPack: { Icon: Package, Mark: Crown, tone: 'text-brass-300', one: 'Legendary Pack', many: 'Legendary Packs' },
};
const OTHER_REWARD = { Icon: Gift, tone: 'text-emerald-300', one: 'reward', many: 'rewards' };
const lookFor = (type) => REWARD_LOOK[type] ?? OTHER_REWARD;

/** "150 coins", "1 Card Pack", "100 XP": a reward in words. */
export const rewardLabel = (type, amount) => {
  const look = lookFor(type);
  return `${amount.toLocaleString()} ${amount === 1 ? look.one : look.many}`;
};

// The reward's mark: its icon, and the crown over a legendary pack.
const RewardMark = ({ look, size = 'h-4 w-4', markSize = 'h-3.5 w-3.5' }) => (
  <span aria-hidden="true" className="inline-flex items-center gap-0.5">
    {look.Mark && <look.Mark className={`${markSize} ${look.tone}`} strokeWidth={2.4} />}
    <look.Icon className={`${size} ${look.tone}`} strokeWidth={2.2} />
  </span>
);

// What a claim just paid, rising off the place it was claimed and fading:
// .fx-float, the battle board's floating number, which stops moving with the
// Animations switch and reduced motion (the caller takes it away after
// FLOAT_MS either way). Claims used to say so in a toast, and the toast landed
// on the dialog's own controls: on a phone over the Close button, on a
// desktop over the bonus Claim that the claim had just made ready.
// Decoration only; the dialog's status region says the same in words.
const FLOAT_MS = 1200;
//
// Right-aligned to its slot: .fx-float centres itself on its anchor, and both
// slots sit at the panel's right edge, where a centred "+25 gems +200 coins"
// ran out of the panel (which clips). So the anchor is a box exactly as wide
// as the float (an invisible copy sizes it), pinned to the slot's right edge;
// the float centred in it ends where the slot does. It starts from the slot's
// top edge, over the "Claimed" that replaces the button rather than on it.
const FloatText = ({ rewards }) => rewards.map(({ type, amount }) => (
  <span key={type} className="inline-flex items-center gap-1">
    +{amount.toLocaleString()}
    <RewardMark look={lookFor(type)} size="h-5 w-5" markSize="h-4 w-4" />
  </span>
));
const FLOAT_TYPE = 'inline-flex items-center gap-2.5 whitespace-nowrap font-display text-xl font-extrabold tabular-nums';
const ClaimFloat = ({ rewards }) => (
  <span aria-hidden="true" className="pointer-events-none absolute right-0 top-0 z-20">
    <span className={`invisible ${FLOAT_TYPE}`}><FloatText rewards={rewards} /></span>
    <span data-claim-float="" className={`fx-float absolute left-1/2 top-0 text-white ${FLOAT_TYPE}`}>
      <FloatText rewards={rewards} />
    </span>
  </span>
);

// The last claim's float: where it rises from (a challenge's id, or a bonus's
// key) and what it shows, gone after FLOAT_MS. Each claim gets a fresh id, so
// a second claim replays the float rather than extending the first.
const useClaimFloat = () => {
  const [float, setFloat] = useState(null);
  useEffect(() => {
    if (!float) return undefined;
    const t = setTimeout(() => setFloat(null), FLOAT_MS);
    return () => clearTimeout(t);
  }, [float]);
  const show = (at, rewards) => setFloat((prev) => ({ id: (prev?.id ?? 0) + 1, at, rewards }));
  return [float, show];
};

const RewardChip = ({ type, amount, className = '' }) => {
  const look = lookFor(type);
  return (
    <span className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-night-950/60 px-2 font-display text-sm font-bold
      tabular-nums text-white ring-1 ring-inset ring-white/10 ${className}`}
    >
      <RewardMark look={look} />
      {amount}
      <span className="sr-only"> {amount === 1 ? look.one : look.many}</span>
    </span>
  );
};

// Hoisted to module scope so it keeps a stable component identity across
// renders. Declared inside Challenges, it got a fresh type every render — and
// the 60s syncPeriods/countdown tick re-renders the panel once a minute, so
// every card visibly re-ran its entrance animation and any focused Claim button
// lost focus each minute. Reads nothing from the closure now; the parent passes
// the derived progress/claimed state and the claim handler.
//
// Three looks: in progress (smoked glass), finished and waiting (brass trim, a
// warm glow, the Claim button), and claimed (sunk into the panel, a quiet tick).
//
// The title and the reward share the first row and the description runs
// under both, so a long name has the most room it can get on a phone. The bar
// row sits under the text from sm up and spans the whole card below that,
// where indenting it past the icon left a bar barely wider than its label.
//
// Claiming unmounts the Claim button, and focus went with it to <body>; the
// next Tab then sent useDialog back to the dialog's first control. So when the
// button had focus, the "Claimed" that replaces it takes it (tabIndex -1,
// never a tab stop), and Tab carries on from there to the next card.
//
// `float` is what the card has just paid out, if anything (see ClaimFloat).
const ChallengeCard = ({ challenge, progress, isClaimed, onClaim, float }) => {
  const isComplete = progress >= challenge.target;
  const progressPercent = Math.min((progress / challenge.target) * 100, 100);
  const isReady = isComplete && !isClaimed;
  const claimedRef = useRef(null);
  const refocus = useRef(false);
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    if (isClaimed) claimedRef.current?.focus({ preventScroll: true });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl p-3.5 sm:p-4 ${
        isClaimed
          ? 'bg-black/20 ring-1 ring-inset ring-white/5'
          : isReady
            ? 'panel-glass trim-brass shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_28px_-10px_rgba(251,191,36,0.6)]'
            : 'panel-glass'
      }`}
    >
      {isReady && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(ellipse_45%_90%_at_0%_0%,rgba(251,191,36,0.14),transparent_70%)]"
        />
      )}

      <div className="relative flex items-start gap-3 sm:gap-4">
        {/* The challenge's own emoji is content, so it stays; only the tile
            behind it is chrome. */}
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl sm:h-12 sm:w-12 ${
            isClaimed
              ? 'bg-black/25 ring-1 ring-inset ring-white/5'
              : isReady
                ? 'bg-brass-400/15 ring-1 ring-inset ring-brass-300/40'
                : 'bg-night-950/50 ring-1 ring-inset ring-white/10'
          }`}
        >
          <span className={isClaimed ? 'opacity-50 grayscale' : ''}>{challenge.icon}</span>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
          <h3 className={`font-display font-bold leading-tight ${isClaimed ? 'text-plush-200' : isReady ? 'text-brass-200' : 'text-white'}`}>
            {challenge.name}
          </h3>
          <RewardChip type={challenge.reward.type} amount={challenge.reward.amount} className="-mt-0.5" />
          <p className="col-span-2 mt-0.5 text-sm leading-snug text-plush-300">{challenge.description}</p>
        </div>
      </div>

      <div className="relative mt-3 flex min-h-8 items-center gap-3 sm:pl-16">
        <Progress
          value={progressPercent}
          className={`h-2 flex-1 bg-night-950/70 ring-1 ring-inset ring-white/[0.08] ${
            isClaimed
              ? '[&>div]:bg-plush-400/50'
              : '[&>div]:bg-gradient-to-r [&>div]:from-brass-200 [&>div]:to-brass-500'
          }`}
          aria-label={`${challenge.name} progress: ${progress} of ${challenge.target}`}
        />
        {/* One fixed-width status slot, so every bar in the list ends at
            the same x whatever sits beside it. */}
        <div className="relative flex w-[4.75rem] shrink-0 justify-end">
          {float && <ClaimFloat key={float.id} rewards={float.rewards} />}
          {isReady && (
            <button
              type="button"
              onClick={(e) => {
                refocus.current = e.currentTarget === document.activeElement;
                onClaim();
              }}
              className={`btn-brass h-8 rounded-lg px-4 font-display text-sm font-bold ${FOCUS_OUTLINE}`}
            >
              Claim
            </button>
          )}
          {isClaimed && (
            <span
              ref={claimedRef}
              tabIndex={-1}
              className={`inline-flex items-center gap-1 rounded text-xs font-semibold text-plush-300 ${FOCUS_OUTLINE}`}
            >
              <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" strokeWidth={3} />
              Claimed
            </span>
          )}
          {!isComplete && !isClaimed && (
            <span className="whitespace-nowrap font-display text-sm font-bold tabular-nums text-plush-100">
              {progress}<span className="text-plush-300"> / {challenge.target}</span>
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// A segmented control recessed into the panel, the same as the Shop's tabs.
// aria-pressed rather than role=tab: these are plain buttons, and the tab role
// would also need tablist/tabpanel wiring and arrow-key handling.
//
// Not the shared .seg-well / .seg-on / .seg-off: this is the Shop's tab look
// (a bordered, darker well; the selected key brass-edged, with no lip), and
// moving to the shared one changes how the tabs look, not just where the
// classes come from.
const TabButton = ({ active, onClick, icon: Icon, label, done, total }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2.5 font-display text-[15px] font-bold leading-tight
      transition-colors ${FOCUS_OUTLINE}
      ${active ? 'btn-glass border-brass-300/40 text-brass-200' : 'border border-transparent text-plush-300 hover:text-white'}`}
  >
    <Icon aria-hidden="true" className={`hidden h-4 w-4 shrink-0 min-[360px]:block ${active ? 'text-brass-300' : ''}`} strokeWidth={2.2} />
    {label}
    <span className={`rounded-full px-2 py-0.5 text-[11px] leading-tight tabular-nums ${
      active ? 'bg-brass-400/15 text-brass-200' : 'bg-white/5 text-plush-300'}`}
    >
      {done}/{total}
    </span>
  </button>
);

const Challenges = ({ onClose }) => {
  const {
    addCoins, addGems, addXP, addCardPack, claimChallenge, claimedChallenges, syncPeriods,
    // Daily stats (auto-reset each day)
    todayWins, todayBattles, todayDamageDealt, todayCardsPlayed,
    // Weekly stats (auto-reset each Monday)
    weekWins, weekCoinsEarned, weekBestStreak, weekNewCards,
  } = useGameStore();
  const [activeTab, setActiveTab] = useState('daily');
  // What the last claim paid: the float over the spot it was claimed from,
  // and the same in words for the status region.
  const [float, showFloat] = useClaimFloat();
  const [announcement, setAnnouncement] = useState('');
  const [dailyResetTime, setDailyResetTime] = useState(getTimeUntilReset(false));
  const [weeklyResetTime, setWeeklyResetTime] = useState(getTimeUntilReset(true));
  const dialogRef = useDialog(onClose);
  // The bonus's Claim is swapped for a "Claimed" badge the same way a card's
  // is, and its focus is kept the same way (see ChallengeCard).
  // The ref is only attached while the badge is drawn, so a claim that did
  // not land leaves nothing to focus.
  const bonusClaimedRef = useRef(null);
  const bonusRefocus = useRef(false);
  useLayoutEffect(() => {
    if (!bonusRefocus.current) return;
    bonusRefocus.current = false;
    bonusClaimedRef.current?.focus({ preventScroll: true });
  });

  // The visible set rotates deterministically by calendar date (see
  // src/stores/challenges.js) — same 4 all day/week, different set on the
  // next day/week. Recomputed every render (cheap: a shuffle over ~12 items)
  // so a dialog left open across midnight/Monday picks up the new set
  // without a remount.
  const DAILY_CHALLENGES = getDailyChallenges();
  const WEEKLY_CHALLENGES = getWeeklyChallenges();

  // Roll over daily/weekly stats and the claimed ledger if the calendar has
  // advanced, so the panel never shows stale challenges.
  //
  // This must keep firing, not run once on mount: the visible challenge SET is
  // recomputed every render and rotates at midnight/Monday, but the STATS
  // (todayWins etc.) only roll over when syncPeriods runs. A dialog left open
  // across midnight would otherwise show tomorrow's challenges scored against
  // today's progress — e.g. yesterday's 3 wins auto-completing today's
  // "win 3 games". Re-syncing on the same 60s tick as the reset countdown
  // keeps the set and the stats on the same calendar day (syncPeriods
  // early-returns when the date is unchanged, so the extra calls are free).
  useEffect(() => {
    syncPeriods();
    const timer = setInterval(() => {
      syncPeriods();
      setDailyResetTime(getTimeUntilReset(false));
      setWeeklyResetTime(getTimeUntilReset(true));
    }, 60000);
    return () => clearInterval(timer);
  }, [syncPeriods]);

  // Single source of truth for stat -> progress; MainMenu's claimable badge
  // reads the same helper, so the two can't disagree about what's finished.
  const challengeStats = {
    todayWins, todayBattles, todayDamageDealt, todayCardsPlayed,
    weekWins, weekBestStreak, weekNewCards, weekCoinsEarned,
  };
  const getChallengeProgress = (challenge) => challengeProgress(challenge, challengeStats);

  const claimReward = (challenge) => {
    const progress = getChallengeProgress(challenge);
    if (progress < challenge.target) return;

    // Claim first — claimChallenge is atomic and idempotent in the store, so a
    // double-click (or any re-entry) can't grant the reward twice.
    if (!claimChallenge(challenge.id)) return;

    switch (challenge.reward.type) {
      case 'coins':         addCoins(challenge.reward.amount); break;
      case 'gems':          addGems(challenge.reward.amount); break;
      case 'xp':            addXP(challenge.reward.amount); break;
      case 'legendaryPack': addCardPack(challenge.reward.amount, 'legendary'); break;
      case 'pack':          addCardPack(challenge.reward.amount); break;
    }

    celebrate({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
    showFloat(challenge.id, [challenge.reward]);
    setAnnouncement(`${challenge.name} claimed: ${rewardLabel(challenge.reward.type, challenge.reward.amount)}.`);
  };

  const dailyComplete = DAILY_CHALLENGES.filter(c => getChallengeProgress(c) >= c.target).length;
  const weeklyComplete = WEEKLY_CHALLENGES.filter(c => getChallengeProgress(c) >= c.target).length;

  // Bonus for clearing every challenge in a tab. Uses the same claim ledger as
  // individual challenges (ids 'd'/'w'-prefixed so they reset on rollover too).
  const BONUS = {
    daily:  { key: 'd_all_bonus', gems: 25,  coins: 200,  allDone: dailyComplete === DAILY_CHALLENGES.length },
    weekly: { key: 'w_all_bonus', gems: 100, coins: 1000, allDone: weeklyComplete === WEEKLY_CHALLENGES.length },
  };

  const claimBonus = (tab) => {
    const bonus = BONUS[tab];
    if (!bonus.allDone) return;
    // Claim first — atomic and idempotent, so a double-click can't double-grant.
    if (!claimChallenge(bonus.key)) return;
    addGems(bonus.gems);
    addCoins(bonus.coins);
    celebrate({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#fbbf24', '#a855f7', '#34d399'] });
    showFloat(bonus.key, [{ type: 'gems', amount: bonus.gems }, { type: 'coins', amount: bonus.coins }]);
    setAnnouncement(`Bonus claimed: ${rewardLabel('gems', bonus.gems)} and ${rewardLabel('coins', bonus.coins)}.`);
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Challenges"
      // Two frames, by viewport height. Normally the panel is capped to the
      // screen and only the list scrolls, so the tabs and the bonus stay put.
      // But that chrome is ~280px that cannot shrink, and on a short screen
      // (a landscape phone, a laptop at 200% zoom) it left the list a slit of
      // 13-70px — less than half a card — and at 400% zoom the bonus Claim
      // fell off the bottom of the panel. Below 500px tall the cap comes off,
      // the list stops scrolling on its own and the whole dialog scrolls in
      // the scrim instead. Either way the panel is centred by my-auto, not
      // items-center: a centred flex item taller than its box overflows at
      // both ends, out of reach.
      className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl dialog-panel
          sm:max-h-[calc(100dvh-3rem)] [@media(max-height:500px)]:!max-h-none"
      >
        {/* Amber light over the header, the same as the Shop's. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(ellipse_55%_100%_at_0%_0%,rgba(251,191,36,0.14),transparent_70%)]"
        />

        {/* Header */}
        <div className="relative flex items-center gap-3 px-4 pt-4 pb-4 sm:px-6 sm:pt-5">
          <Medallion icon={Target} />
          <h2 className="min-w-0 flex-1 whitespace-nowrap font-display text-3xl font-extrabold leading-none text-brass-gradient">
            Challenges
          </h2>
          <DialogClose label="Close challenges" onClick={onClose} />
        </div>

        {/* Tabs: a segmented control recessed into the panel. */}
        <div className="relative px-4 sm:px-6">
          <div className="flex gap-1 rounded-xl border border-white/5 bg-night-950/70 p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
            <TabButton
              active={activeTab === 'daily'}
              onClick={() => setActiveTab('daily')}
              icon={CalendarDays}
              label="Daily"
              done={dailyComplete}
              total={DAILY_CHALLENGES.length}
            />
            <TabButton
              active={activeTab === 'weekly'}
              onClick={() => setActiveTab('weekly')}
              icon={CalendarRange}
              label="Weekly"
              done={weeklyComplete}
              total={WEEKLY_CHALLENGES.length}
            />
          </div>
        </div>

        {/* Reset Timer */}
        <div className="relative flex items-center gap-3 px-4 pt-4 pb-1 sm:px-6">
          <span className="label-caps shrink-0 text-plush-300">
            {activeTab === 'daily' ? 'Daily' : 'Weekly'} Reset In
          </span>
          <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          <span className="inline-flex shrink-0 items-center gap-1.5 font-display text-sm font-bold tabular-nums text-brass-200">
            <Clock aria-hidden="true" className="h-3.5 w-3.5 text-brass-300" strokeWidth={2.4} />
            {activeTab === 'daily' ? dailyResetTime : weeklyResetTime}
          </span>
        </div>

        {/* Content */}
        <div
          role="region"
          aria-label={`${activeTab === 'daily' ? 'Daily' : 'Weekly'} challenges`}
          tabIndex={0}
          className="relative flex-1 overflow-y-auto px-4 pt-2 pb-4 sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brass-300
            [@media(max-height:500px)]:flex-none [@media(max-height:500px)]:overflow-visible"
        >
          <AnimatePresence mode="wait">
            {activeTab === 'daily' && (
              <motion.div key="daily" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {DAILY_CHALLENGES.map((challenge) => (
                  <div key={challenge.id}>
                    <ChallengeCard
                      challenge={challenge}
                      progress={getChallengeProgress(challenge)}
                      isClaimed={(claimedChallenges ?? []).includes(challenge.id)}
                      onClaim={() => claimReward(challenge)}
                      float={float?.at === challenge.id ? float : null}
                    />
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'weekly' && (
              <motion.div key="weekly" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {WEEKLY_CHALLENGES.map((challenge) => (
                  <div key={challenge.id}>
                    <ChallengeCard
                      challenge={challenge}
                      progress={getChallengeProgress(challenge)}
                      isClaimed={(claimedChallenges ?? []).includes(challenge.id)}
                      onClaim={() => claimReward(challenge)}
                      float={float?.at === challenge.id ? float : null}
                    />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bonus Progress: the panel's foot, a darker shelf under the list. */}
        <div className="relative border-t border-white/10 bg-night-950/45 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="font-display text-[15px] font-bold leading-tight text-white sm:text-base">
                Complete All {activeTab === 'daily' ? 'Daily' : 'Weekly'} Challenges
              </div>
              <div className="mt-0.5 text-xs leading-snug text-plush-300 sm:text-sm">Bonus reward for completing all challenges</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <RewardChip type="gems" amount={BONUS[activeTab].gems} />
                <RewardChip type="coins" amount={BONUS[activeTab].coins} />
              </div>
            </div>
            <div className="relative shrink-0">
            {float?.at === BONUS[activeTab].key && <ClaimFloat key={float.id} rewards={float.rewards} />}
            {(claimedChallenges ?? []).includes(BONUS[activeTab].key) ? (
              <div
                ref={bonusClaimedRef}
                tabIndex={-1}
                className={`inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-black/25 px-3 ring-1 ring-inset ring-white/10 ${FOCUS_OUTLINE}`}
              >
                <Check aria-hidden="true" className="h-5 w-5 text-emerald-300" strokeWidth={2.6} />
                <span className="text-xs font-semibold text-plush-300">
                  Claimed<span className="sr-only"> bonus</span>
                </span>
              </div>
            ) : (
              <div className="relative shrink-0">
                {/* Ready: a glow breathes behind the button (opacity only, on
                    the compositor) rather than the button itself pulsing, which
                    would fade its own label in and out. */}
                {BONUS[activeTab].allDone && (
                  <span aria-hidden="true" className="absolute -inset-1 rounded-2xl bg-brass-300/40 blur-md motion-safe:animate-pulse" />
                )}
                {/* Not ready: the gift sits locked in a dim glass key. The
                    button is disabled, so nothing it says has to be read —
                    the tab's count already says how far there is to go. */}
                <button
                  type="button"
                  onClick={(e) => {
                    bonusRefocus.current = e.currentTarget === document.activeElement;
                    claimBonus(activeTab);
                  }}
                  disabled={!BONUS[activeTab].allDone}
                  className={`relative inline-flex h-12 items-center justify-center gap-2 rounded-xl font-display font-bold ${FOCUS_OUTLINE} ${
                    BONUS[activeTab].allDone
                      ? 'btn-brass px-4'
                      : 'btn-glass w-12 cursor-not-allowed text-plush-400 opacity-60'
                  }`}
                  aria-label="Claim all-challenges bonus"
                >
                  <Gift aria-hidden="true" className="h-5 w-5" strokeWidth={2.2} />
                  {BONUS[activeTab].allDone && <span>Claim</span>}
                </button>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* What a claim paid, in words. Mounted empty with the dialog, so a
            screen reader hears each claim as it lands; the float is
            decoration. This was the claim toast's job, and the toast is gone. */}
        <div role="status" className="sr-only">{announcement}</div>
      </motion.div>
    </div>
  );
};

export default Challenges;
