import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Swords, Target, Trophy, Store, Package, Medal, Layers, LibraryBig,
  Gift, CircleHelp, Settings, Coins, Gem, Flame, ChevronRight, Moon,
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { getDailyChallenges, getWeeklyChallenges, countClaimable } from '../stores/challenges';
import { useGameStore, ALL_CARDS } from '../stores/gameStore';
import { pressable } from '@/lib/a11y';
import { neighborIndex } from '@/lib/menuKeys';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { MENU_PAD } from '@/lib/safeArea';
import { RARITY_ORDER } from '@/lib/rarity';
import { bestOwnedBorder } from '@/lib/cosmetics';
import { countReadyRewards, passOf } from '@/lib/battlePass';
import { signFor, subtitleFor, partOfDay, CLOSED_NOTES } from '@/lib/barClock';
import { houseRank } from '@/lib/houseRank';
import { pickLine } from '@/lib/mgmtNotes';
import { TILE_LINES, streakLine, heroLineForVisit, footerLineForVisit, recordMenuVisit, SHIPPED_FOOTER } from '@/lib/menuLines';
import { dailyFightFor } from '@/lib/dailyFight';
import CardFan from './CardFan';
import NeonSign from './NeonSign';

// Scatter/timing for the drifting background teddies. Hoisted to module scope
// and made deterministic: these were Math.random() calls inside the render
// body, so every re-render rebuilt all 12 animations with fresh values.
const DRIFTERS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: `${(i * 8.37 + (i % 5) * 2.6) % 96}%`,
  duration: `${15 + ((i * 7) % 10)}s`,
  delay: `${((i * 1.7) % 5).toFixed(2)}s`,
}));

