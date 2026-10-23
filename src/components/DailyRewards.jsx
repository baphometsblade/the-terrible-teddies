import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Coins, Gem, Package, GalleryVerticalEnd, Check, Flame, Sparkles, X, Clock } from 'lucide-react';
import { useGameStore, DAILY_REWARDS, ALL_CARDS, dailyClaimDay } from '../stores/gameStore';
import { celebrate } from '@/lib/celebrate';
import { useDialog } from '@/hooks/useDialog';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';
import { Medallion } from '@/components/ui/game-chrome';
import { getTimeUntilReset } from '@/lib/resetTimer';

// The pack opening's own card reveal, loaded only when a claim draws cards.
// Its module is the whole Card Packs dialog (with the shop and the Battle Pass
// table it reads, about 58 kB more), and four days in seven draw no card, so
// a static import made every opening of this panel, which most players get on
// their first launch of the day, download all of it. A card day fetches it
// ahead of the tap (see the prefetch below).
const loadRevealCard = () => import('./CardPackOpening');
const RevealCard = lazy(() => loadRevealCard().then((m) => ({ default: m.RevealCard })));

// The four things a day can hand out, in display order. lucide icons rather
// than emoji (a different drawing on every platform); the nouns are for
// screen readers and the claim's announcement, since the icon carries the
// meaning visually.
const PRIZES = [
  { key: 'coins', Icon: Coins, tone: 'text-brass-300', one: 'coin', many: 'coins', format: (n) => n },
  { key: 'gems', Icon: Gem, tone: 'text-fuchsia-300', one: 'gem', many: 'gems', format: (n) => n },
  { key: 'cards', Icon: GalleryVerticalEnd, tone: 'text-emerald-300', one: 'card', many: 'cards', format: (n) => `x${n}` },
  { key: 'packs', Icon: Package, tone: 'text-sky-300', one: 'card pack', many: 'card packs', format: (n) => `x${n}` },
];
const noun = (prize, n) => `${n} ${n === 1 ? prize.one : prize.many}`;

// "75 coins and 1 card", for the claim's announcement.
const inWords = (reward) => {
  const parts = PRIZES.filter((p) => reward[p.key] > 0).map((p) => noun(p, reward[p.key]));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0] ?? '';
};

