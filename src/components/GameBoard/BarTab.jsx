import { useEffect, useId, useState } from 'react';
import { Coins, Crown } from 'lucide-react';
import { motion, useReducedMotionConfig } from 'framer-motion';
import { Medallion } from '@/components/ui/medallion';
import { useGameStore } from '@/stores/gameStore';
import { TAB_COPY } from '@/lib/houseLines';
import { rankUp } from '@/lib/houseRank';

// The Tab: the result panel's rewards, printed as a bar tab. A strip of thermal
// paper comes out of a slit and itemizes the night (cards played, damage dealt,
// healed, damage taken), then what it paid (XP and coins, the level bar, a
// level-up, a Battle Pass tier), then a dashed rule, Chuck's running tab (the
// store's totalDamageDealt, all-time) and one footer from houseLines.js.
//
// It is the old "Battle Rewards" block with the same beats (CountUp, the XP bar
// that fills, the level-up row, the tier line), on paper. The paper is the
// .receipt material (index.css), which prints in over 900 ms and, with the
// Animations switch off or reduced motion, simply appears. Its colours are the
// material's own custom properties (ink, faded ink and rule: no Tailwind
// token), and nothing here is a Tailwind colour on the paper. Everything the
// rewards said before they still say: the final figures are in text for a
// screen reader from the start, never the count-up's passing numbers.

// A reward figure that counts up from zero as the result panel opens. With
// reduced motion — the OS setting, or the Animations switch through
// MotionConfig — it shows the figure at once. Visual only: the caller puts
// the final figure in sr-only text, so a screen reader never hears a count.
const CountUp = ({ value, delay = 0, duration = 700 }) => {
  const reduced = useReducedMotionConfig();
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      return undefined;
    }
    let frame = 0;
    let start = null;
    const tick = (now) => {
      start ??= now;
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => { frame = requestAnimationFrame(tick); }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, delay, duration, reduced]);
  return <span aria-hidden="true" data-count-up="">{shown.toLocaleString()}</span>;
};

// When the result panel's beats land, in seconds: the figures pop, the XP bar
// fills, then the level-up (if any) arrives as the bar tops out.
export const REWARD_BEATS = { xp: 0.3, coins: 0.5, bar: 0.7, levelUp: 1.6 };

const FADED = 'text-[color:var(--receipt-faded)]';

/**
 * The XP bar under the receipt's figures: the level's progress from where the
 * battle started to where it ended. On a level-up it fills to the end,
 * empties and fills again into the new level. The fill is a transform
 * (scaleX from its left edge), which Framer Motion owns and the compositor
 * runs, never a width; with reduced motion it simply shows where it ended.
 * Printed in ink on a tan track.
 */
const XpBar = ({ progress }) => {
  const { xpBefore, xpNeededBefore, xpAfter, xpNeededAfter, levelAfter, levelsGained } = progress;
  const from = Math.min(1, xpBefore / xpNeededBefore);
  const to = Math.min(1, xpAfter / xpNeededAfter);
  const levelled = levelsGained > 0;
  return (
    <div className="mt-3">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={xpNeededAfter}
        aria-valuenow={xpAfter}
        aria-label={`Level ${levelAfter}: ${xpAfter} of ${xpNeededAfter} XP`}
        className="h-2.5 overflow-hidden rounded-full bg-[color:var(--receipt-rule)] ring-1 ring-inset ring-[color:var(--receipt-faded-line)]"
      >
        <motion.div
          data-xp-fill=""
          className="h-full rounded-full bg-[color:var(--receipt-ink)]"
          style={{ originX: 0 }}
          initial={{ scaleX: from }}
          animate={{ scaleX: levelled ? [from, 1, 0, to] : to }}
          transition={{
            delay: REWARD_BEATS.bar,
            duration: levelled ? 1.3 : 0.8,
            ease: 'easeOut',
            ...(levelled ? { times: [0, 0.6, 0.61, 1] } : {}),
          }}
        />
      </div>
      <div aria-hidden="true" className={`mt-1 flex justify-between text-[11px] font-semibold tabular-nums ${FADED}`}>
        <span>Lv {levelAfter}</span>
        <span>{xpAfter.toLocaleString()} / {xpNeededAfter.toLocaleString()} XP</span>
      </div>
    </div>
  );
};

// The level-up beat: the new level on a brass medallion (a seal on the paper),
// and the coins the level-up paid — credited all along, and never shown
// anywhere until the result panel did. With reduced motion it is simply there:
// Framer Motion's reduced motion stops transforms but still runs an opacity
// fade, delay and all, which held the row invisible for 1.6s.
const LevelUpRow = ({ level, bonusCoins, promotion }) => {
  const reduced = useReducedMotionConfig();
  return (
    <motion.div
      data-level-up=""
      initial={reduced ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: REWARD_BEATS.levelUp, type: 'spring', stiffness: 320, damping: 18 }}
      className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5"
    >
      <Medallion size="sm">
        <span className="font-display text-lg font-extrabold leading-none text-brass-200">{level}</span>
      </Medallion>
      <div className="text-left">
        <div className={`label-caps ${FADED}`}>Level up</div>
        <div className="font-display text-xl font-extrabold leading-tight">Level {level}</div>
      </div>
      <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-[color:var(--receipt-faded-soft)] px-2.5 py-1.5">
        <Coins className="h-4 w-4" aria-hidden="true" />
        <span className="font-display text-base font-extrabold tabular-nums">+{bonusCoins.toLocaleString()}</span>
        <span className="sr-only">bonus coins</span>
      </div>
      {/* The house rank this level-up arrived at, when it crossed a rung: the
          same line the level-up toast carries (houseRank.js), once, under
          the bonus. Real content, so a screen reader reads it where it sits. */}
      {promotion && (
        <p data-rank-up="" className={`w-full text-center text-sm italic ${FADED}`}>{promotion}</p>
      )}
    </motion.div>
  );
};