// Small icon button for the header. lucide icons, not emoji: emoji render
// differently on every platform and read as stickers next to the card art.
//
// 44px at every size, the smallest comfortable touch target; below sm it was
// 40. Focus is the shared FOCUS_OUTLINE, not a ring: a Tailwind ring is a
// box-shadow, and it would replace the material's own (its rim light and
// depth). The press is the materials' own :active (index.css), not Framer
// Motion's whileTap, which this codebase does not use (see CLAUDE.md).
const HeaderButton = ({ icon: Icon, label, onClick, glow = false, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={`relative grid place-items-center w-11 h-11 rounded-xl ${FOCUS_OUTLINE} ${glow ? 'btn-brass' : 'btn-glass'}`}
  >
    <Icon aria-hidden="true" className={`w-5 h-5 ${glow ? 'text-night-950' : 'text-plush-200'}`} strokeWidth={2.2} />
    {children}
  </button>
);

// The icon carries the meaning visually; the sr-only noun carries it for a
// screen reader. (aria-label on a role-less div is prohibited in ARIA 1.2.)
// As tall as the header buttons beside it, so the row stays one line of chips.
const Currency = ({ icon: Icon, value, tone, noun }) => (
  <div className="panel-glass rounded-xl h-11 pl-2 pr-2.5 sm:pl-2.5 sm:pr-3.5 flex items-center gap-1.5 sm:gap-2">
    <Icon aria-hidden="true" className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${tone}`} strokeWidth={2.4} />
    <span className={`font-display font-extrabold text-[14px] sm:text-[15px] tabular-nums ${tone}`}>{value}</span>
    <span className="sr-only">{noun}</span>
  </div>
);

// The hover lift, as a variant the hovered wrapper hands down (see the tiles).
const LIFT_2 = { lift: { y: -2 } };
const LIFT_3 = { lift: { y: -3 } };

// The time of day the bar's sign and the Battle button's line go by (see
// src/lib/barClock.js): the player's own clock, read when the menu opens and
// again each time the tab comes back into view, and never on a timer. A menu
// left open is a menu nobody is looking at, and a timer on it would be work
// for nothing; the one that matters is the player who left it open overnight,
// and they return through a visibility change. The clock is kept as the time
// it was read, and only replaced when that moves the bar into another part of
// the night, so a tab that comes back at the same hour re-renders nothing.
const useBarClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const reread = () => {
      if (document.visibilityState === 'hidden') return;
      const next = new Date();
      setNow((prev) => (partOfDay(prev) === partOfDay(next) ? prev : next));
    };
    document.addEventListener('visibilitychange', reread);
    return () => document.removeEventListener('visibilitychange', reread);
  }, []);
  return now;
};

const MainMenu = ({
  onStartGame,
  onDeckBuilder,
  onCollection,
  onTutorial,
  onCardPacks,
  onPlayerStats,
  onSettings,
  onDailyRewards,
  onShop,
  onBattlePass,
  onLeaderboard,
  onChallenges,
  onNightly,
}) => {
  const {
    playerName, level, xp, getXPForNextLevel,
    coins, gems, gemDebt, cardPacks, premiumPacks, legendaryPacks, unlockedCosmetics,
    totalWins, currentWinStreak, lastLoginDate, animationsEnabled,
    claimedChallenges,
    todayWins, todayBattles, todayDamageDealt, todayCardsPlayed,
    weekWins, weekBestStreak, weekNewCards, weekCoinsEarned,
    syncPeriods, ownedCards,
    seasonXP, claimedBattlePassRewards, hasBattlePassPremium, syncSeason,
    dailyKey, dailyResult, dailyStreak,
  } = useGameStore();

  const today = new Date().toDateString();
  const dailyAvailable = lastLoginDate !== today;

  const clock = useBarClock();
  const sign = signFor(clock);
  const closed = sign.state === 'closed';

  // What the menu says around the button (src/lib/menuLines.js): each picked
  // once per visit, in an initializer, never per render. The closed sign's
  // note is a pick of its own; while that note is up the footer is the shipped
  // one, so there is only one note from management in view.
  const [heroLine] = useState(() => heroLineForVisit());
  const [footerPick] = useState(() => footerLineForVisit({ closed }));
  const [closedNote] = useState(() => pickLine(CLOSED_NOTES));
  const footerLine = closed ? SHIPPED_FOOTER : footerPick;
  // Recorded once the menu is up (not while choosing: see menuLines.js).
  useEffect(() => { recordMenuVisit(heroLine, footerPick); }, [heroLine, footerPick]);

  // How many challenges are finished and waiting to be claimed.
  //
  // The Challenges tile used to badge `dailyAvailable` — whether the daily
  // LOGIN gift was unclaimed — which has nothing to do with challenges, and is
  // near-permanently false anyway because App auto-opens the Daily Rewards
  // dialog moments after launch. So the one tile with claimable rewards behind
  // it advertised the state of a different feature. Same helper the Challenges
  // panel scores with, so the badge and the panel always agree.
  // Roll the day/week over BEFORE scoring. getDailyChallenges() is seeded by
  // the local day index, so at midnight it returns a fresh set of ids — but the
  // counters it is scored against (todayWins, todayDamageDealt, …) are only
  // zeroed by syncPeriods, which nothing calls on the menu path. Yesterday's
  // five wins therefore scored today's brand-new, unclaimed challenges, and the
  // tile badged "4 claimable". Tapping it ran Challenges' own syncPeriods on
  // mount, which zeroed the counters, and the panel showed 0/target with no
  // Claim buttons anywhere. The comment above promises the badge and the panel
  // always agree; this is what makes that true.
  useEffect(() => { syncPeriods(); }, [syncPeriods]);

  const challengeStats = {
    todayWins, todayBattles, todayDamageDealt, todayCardsPlayed,
    weekWins, weekBestStreak, weekNewCards, weekCoinsEarned,
  };
  const claimableChallenges =
    countClaimable(getDailyChallenges(), challengeStats, claimedChallenges ?? []) +
    countClaimable(getWeeklyChallenges(), challengeStats, claimedChallenges ?? []);

  // How many Battle Pass tiles are waiting to be claimed: the helper the pass
  // itself badges with, so the tile and the dialog always agree. The tile was
  // hard-coded to its brass "asking for attention" trim, lit forever even
  // with every tier claimed. The season is rolled first, as the pass does on
  // open, or a save from an ended season badges tiers the pass would deliver
  // and wipe the moment it opened; a layout effect, so the stale count is
  // never painted. (This is usually where a returning player's rollover
  // happens, and App announces what it delivered.)
  useLayoutEffect(() => { syncSeason(); }, [syncSeason]);
  const passReady = countReadyRewards(passOf({ seasonXP, claimedBattlePassRewards, hasBattlePassPremium }));

  const xpForNext = getXPForNextLevel();
  const xpProgress = (xp / xpForNext) * 100;

  // Rarest three the player owns; rank is RARITY_ORDER's index, so legendary
  // sorts first. Stable on equal rarity, by catalogue order.
  const heroCards = useMemo(() => {
    const owned = new Set(ownedCards ?? []);
    return ALL_CARDS
      .filter((c) => owned.has(c.id))
      .map((c, i) => ({ c, i }))
      .sort((a, b) => (RARITY_ORDER.indexOf(b.c.rarity) - RARITY_ORDER.indexOf(a.c.rarity)) || a.i - b.i)
      .slice(0, 3)
      .map(({ c }) => c);
  }, [ownedCards]);
  // Centre slot gets the rarest card.
  const fanned = heroCards.length === 3 ? [heroCards[1], heroCards[0], heroCards[2]] : heroCards;
  // The player's Battle Pass frame, as on their cards everywhere else.
  const cosmeticBorder = bestOwnedBorder(unlockedCosmetics);

  // Every pack the Card Packs screen can open, not just the coin-bought kind:
  // Premium and Legendary packs (bought with gems, or won from weekly
  // challenges) are counted separately, and the tile used to show nothing to
  // open while three were waiting.
  const packsToOpen = (cardPacks ?? 0) + (premiumPacks ?? 0) + (legendaryPacks ?? 0);

  // Everything except Battle, which is the hero. `accent` marks the
  // destinations that are currently asking for attention, each with a badge
  // that says why.
  // The tile grid is 2 columns until sm, then 4. Arrow keys follow that;
  // Tab still visits every tile, the header and Battle included.
  const menuColumns = useMediaQuery('(min-width: 640px)') ? 4 : 2;
  const onMenuKeyDown = (event) => {
    const tiles = [...event.currentTarget.querySelectorAll('[data-dest]')];
    const index = tiles.indexOf(event.target.closest?.('[data-dest]'));
    const next = neighborIndex(index, event.key, menuColumns, tiles.length);
    if (next == null) return;
    event.preventDefault();
    tiles[next].focus();
  };

  const destinations = [
    { id: 'challenges', title: 'Challenges', description: TILE_LINES.challenges, icon: Target, action: onChallenges, badge: claimableChallenges > 0 ? `${claimableChallenges} ready` : null, accent: claimableChallenges > 0 },
    { id: 'battlepass', title: 'Battle Pass', description: TILE_LINES.battlepass, icon: Trophy, action: onBattlePass, badge: passReady > 0 ? `${passReady} ready` : null, accent: passReady > 0 },
    { id: 'shop', title: 'Shop', description: TILE_LINES.shop, icon: Store, action: onShop },
    { id: 'packs', title: 'Card Packs', description: TILE_LINES.packs, icon: Package, action: onCardPacks, badge: packsToOpen > 0 ? `${packsToOpen} to open` : null, accent: packsToOpen > 0 },
    { id: 'deck', title: 'Deck Builder', description: TILE_LINES.deck, icon: Layers, action: onDeckBuilder },
    { id: 'collection', title: 'Collection', description: TILE_LINES.collection, icon: LibraryBig, action: onCollection },
    { id: 'leaderboard', title: 'Rankings', description: TILE_LINES.leaderboard, icon: Medal, action: onLeaderboard },
    { id: 'nightly', title: 'Nightly', description: TILE_LINES.nightly, icon: Moon, action: onNightly,
      badge: dailyKey === dailyFightFor().key && dailyResult
        ? (dailyResult === 'win' ? `${dailyStreak} streak` : 'Sat')
        : 'Open',
      accent: !(dailyKey === dailyFightFor().key && dailyResult) },
  ];

  return (
    <div className={`game-surface relative min-h-screen bar-backdrop flex flex-col ${MENU_PAD} overflow-x-hidden overflow-y-auto`}>
      {/* Animated background — CSS-driven, and skipped entirely when the
          player has turned Animations off. See the .teddy-drift note in
          index.css for why this is not Framer Motion. */}
      {animationsEnabled && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {DRIFTERS.map((d) => (
            <div
              key={d.id}
              className="teddy-drift absolute text-4xl opacity-[0.06]"
              style={{ left: d.left, animationDuration: d.duration, animationDelay: d.delay }}
            >
              🧸
            </div>
          ))}
        </div>
      )}
      <div className="fixed inset-0 grain pointer-events-none" aria-hidden="true" />

      {/* Top bar */}
      <header className="relative z-10 flex flex-wrap justify-between items-center gap-3">
        <motion.div
          initial={{ x: -24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          {...pressable(onPlayerStats, 'View player stats')}
          // The name above is the control's; this reads out what it shows.
          aria-describedby="menu-player-summary"
          className={`panel-glass sheen relative flex items-center gap-3 rounded-2xl pl-2 pr-4 py-2 cursor-pointer ${FOCUS_OUTLINE}`}
        >
          <div className="relative w-12 h-12 rounded-full p-[2px]" style={{ background: 'linear-gradient(145deg, #fde68a, #b45309 45%, #fbbf24)' }}>
            <div className="w-full h-full rounded-full bg-night-800 grid place-items-center text-2xl">🧸</div>
          </div>
          <div className="min-w-0" id="menu-player-summary">
            <div className="text-white font-display font-extrabold leading-tight truncate max-w-[9rem] sm:max-w-[16rem]" title={playerName}>{playerName}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="btn-brass rounded-md px-1.5 py-[1px] text-[11px] font-extrabold leading-none">Lv {level}</span>
              <div className="w-20">
                <Progress
                  value={xpProgress}
                  className="h-1.5 bg-night-950/70 [&>div]:bg-gradient-to-r [&>div]:from-brass-300 [&>div]:to-brass-500"
                  aria-label={`Level ${level} XP progress: ${xp} of ${xpForNext}`}
                />
              </div>
            </div>
            <div className="text-plush-300 text-[11px] mt-1">
              {houseRank(level).name} · {totalWins.toLocaleString()} {totalWins === 1 ? 'win' : 'wins'}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          // Tighter below sm, so the row of 44px controls fits one line from
          // 360px with a five-digit balance (and at 320 with a starting one);
          // and it wraps below that rather than running off the edge, as it
          // did — taking Settings with it, hidden, not scrollable, behind the
          // root's overflow-x-hidden.
          className="flex flex-wrap items-center justify-end gap-1 sm:gap-2"
        >
          <HeaderButton
            icon={Gift}
            onClick={onDailyRewards}
            glow={dailyAvailable}
            // Its only content is an icon, so it needs a label — unlike before,
            // when the accessible name was the gift emoji character itself.
            label={dailyAvailable ? 'Daily rewards — a reward is ready to claim' : 'Daily rewards'}
          >
            {dailyAvailable && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 ring-2 ring-night-900" aria-hidden="true" />
            )}
          </HeaderButton>
          <Currency icon={Coins} value={coins.toLocaleString()} tone="text-brass-300" noun="coins" />
          {/* Gems owed after a reversed payment read as what they are, as in
              the stores' WalletChips: "0" said a purchase's gems had gone
              missing, when they had paid what was owed. */}
          {gemDebt > 0
            ? <Currency icon={Gem} value={`−${gemDebt.toLocaleString()}`} tone="text-rose-300" noun="gems owed after a reversed payment" />
            : <Currency icon={Gem} value={gems.toLocaleString()} tone="text-fuchsia-300" noun="gems" />}
          <HeaderButton icon={CircleHelp} onClick={onTutorial} label="How to play" />
          <HeaderButton icon={Settings} onClick={onSettings} label="Settings" />
        </motion.div>
      </header>

      {/* The page's main landmark: the hero and the destinations. The header
          above is the banner; without a main, the h1 and the Battle button
          sat outside every landmark a screen reader can jump to. */}
      <main className="relative z-10 flex-1 flex flex-col">
      {/* Hero: title, the player's own cards, and the one big button. */}
      <section className="relative flex-1 flex flex-col items-center justify-center py-6 md:py-8 [@media(max-height:700px)]:py-3">
        {/* The bar's sign, hung in the hero's top-right corner: decoration,
            absolutely placed, so it takes no layout and Battle's place above
            the fold on a phone cannot move (responsive.spec.js). From lg only:
            below it the 72px title spans nearly the whole width and leaves the
            corner nothing but a strip that made the sign read as a label on
            the settings gear, so a phone or a tablet in portrait has the clock
            as the Battle button's line instead. Keyed by the part of the
            night, so a sign that changes while the menu is open switches on
            afresh. */}
        <NeonSign
          key={sign.state}
          text={sign.text}
          tone={sign.tone}
          lit={sign.lit}
          flicker={sign.flicker}
          note={closed ? closedNote : sign.note}
          className="hidden lg:block absolute right-[3%] top-3 -rotate-3 text-xl xl:right-[5%] xl:text-2xl"
        />
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          {/* text-5xl wraps below 375px, and a gradient clipped to text then
              stretches over both lines: one word pale, the other dark. */}
          <h1 className="font-display font-extrabold text-[2.5rem] min-[375px]:text-5xl md:text-7xl leading-none tracking-tight text-brass-gradient">
            Terrible Teddies
          </h1>
          <p className="label-caps text-plush-300 mt-3">{heroLine}</p>
        </motion.div>

        {/* On short screens (a phone with its browser toolbars, a landscape
            phone) the fan shrinks, so the Battle button stays above the fold. */}
        <div className="mt-6 md:mt-8 flex flex-col md:flex-row items-center gap-8 md:gap-14 [@media(max-height:700px)]:mt-3 [@media(max-height:700px)]:gap-4">
          {/* The fan: the player's own three rarest cards, so the hero shows
              what they actually have and improves as their collection does. */}
          <CardFan
            cards={fanned}
            cosmeticBorder={cosmeticBorder}
            className="w-[230px] h-[200px] md:w-[270px] md:h-[236px] [@media(max-height:700px)]:!h-[156px]"
            cardClassName="scale-[1.3] md:scale-[1.5] [@media(max-height:700px)]:!scale-100"
          />

          {/* Battle: the primary action, and the only brass button on screen. */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            // Above the fan: the cards' drop shadow fell across the top of the
            // button on phones.
            className="relative z-10 flex flex-col items-center md:items-start gap-3"
          >
            {/* Hovered on a wrapper that holds still, lifted inside it: when the
                lift moved the hover target itself, a pointer resting on its
                bottom edge fell off it, it dropped back under the pointer, and
                the button shook. The lift is a plain wrapper of its own, and
                the brass inside it is never animated, because the press is
                the brass's own :active translate and Framer's inline
                transform on the same element replaced it: the button did
                not move when pressed. */}
            <motion.div whileHover="lift">
              <motion.div variants={LIFT_2} className="rounded-2xl">
                <div
                  {...pressable(onStartGame, 'Battle')}
                  // The name stays "Battle"; the clock's line under it is its
                  // description, so a screen reader hears it too.
                  aria-describedby="menu-battle-line"
                  data-dest="game"
                  className="btn-brass sheen relative cursor-pointer rounded-2xl pl-6 pr-5 py-4 flex items-center gap-4 min-w-[260px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-200"
                >
                  <Swords aria-hidden="true" className="w-9 h-9 shrink-0" strokeWidth={2.2} />
                  <div className="flex-1 text-left">
                    <div className="font-display font-extrabold text-3xl leading-none">Battle</div>
                    {/* The bar's clock again (src/lib/barClock.js): 20
                        characters at most, one line. Below 360px, where the
                        button can grow no wider than the screen (a 152px
                        column at 320), a step smaller, so the longest lines
                        still fit it in the widest font a device falls back
                        to (e2e/responsive.spec.js measures every row of the clock table). */}
                    <div id="menu-battle-line" className="text-[13px] min-[360px]:text-sm font-semibold mt-1 text-night-950/75">{subtitleFor(clock)}</div>
                  </div>
                  <ChevronRight aria-hidden="true" className="w-6 h-6 shrink-0" strokeWidth={2.6} />
                </div>
              </motion.div>
            </motion.div>
            {currentWinStreak > 0 && (
              <div className="flex items-center gap-1.5 text-orange-300 text-sm font-semibold">
                <Flame aria-hidden="true" className="w-4 h-4" /> {streakLine(currentWinStreak)}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Everywhere else. One material, one icon style, one accent: tiles that
          are asking for attention get the brass trim instead of a different
          colour each — the old eight-colour rainbow gave Rankings the same
          weight as the thing you came to do. */}
      <nav className="relative z-10 w-full max-w-6xl mx-auto" aria-label="Main menu" onKeyDown={onMenuKeyDown}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {destinations.map((d, index) => (
            <motion.div
              key={d.id}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 + index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              // The cell is what is hovered, and the tile inside it is what
              // lifts. Lifting the hovered element itself made a pointer on
              // its bottom 3px fall off it, so it dropped back under the
              // pointer and was hovered again, every frame: the tile shook.
              whileHover="lift"
              // Eight tiles fill a 2-column and a 4-column grid exactly, so the
              // last one does not have to stretch.
            >
              <motion.div
                {...pressable(d.action, d.title)}
                // App hands the focus back here on the way back from the
                // screen this tile opened.
                data-dest={d.id}
                variants={LIFT_3}
                // The name stays the bare title (the e2e suite and players'
                // muscle memory use it); the badge is read as its description.
                aria-describedby={d.badge ? `menu-badge-${d.id}` : undefined}
                className={`panel-glass sheen relative h-full rounded-2xl p-4 cursor-pointer flex flex-col items-center text-center gap-2
                  transition-[filter] hover:brightness-110 ${FOCUS_OUTLINE}
                  ${d.accent ? 'trim-brass' : ''}`}
              >
                <div className={`grid place-items-center w-11 h-11 rounded-full ${d.accent ? 'bg-brass-400/15' : 'bg-white/5'} ring-1 ${d.accent ? 'ring-brass-300/40' : 'ring-white/10'}`}>
                  <d.icon aria-hidden="true" className={`w-[22px] h-[22px] ${d.accent ? 'text-brass-300' : 'text-plush-200'}`} strokeWidth={2} />
                </div>
                <div className="font-display font-extrabold text-white text-[15px] leading-tight">{d.title}</div>
                {/* In the flow under the title: pinned to the corner it sat on
                    the icon ring at lg widths, and the tile clips anything
                    hung over its edge (the sheen needs overflow hidden). */}
                {d.badge && (
                  <div id={`menu-badge-${d.id}`} className="rounded-full bg-brass-400 text-night-950 px-2 py-[1px] text-[10px] font-extrabold leading-tight">
                    {d.badge}
                  </div>
                )}
                <div className="text-[11px] leading-snug text-plush-300 hidden md:block">{d.description}</div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </nav>
      </main>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="relative z-10 text-center text-plush-400 text-[11px] mt-5"
      >
        {footerLine}
      </motion.p>
    </div>
  );
};

export default MainMenu;