// The card reveal honours the Animations switch and the OS preference, as the
// pack opening's does: with either, the cards are simply there, face up.
const reducedMotion = () => !useGameStore.getState().animationsEnabled
  || (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// When the granted cards are dealt and turned, after the chips have landed.
const DEAL_MS = 600;
const TURN_MS = 1100;
const TURN_STAGGER_MS = 300;

// How long Continue holds still after the claim: until the chips have landed
// or, on a card day, until the last card has turned over. Claim and Continue
// are one button (so focus stays on it), and the second tap of a quick double
// tap on Claim used to land on Continue and close the panel before the
// payout, or the card it drew, had been seen. With motion off it is all there
// at once, and only the double tap needs absorbing.
const holdFor = (cardCount) => {
  if (reducedMotion()) return 400;
  return cardCount > 0 ? TURN_MS + (cardCount - 1) * TURN_STAGGER_MS + 400 : 800;
};

// Hoisted to module scope for a stable component identity: declared inside
// DailyRewards it was a fresh type on every render, so the claim landing
// (which re-renders the panel) remounted all seven days and replayed their
// entrance.
//
// `look` is one of:
//   past      sunk into the panel, a quiet tick at the foot
//   today     lit brass with a "Today" chip: waiting to be claimed
//   stamped   lit brass with a solid tick: today's, claimed. It used to keep
//             the Today chip, so a claimed day looked exactly like one still
//             waiting.
//   tomorrow  smoked glass, marked as the next one
//   ahead     smoked glass
// Day 7, the big one, is two columns wide. `justStamped` plays the stamp
// landing, the moment of the claim; on a reopen it is simply there.
const RewardDay = ({ day, look, justStamped, coins, gems, cards, packs }) => {
  const amounts = { coins, gems, cards, packs };
  const wide = day === DAILY_REWARDS.length;
  const lit = look === 'today' || look === 'stamped';
  const past = look === 'past';
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: day * 0.1 }}
      data-day={day}
      data-look={look}
      className={`relative flex flex-col items-center rounded-xl px-2 pt-2.5 pb-3 text-center ${wide ? 'col-span-2' : ''} ${
        lit
          ? 'bg-gradient-to-b from-brass-200 via-brass-300 to-brass-500 text-night-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-2px_0_rgba(124,45,18,0.4),0_10px_28px_-8px_rgba(251,191,36,0.8)]'
          : past
            ? 'bg-black/25 ring-1 ring-inset ring-white/5'
            : 'panel-glass'
      }`}
    >
      <div className={`label-caps whitespace-nowrap ${lit ? 'text-night-950' : 'text-plush-300'}`}>Day {day}</div>
      <div className={`mt-2 flex ${wide ? 'flex-wrap justify-center gap-x-3 gap-y-1' : 'flex-col gap-1'}`}>
        {PRIZES.filter((p) => amounts[p.key] > 0).map((p) => (
          <div key={p.key} className="flex items-center justify-center gap-1 font-display text-sm font-bold leading-tight tabular-nums">
            <p.Icon
              aria-hidden="true"
              className={`h-3.5 w-3.5 shrink-0 ${lit ? 'text-night-950' : past ? 'text-plush-400' : p.tone}`}
              strokeWidth={2.4}
            />
            <span className={lit ? 'text-night-950' : past ? 'text-plush-300' : 'text-white'}>
              {p.format(amounts[p.key])}
            </span>
            <span className="sr-only"> {amounts[p.key] === 1 ? p.one : p.many}</span>
          </div>
        ))}
      </div>
      {past && (
        <div className="mt-auto pt-2">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-400/10 ring-1 ring-emerald-300/25">
            <Check aria-hidden="true" className="h-3 w-3 text-emerald-300" strokeWidth={3.5} />
            <span className="sr-only">Claimed</span>
          </span>
        </div>
      )}
      {/* Today is lit brass, and says so in words too: the colour alone told
          a screen reader nothing about which day this is. */}
      {look === 'today' && (
        <div className="mt-auto pt-2">
          <span className="inline-flex h-5 items-center rounded-full bg-night-950/85 px-2 text-[9px] font-bold uppercase leading-none tracking-[0.16em] text-brass-200">
            Today
          </span>
        </div>
      )}
      {/* The stamp: a solid tick struck onto the brass. Framer Motion owns
          its transform (the spring as it lands), so nothing else here sets
          one; with motion off it is simply there. */}
      {look === 'stamped' && (
        <div className="mt-auto pt-2">
          <motion.span
            data-stamp=""
            initial={justStamped ? { scale: 0, rotate: -35, opacity: 0 } : false}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 15 }}
            className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400 text-night-950 ring-2 ring-night-950/80 shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          >
            <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3.5} />
            <span className="sr-only">Claimed today</span>
          </motion.span>
        </div>
      )}
      {/* The next day's chip, in Today's lettering on the glass. "Next",
          because "Tomorrow" was wider than a day's tile wherever the tiles
          are narrowest (320, and the eight-across row at 640), and it pairs
          with the "Next reward in" countdown under the row. */}
      {look === 'tomorrow' && (
        <div className="mt-auto pt-2">
          <span className="inline-flex h-5 items-center rounded-full bg-white/[0.06] px-1.5 text-[9px] font-bold uppercase leading-none tracking-[0.16em] text-plush-200 ring-1 ring-inset ring-white/10">
            Next<span className="sr-only"> reward, tomorrow</span>
          </span>
        </div>
      )}
    </motion.div>
  );
};

// A card the day handed over, dealt face down and turned, with the NEW badge
// and its tier's light: the pack opening's own RevealCard. It stands in the
// row of prizes in place of a "+1 cards" chip, which said a card had arrived
// and never which. Its place is held from the moment of the claim (the same
// box, empty) so the deal does not grow the panel a second time. Zoomed, not
// scaled, below sm, so it takes the room it appears to.
// RevealCard's box: the card and its rarity caption under it.
const CARD_SLOT = <div className="h-[162px] w-24" />;
const GrantedCard = ({ card, index, dealt, turned, settled }) => (
  <div data-granted-card={dealt ? card.id : undefined} className="[zoom:0.7] min-[360px]:[zoom:0.85] sm:[zoom:1]">
    {dealt ? (
      <Suspense fallback={CARD_SLOT}>
        <RevealCard
          card={card}
          index={index}
          order={0}
          revealed={turned}
          charging={false}
          ready={false}
          settled={settled}
          onTurn={() => {}}
        />
      </Suspense>
    ) : CARD_SLOT}
  </div>
);

const NextReward = ({ now }) => (
  <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-plush-300">
    <Clock aria-hidden="true" className="h-3.5 w-3.5 text-brass-300" strokeWidth={2.4} />
    Next reward in <span className="font-display font-bold tabular-nums text-brass-200">{getTimeUntilReset(false, now)}</span>
  </p>
);