// The Battle Pass tier the XP opened, when it opened one.
const TierLine = ({ tier }) => {
  const reduced = useReducedMotionConfig();
  return (
    <motion.p
      data-pass-tier=""
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: REWARD_BEATS.levelUp + 0.3 }}
      className="mt-3 flex items-center justify-center gap-1.5 text-sm font-bold"
    >
      <Crown className="h-4 w-4 shrink-0" aria-hidden="true" />
      Battle Pass tier {tier} unlocked
    </motion.p>
  );
};

// One line of the bill: a label, a dotted leader and a figure. A <dl> row, so a
// screen reader hears "Damage dealt, 31". The leader is drawn inside the <dd>
// (an empty, aria-hidden span) rather than between the two, which a definition
// list does not allow.
const Row = ({ label, children, className = '', figureClassName = 'font-bold' }) => (
  <div className={`flex items-baseline gap-1.5 ${className}`}>
    <dt className="shrink-0">{label}</dt>
    <dd className="flex min-w-0 flex-1 items-baseline gap-1.5">
      <span aria-hidden="true" className="mb-[3px] h-0 flex-1 border-b border-dotted border-[color:var(--receipt-faded-soft)]" />
      <span className={`shrink-0 ${figureClassName}`}>{children}</span>
    </dd>
  </div>
);

// A short screen (a phone in landscape, or with its toolbars out) keeps Play
// Again in reach by dropping the four itemized rows from sight. They stay for a
// screen reader, which has no use for the room.
const SHORT_SCREEN = '[@media(max-height:700px)]:sr-only';

const Rule = () => (
  <div aria-hidden="true" className="my-2.5 border-t border-dashed border-[color:var(--receipt-rule)]" />
);

/**
 * The receipt. `rewards` is the result panel's state (GameBoard's
 * battleRewards: xp, coins, progress, tierBefore and tierAfter, and `stats`,
 * the battle's own account of itself); `footer` the line picked for this game.
 */
const BarTab = ({ rewards, footer }) => {
  const headingId = useId();
  const chuckTab = useGameStore((s) => s.totalDamageDealt);
  const {
    xp, coins, progress, tierBefore, tierAfter, stats,
  } = rewards;
  const n = (value) => (value ?? 0).toLocaleString();
  const itemized = [
    [TAB_COPY.cards, stats?.cardsPlayed],
    [TAB_COPY.damage, stats?.damageDealt],
    [TAB_COPY.healed, stats?.healingDone],
    [TAB_COPY.taken, stats?.damageTaken],
  ];
  // The keg's share, and only when it actually hit. A zero would read as a
  // charge that did not happen.
  if (stats?.fatigueTaken > 0) itemized.push([TAB_COPY.fatigueTaken, stats.fatigueTaken]);
  if (stats?.fatigueDealt > 0) itemized.push([TAB_COPY.fatigueDealt, stats.fatigueDealt]);
  return (
    <div data-bar-tab="" className="receipt-feed relative mx-auto mb-5 w-full max-w-[18rem]">
      {/* The slit the paper comes out of. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-2 rounded-full bg-night-950 ring-1 ring-black/70" />
      <div
        role="group"
        aria-labelledby={headingId}
        className="receipt receipt-print px-4 pb-7 pt-5 text-left text-[13px] leading-[18px]"
      >
        <span aria-hidden="true" className="receipt-stain" />
        <p aria-hidden="true" className="pl-[0.3em] text-center text-2xl font-extrabold leading-none tracking-[0.3em]">
          {TAB_COPY.title}
        </p>
        <div id={headingId} className={`label-caps mt-1.5 text-center ${FADED}`}>{TAB_COPY.header}</div>
        <Rule />

        <dl>
          {itemized.map(([label, figure]) => (
            <Row key={label} label={label} className={SHORT_SCREEN}>{n(figure)}</Row>
          ))}
          <Row label={TAB_COPY.xp}>
            <span aria-hidden="true">+<CountUp value={xp} delay={REWARD_BEATS.xp * 1000} /></span>
            <span className="sr-only">{xp} XP</span>
          </Row>
          <Row label={TAB_COPY.coins}>
            <span aria-hidden="true">+<CountUp value={coins} delay={REWARD_BEATS.coins * 1000} /></span>
            <span className="sr-only">{coins} coins</span>
          </Row>
        </dl>
        {progress && <XpBar progress={progress} />}
        {progress?.levelsGained > 0 && (
          <LevelUpRow level={progress.levelAfter} bonusCoins={progress.bonusCoins} promotion={rankUp(progress.levelBefore, progress.levelAfter)?.promoted} />
        )}
        {tierAfter > tierBefore && <TierLine tier={tierAfter} />}

        <Rule />
        <dl>
          <Row label={TAB_COPY.chuck} figureClassName="text-[15px] font-extrabold">
            <span aria-hidden="true">{n(chuckTab)}</span>
            <span className="sr-only">{TAB_COPY.chuckSpoken(n(chuckTab))}</span>
          </Row>
        </dl>
        <p aria-hidden="true" className={`label-caps mt-0.5 text-right ${FADED}`}>{TAB_COPY.chuckStatus}</p>
        {footer && (
          <p className={`mt-3 text-center text-[11px] leading-4 [text-wrap:balance] ${FADED}`}>{footer}</p>
        )}
      </div>
    </div>
  );
};

export default BarTab;