const DailyRewards = ({ onClose }) => {
  const { checkDailyLogin, consecutiveLogins, lastLoginDate } = useGameStore();
  // What the tap just paid, if it has happened in this opening.
  const [reward, setReward] = useState(null);
  // The clock the panel reads: the countdown, and whether today has been
  // claimed. Ticked each half-minute, so a panel left open across midnight
  // turns back into a claim.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const dialogRef = useDialog(onClose);

  const claimedToday = lastLoginDate === now.toDateString();
  // ready: today's reward waits for the tap. paid: the tap just collected it.
  // done: it was collected earlier today (a reopen).
  const phase = !claimedToday ? 'ready' : reward ? 'paid' : 'done';

  // Today's place in the seven: the day a claim would pay, or the one it did.
  const pending = dailyClaimDay({ lastLoginDate, consecutiveLogins }, now);
  const currentDay = phase === 'ready' ? pending.day : ((Math.max(consecutiveLogins, 1) - 1) % DAILY_REWARDS.length) + 1;
  // The streak as it stands right now: before today's claim it is the one a
  // claim would extend (0 once it has lapsed), after it the recorded one.
  const streak = phase === 'ready' ? pending.streak - 1 : consecutiveLogins;

  // A card day fetches the reveal while the player is still reading the
  // panel, so the cards are ready to deal by the time the tap lands.
  const cardDay = phase === 'ready' && DAILY_REWARDS[currentDay - 1].cards > 0;
  useEffect(() => {
    if (cardDay) loadRevealCard().catch(() => {});
  }, [cardDay]);

  // The reward is collected by a tap. It used to be granted the moment the
  // panel mounted (with a ref guard so StrictMode's second mount could not
  // grant it twice), so the panel opened on "Claimed!" and the one action a
  // daily reward is built around never happened. Closing without claiming
  // leaves it waiting: the menu's Daily rewards button keeps its glow while
  // lastLoginDate is not today.
  const celebrateTimer = useRef(null);
  const holdTimer = useRef(null);
  const [holding, setHolding] = useState(false);
  const claim = () => {
    const paid = checkDailyLogin();
    setNow(new Date());
    // Null: already claimed (in another tab since this one opened), which
    // the panel now shows as done.
    if (!paid) return;
    setReward(paid);
    setHolding(true);
    holdTimer.current = setTimeout(() => setHolding(false), holdFor(paid.cardIds?.length ?? 0));
    // A beat after the stamp starts to land.
    celebrateTimer.current = setTimeout(() => {
      celebrate({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }, 250);
  };
  // Cleared on unmount so a quick close doesn't burst confetti over the next screen.
  useEffect(() => () => {
    clearTimeout(celebrateTimer.current);
    clearTimeout(holdTimer.current);
  }, []);

  // The claim grows the panel (the prizes, the cards), and on a phone or a
  // short window that pushed the button the player had just pressed below
  // the screen. Once the new layout is in, the scrim scrolls just far enough
  // to bring it back (focus is already on it).
  const buttonRef = useRef(null);
  useEffect(() => {
    if (!reward) return undefined;
    const frame = requestAnimationFrame(() => buttonRef.current?.scrollIntoView({ block: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [reward]);

  // The cards the claim drew, dealt once the chips have landed and turned one
  // by one; all at once, face up, with motion off.
  const cards = (reward?.cardIds ?? [])
    .map((id) => ALL_CARDS.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => ({ ...c, isNew: true }));
  const [dealt, setDealt] = useState(false);
  const [turned, setTurned] = useState(0);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const count = reward?.cardIds?.length ?? 0;
    if (!count) return undefined;
    if (reducedMotion()) {
      setSettled(true);
      setDealt(true);
      setTurned(count);
      return undefined;
    }
    const timers = [setTimeout(() => setDealt(true), DEAL_MS)];
    for (let i = 0; i < count; i += 1) {
      timers.push(setTimeout(() => setTurned((n) => Math.max(n, i + 1)), TURN_MS + i * TURN_STAGGER_MS));
    }
    return () => timers.forEach(clearTimeout);
  }, [reward]);

  // The brass button: Claim, then Continue. A tap while Continue holds turns
  // any cards still face down at once, rather than doing nothing.
  const press = () => {
    if (phase === 'ready') {
      claim();
    } else if (holding) {
      if (turned < cards.length) {
        setDealt(true);
        setTurned(cards.length);
      }
    } else {
      onClose();
    }
  };

  const cardNames = cards.map((c) => `${c.name} (${c.rarity.charAt(0).toUpperCase()}${c.rarity.slice(1)})`);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Daily Rewards"
      // Scrolls, with the panel centred by my-auto rather than items-center: a
      // centred flex item taller than its box overflows at both ends, and on a
      // short phone that put the button out of reach.
      className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
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
            Login streak: {streak} day{streak !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="relative px-5 pt-6 sm:px-6">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {DAILY_REWARDS.map((dayReward, index) => {
              const day = index + 1;
              let look = 'ahead';
              if (day < currentDay) look = 'past';
              else if (day === currentDay) look = phase === 'ready' ? 'today' : 'stamped';
              else if (day === currentDay + 1 && phase !== 'ready') look = 'tomorrow';
              return (
                <RewardDay
                  key={day}
                  day={day}
                  look={look}
                  justStamped={phase === 'paid'}
                  coins={dayReward.coins}
                  gems={dayReward.gems || 0}
                  cards={dayReward.cards}
                  packs={dayReward.packs}
                />
              );
            })}
          </div>

          {/* A polite live region, mounted empty with the dialog and filled
              by the claim, so a screen reader hears what was collected and
              which cards (focus stays on the button, which turns from Claim
              into Continue). Only the claim is in it: the countdown below
              ticks, and inside a live region every tick would be read out. */}
          <div role="status" className="sr-only">
            {phase === 'paid' && `Day ${reward.day} claimed: ${inWords(reward)}.${
              cardNames.length > 0 ? ` New card${cardNames.length > 1 ? 's' : ''}: ${cardNames.join(', ')}.` : ''}`}
          </div>
          <div className="mt-5 rounded-xl bg-black/25 px-4 py-5 text-center ring-1 ring-white/5">
            {phase === 'ready' && (
              <>
                <h3 className="inline-flex items-center gap-2 font-display text-lg font-extrabold text-white sm:text-xl">
                  <Gift aria-hidden="true" className="h-4 w-4 shrink-0 text-brass-300 sm:h-5 sm:w-5" strokeWidth={2.2} />
                  Day {currentDay} is ready
                </h3>
                <p className="mt-1 text-sm text-plush-300">
                  {streak > 0
                    ? <>Claim it within <span className="font-semibold tabular-nums text-plush-100">{getTimeUntilReset(false, now)}</span> to keep your streak.</>
                    : 'Claim it to start a streak.'}
                </p>
              </>
            )}

            {phase === 'paid' && (
              <>
                {/* Sized down on narrow phones so it stays one line inside
                    the box at 320px; wrapped, it left the sparkle stranded
                    beside a two-line block. */}
                <h3 className="inline-flex items-center gap-2 whitespace-nowrap font-display text-base font-extrabold text-white min-[360px]:text-lg sm:text-xl">
                  <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-brass-300 sm:h-5 sm:w-5" strokeWidth={2.2} />
                  Day {reward.day} claimed!
                </h3>
                <div aria-hidden="true" className="mt-4 flex flex-wrap items-center justify-center gap-2 min-[360px]:gap-3">
                  {PRIZES.filter((p) => reward[p.key] > 0 && !(p.key === 'cards' && cards.length > 0)).map(({ key, Icon, tone }, i) => (
                    <motion.div
                      key={key}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.15 }}
                      className="panel-glass flex items-center gap-2 rounded-xl px-4 py-2.5"
                    >
                      <Icon className={`h-5 w-5 ${tone}`} strokeWidth={2.2} />
                      <span className="font-display text-lg font-extrabold tabular-nums text-white">+{reward[key]}</span>
                    </motion.div>
                  ))}
                  {cards.map((card, i) => (
                    <GrantedCard key={card.id} card={card} index={i} dealt={dealt} turned={i < turned} settled={settled} />
                  ))}
                </div>
                {reward.substitutedCards > 0 && (
                  <p className="mt-3 text-sm text-plush-300">
                    You already own every card, so {reward.substitutedCards === 1 ? 'the card was' : 'the cards were'} paid in coins.
                  </p>
                )}
                <div><NextReward now={now} /></div>
              </>
            )}

            {phase === 'done' && (
              <>
                <div aria-hidden="true" className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-400/10 ring-1 ring-emerald-300/30">
                  <Check className="h-6 w-6 text-emerald-300" strokeWidth={2.6} />
                </div>
                <h3 className="mt-3 font-display text-xl font-extrabold text-white">Today&apos;s reward is in</h3>
                <NextReward now={now} />
              </>
            )}
          </div>
        </div>

        {/* A plain button: the shadcn Button's bg-primary is a utility and
            would beat the brass material. One element in every phase, so the
            focus a tap on Claim gave it stays on it as it turns into
            Continue. */}
        <div className="relative px-5 pt-5 pb-6 sm:px-6">
          <button
            ref={buttonRef}
            type="button"
            onClick={press}
            // Says so while Continue holds; the brass material drops its
            // hover and press for it too.
            aria-disabled={phase !== 'ready' && holding ? 'true' : undefined}
            className={`btn-brass inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl font-display text-lg font-bold ${FOCUS_OUTLINE}`}
          >
            {phase === 'ready' && <Gift aria-hidden="true" className="h-5 w-5" strokeWidth={2.2} />}
            {phase === 'ready' ? 'Claim' : 'Continue'}
          </button>
        </div>

        {/* The header's close control, as on every other dialog. Last in the
            DOM on purpose: useDialog focuses the first control on open, and
            that stays the brass button, the one thing this dialog asks you
            to do. Closing before claiming leaves the reward waiting. */}
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
