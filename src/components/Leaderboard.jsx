import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Flame, Globe, X, TriangleAlert, RotateCcw } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { supabase } from '../lib/supabase';
import { useDialog } from '@/hooks/useDialog';
import { RARITY_METAL } from '@/lib/rarity';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { Medallion } from '@/components/ui/game-chrome';

// Calculate trophies based on player stats
const calculateTrophies = (wins, level, bestStreak) => {
  return Math.floor((wins || 0) * 8 + (level || 1) * 10 + (bestStreak || 0) * 5);
};

// Calculate level from experience
const calculateLevel = (experience) => {
  return Math.floor((experience || 0) / 100) + 1;
};

// How many rows the board asks for. The view behind it returns players by
// wins (then experience), and they are re-ranked here by trophies, so these
// are not "the top 50" in trophies.
export const BOARD_SIZE = 50;

/**
 * The player's place on the board in hand: a number where the rows support
 * one, and "50+" where they cannot. `me` is the player's own trophies, wins
 * and leaderboard experience.
 *
 * Counting the rows with more trophies and adding one is a rank only while
 * the player is among the rows. A short board is every player, so it always
 * is. A full one is the view's top 50 by wins, so it is only when the view's
 * own order would have returned them: more wins than its last row, or as
 * many and at least its experience. Otherwise the count printed #51 for
 * everyone below every row, and #1 for a player with fewer wins than all
 * fifty who out-trophied them on level and best streak. A server-side rank
 * is what would turn "50+" into a number.
 */
export const placeOnBoard = (rows, me) => {
  const above = rows.filter((p) => p.trophies > me.trophies).length;
  if (rows.length < BOARD_SIZE) return above + 1;
  // The view's last row: the fewest wins, then the least experience.
  const last = rows.reduce((low, p) => (
    p.wins < low.wins || (p.wins === low.wins && p.experience < low.experience) ? p : low
  ));
  const returned = me.wins > last.wins || (me.wins === last.wins && me.experience >= last.experience);
  // above === rows.length: the player's own row, if fetched, is behind their
  // local stats (a sync still in flight), and they are below all of it.
  return returned && above < rows.length ? above + 1 : `${BOARD_SIZE}+`;
};

/**
 * A handle split where it could wrap: between the words of a run-together
 * name (GrizzlyAdamsFamily, QABear) and after a separator (Player_ab12).
 * The podium column is under 100px on a phone, and break-words alone broke
 * "GrizzlyAdamsF / amily" at whatever letter met the edge. Real <wbr>s
 * rather than zero-width spaces, which would ride along into copied text.
 *
 * A loop rather than a split on a lookbehind: the build targets Safari 16,
 * and lookbehind only arrived in 16.4, so before that the pattern threw as
 * each podium name rendered and took the whole dialog down with it.
 */
const LOWER = /[a-z]/;
const UPPER = /[A-Z]/;
export const nameBreaks = (name) => {
  const parts = [];
  let start = 0;
  for (let i = 1; i < name.length; i += 1) {
    const before = name[i - 1];
    const at = name[i];
    const wraps = (LOWER.test(before) && /[A-Z0-9]/.test(at)) // grizzly|Adams, ab|12
      || (UPPER.test(before) && UPPER.test(at) && LOWER.test(name[i + 1] ?? '')) // QA|Bear
      || /[_.-]/.test(before); // Player_|ab
    if (wraps) {
      parts.push(name.slice(start, i));
      start = i;
    }
  }
  parts.push(name.slice(start));
  return parts;
};
const BreakableName = ({ name }) => nameBreaks(name).map((part, i) => (
  <Fragment key={i}>{i > 0 && <wbr />}{part}</Fragment>
));

// The podium's three metals: gold is the game's brass (the legendary frame),
// silver the pewter of a common one, and bronze in the same light-dark-light
// polished-edge shape as RARITY_METAL. `tone` is the lettering in that metal;
// on the plinth's tint and on the panel each clears 5.5:1.
const PODIUM = {
  1: {
    metal: RARITY_METAL.legendary,
    tone: 'text-brass-200',
    light: 'rgba(251, 191, 36, 0.24)',
    halo: 'rgba(251, 191, 36, 0.38)',
    plinth: 'h-[4.5rem] sm:h-24',
    medal: 'h-14 w-14 sm:h-16 sm:w-16',
    numeral: 'text-2xl sm:text-3xl',
  },
  2: {
    metal: RARITY_METAL.common,
    tone: 'text-stone-200',
    light: 'rgba(214, 211, 209, 0.14)',
    halo: 'rgba(214, 211, 209, 0.2)',
    plinth: 'h-12 sm:h-16',
    medal: 'h-12 w-12 sm:h-14 sm:w-14',
    numeral: 'text-xl sm:text-2xl',
  },
  3: {
    metal: 'linear-gradient(145deg, #fed7aa 0%, #9a3412 32%, #fdba74 58%, #7c2d12 100%)',
    tone: 'text-orange-300',
    light: 'rgba(251, 146, 60, 0.16)',
    halo: 'rgba(251, 146, 60, 0.24)',
    plinth: 'h-8 sm:h-10',
    medal: 'h-12 w-12 sm:h-14 sm:w-14',
    numeral: 'text-xl sm:text-2xl',
  },
};

// Visual order on the podium is 2-1-3; DOM order stays 1-2-3, so a screen
// reader reads the ranking in rank order. Pinned columns rather than `order`,
// so a podium of one or two still puts first place in the middle.
const PODIUM_COLUMN = { 1: 'col-start-2 row-start-1', 2: 'col-start-1 row-start-1', 3: 'col-start-3 row-start-1' };

// Rows stagger in, but capped: at 50ms a row, fifty rows had the last one
// arriving two and a half seconds after the dialog opened.
const rowDelay = (rank) => Math.min(typeof rank === 'number' ? rank : 0, 12) * 0.04;

const Trophies = ({ value, className = 'text-white' }) => (
  <span className={`inline-flex shrink-0 items-center gap-1.5 font-display font-extrabold tabular-nums ${className}`}>
    <Trophy aria-hidden="true" className="h-4 w-4 text-brass-300" strokeWidth={2.2} />
    {value.toLocaleString()}
    <span className="sr-only">trophies</span>
  </span>
);

const Streak = ({ streak }) => (
  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-orange-500/10 px-1.5 py-[1px] text-[11px] font-bold leading-4 tabular-nums text-orange-300 ring-1 ring-inset ring-orange-400/25">
    <Flame aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
    {streak}
    <span className="sr-only">win streak</span>
  </span>
);

// Module scope, so a re-render of the dialog updates the places and rows in
// place instead of remounting them (which replayed every entrance animation).
const PodiumPlace = ({ player }) => {
  const p = PODIUM[player.rank];
  return (
    <li className={`flex min-w-0 flex-col items-center ${PODIUM_COLUMN[player.rank]}`}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 + rowDelay(player.rank), duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex w-full min-w-0 flex-col items-center text-center"
      >
        {player.rank === 1 && (
          <Crown aria-hidden="true" className="mb-1 h-5 w-5 text-brass-300" fill="currentColor" strokeWidth={1.8} />
        )}
        <div
          className={`${p.medal} shrink-0 rounded-full p-[3px]`}
          style={{ background: p.metal, boxShadow: `0 0 24px ${p.halo}, 0 10px 18px -8px rgba(0, 0, 0, 0.8)` }}
        >
          <div className={`grid h-full w-full place-items-center rounded-full bg-night-900 font-display font-extrabold leading-none ${p.tone} ${p.numeral}`}>
            <span><span className="sr-only">Rank </span>{player.rank}</span>
          </div>
        </div>
        {/* Up to three lines: a twenty-character name in a 320px podium
            column needs them. It wraps between its words where it has any
            (BreakableName); break-words is only for one unbroken run. */}
        <div className="mt-2 line-clamp-3 w-full break-words font-display text-[13px] font-bold leading-tight text-white min-[360px]:text-sm sm:text-base">
          <BreakableName name={player.name} />
        </div>
        <Trophies value={player.trophies} className={`mt-1 text-sm ${p.tone}`} />
        {/* Stacked on a phone, where a podium column is under 100px wide. */}
        <div className="mt-0.5 flex flex-col items-center text-[11px] leading-snug text-plush-300 sm:flex-row sm:gap-1">
          <span className="whitespace-nowrap">Level {player.level}</span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span className="whitespace-nowrap">{player.wins} wins</span>
        </div>
        {player.streak >= 5 && <div className="mt-1.5"><Streak streak={player.streak} /></div>}
      </motion.div>
      {/* The step: a polished metal lip, lit from above in the place's own
          colour and falling off into the floor. */}
      <div
        aria-hidden="true"
        className={`relative mt-3 w-full overflow-hidden rounded-t-xl ${p.plinth}`}
        style={{ background: `linear-gradient(180deg, ${p.light} 0%, rgba(255, 255, 255, 0.025) 100%)` }}
      >
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: p.metal }} />
        <div className="absolute inset-x-0 top-[3px] h-px bg-white/10" />
      </div>
    </li>
  );
};

const LeaderboardRow = ({ player, isPlayer = false }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: rowDelay(player.rank), duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    className={`relative flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 sm:gap-3 sm:px-3 ${isPlayer
      ? 'trim-brass bg-brass-400/[0.08] shadow-[0_0_28px_-10px_rgba(251,191,36,0.55)]'
      : 'bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] transition-colors hover:bg-white/[0.06]'}`}
  >
    <div
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-[13px] font-extrabold tabular-nums sm:h-10 sm:w-10 sm:text-sm ${isPlayer
        ? 'bg-brass-400/15 text-brass-200 ring-1 ring-inset ring-brass-300/40'
        : 'bg-white/5 text-plush-200 ring-1 ring-inset ring-white/10'}`}
    >
      {/* No rank until the board has loaded: a bare dash, not "#—". Past
          the board, "50+" (see placeOnBoard), said in full for a screen
          reader. */}
      {typeof player.rank === 'number' ? `#${player.rank}` : player.rank === `${BOARD_SIZE}+` ? (
        <span><span aria-hidden="true">{player.rank}</span><span className="sr-only">Outside the top {BOARD_SIZE}</span></span>
      ) : player.rank}
    </div>

    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`truncate font-display font-bold leading-tight ${isPlayer ? 'text-brass-200' : 'text-plush-100'}`}>
          {player.name}
        </span>
        {/* night-950 on brass-400: 8.9:1 (a11y.spec.js waits for the row's
            fade before sampling it). */}
        {isPlayer && <span className="shrink-0 rounded bg-brass-400 px-1.5 py-[3px] text-[10px] font-extrabold leading-none tracking-wider text-night-950">YOU</span>}
      </div>
      {/* The streak rides on the meta line, not the name's: beside the name
          and the YOU badge it squeezed a 320px row's name down to two
          letters. */}
      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-plush-300">
        <span className="whitespace-nowrap">Level {player.level} · {player.wins} wins</span>
        {player.streak >= 5 && <Streak streak={player.streak} />}
      </div>
    </div>

    <Trophies value={player.trophies} className={`text-[15px] ${isPlayer ? 'text-brass-200' : 'text-white'}`} />
  </motion.div>
);

// The panel the loading / error / empty states share.
const StatePanel = ({ tone = 'neutral', children }) => (
  <div
    className={`flex flex-col items-center rounded-xl px-5 py-9 text-center ring-1 ring-inset sm:px-6 sm:py-10 ${tone === 'error'
      ? 'bg-red-950/30 ring-red-400/25'
      : 'bg-night-950/40 ring-white/[0.06]'}`}
  >
    {children}
  </div>
);

const Leaderboard = ({ onClose }) => {
  const { playerName, level, totalWins, bestWinStreak, getLeaderboardExperience } = useGameStore();
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dialogRef = useDialog(onClose);
  const listRef = useRef(null);

  const playerTrophies = calculateTrophies(totalWins, level, bestWinStreak);

  // Fetch leaderboard data from Supabase
  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
        // Read from the leaderboard view, which exposes only ranking columns
        // (no coins balance, no user_id) across all players.
        const { data, error: fetchError } = await supabase
          .from('leaderboard')
          .select('username, wins, losses, experience, best_win_streak')
          .limit(BOARD_SIZE);

        if (fetchError) throw fetchError;

        // Transform data to match expected format with trophies calculation
        const transformedData = (data || []).map((player, index) => {
          const playerLevel = calculateLevel(player.experience);
          const trophies = calculateTrophies(player.wins, playerLevel, player.best_win_streak);
          return {
            rank: index + 1,
            name: player.username || 'Unknown Player',
            level: playerLevel,
            wins: player.wins || 0,
            experience: player.experience || 0,
            streak: player.best_win_streak || 0,
            trophies: trophies,
          };
        });

        // Sort by trophies and re-rank
        transformedData.sort((a, b) => b.trophies - a.trophies);
        transformedData.forEach((player, index) => {
          player.rank = index + 1;
        });

        setLeaderboardData(transformedData);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError(err.message || 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Retry lives in the error panel, which unmounts the moment loading starts,
  // so the control the player just pressed vanishes under them. Left alone,
  // focus fell to <body> and the next Tab restarted at the top of the dialog.
  // It goes to the list's region instead: it outlasts every state, it holds
  // the announcements below, and a failed retry's new Retry button is the
  // next stop after it.
  const retry = () => {
    listRef.current?.focus({ preventScroll: true });
    fetchLeaderboard();
  };

  // Calculate player's rank based on real leaderboard data
  // null until a fetch has actually returned rows. The rank is derived from
  // leaderboardData, which starts [] and STAYS [] when the fetch fails — so an
  // ungated `filter(...).length + 1` is 1, and the panel confidently told every
  // player "Your Current Rank: #1 — You're in the top 3! Keep it up!" while the
  // list beneath it was showing a network error. The list was gated on
  // loading/error; this was not.
  const rankKnown = !loading && !error && leaderboardData.length > 0;
  const playerRank = rankKnown
    ? placeOnBoard(leaderboardData, { trophies: playerTrophies, wins: totalWins, experience: getLeaderboardExperience() })
    : null;

  // The top three stand on the podium; everyone else is a row beneath it.
  const podium = leaderboardData.slice(0, 3);
  const rest = leaderboardData.slice(3);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Leaderboard"
      // The scrim scrolls and the panel centres with my-auto (not
      // items-center: a centred flex item taller than its box overflows at
      // both ends).
      className="fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto p-3 sm:p-6"
    >
      {/* Capped to the viewport, with the header, the scope bar and Your
          Ranking pinned and only the list scrolling, only where the screen is
          tall enough to spare that: the pinned chrome is about 236px. On a
          short screen — a landscape phone, a laptop at 200% zoom — a capped
          panel left the podium a window of about 40-100px, and none at all at
          400%. Below 600px the panel takes its natural height instead, so Your
          Ranking scrolls with the list and the scrim scrolls the whole of it. */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl dialog-panel [@media(min-height:600px)]:max-h-[calc(100dvh-1.5rem)] sm:[@media(min-height:600px)]:max-h-[calc(100dvh-3rem)]"
      >
        {/* Amber light over the bar, pooled behind the title. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgba(251,191,36,0.12),transparent_70%)]"
        />

        {/* Header */}
        <div className="relative flex items-center gap-3 px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
          <Medallion icon={Trophy} />
          {/* Which board this is, as a caption: there is one scope, so it is
              a fact about the board, not a choice. It used to be a segmented
              control holding a single always-pressed "Global" key (a tab
              stop that did nothing) beside an "All Time" pill styled like a
              filter. Bring the control back when a second scope exists. */}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-extrabold leading-none text-brass-gradient sm:text-3xl">
              Leaderboard
            </h2>
            {/* One line: at 320 the globe gives way, or "All time" wrapped. */}
            <p className="label-caps mt-1.5 flex items-center gap-1.5 whitespace-nowrap text-plush-300">
              <Globe aria-hidden="true" className="h-3.5 w-3.5 shrink-0 max-[359px]:hidden" strokeWidth={2.2} />
              Global · All time
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`btn-glass grid h-10 w-10 shrink-0 place-items-center rounded-xl text-plush-200 hover:text-white ${FOCUS_OUTLINE}`}
            aria-label="Close leaderboard"
          >
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>

        {/* No 'Friends' tab: it rendered a "Coming Soon!" panel with a
            disabled "Connect Social Account" button, promising social login
            that has no implementation behind it. A tab that costs a click and
            delivers nothing is worse than no tab — restore it alongside the
            real friendships/RLS work, not before. */}
        {/* No 'Rewards' tab either, and for the same reason. It rendered a
            "Season End Rewards" table promising 500 gems / 5,000 coins / 10
            packs for finishing first, down to 25/250/1 for the top 100, next
            to a live countdown of days left in the season. RANK_REWARDS was
            referenced by exactly one thing: the map that drew it. No grant
            exists anywhere — not in the store, not in a migration, not in
            either edge function — so the season ends and nobody is ever paid.
            Advertising a payout with no code behind it is the same defect as
            the Friends tab above, only more expensive for the player, who
            grinds for it. Restore it with the payout, not before. */}
        {/* Your Position — pinned above the list (on a tall enough screen),
            so it stays in view while the top fifty scroll beneath it. */}
        <div className="relative px-4 pb-4 sm:px-6">
          <h3 className="label-caps mb-2 text-brass-300">Your Ranking</h3>
          <LeaderboardRow
            player={{
              rank: playerRank ?? '—',
              name: playerName,
              level: level,
              wins: totalWins,
              // The best streak, as every other row shows (best_win_streak)
              // and as the trophies are counted from. The current one made
              // this row disagree with the board about the same player.
              streak: bestWinStreak,
              trophies: playerTrophies,
            }}
            isPlayer={true}
          />
        </div>

        {/* Content. Focusable, because its rows hold no controls: without a
            tab stop a keyboard user could not scroll the list at all. A plain
            element, so its focus may be an (inset) ring. */}
        <div
          ref={listRef}
          role="region"
          aria-labelledby="leaderboard-top-players"
          tabIndex={0}
          className="relative min-h-0 flex-1 overflow-y-auto border-t border-white/[0.06] px-4 pb-5 pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brass-300/70 sm:px-6"
        >
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Top Players */}
                <div className="mb-3 flex items-center gap-3">
                  <h3 id="leaderboard-top-players" className="label-caps shrink-0 text-plush-300">Top Players</h3>
                  <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                </div>

                {/* The board's state, spoken. One status region that stays
                    mounted through loading, empty and loaded, so each change
                    is announced: the panels used to swap in and out silently,
                    and a screen-reader player on Close never heard that the
                    list had loaded, had failed, or had a Retry to offer. The
                    failure is an alert of its own, outside it, so it is
                    announced once rather than by both. */}
                <div role="status">
                  {loading && (
                    <StatePanel>
                      {/* A CSS spin on the compositor; it stops with the
                          Animations switch and with reduced motion. */}
                      <div className="relative mb-4 h-14 w-14" aria-hidden="true">
                        <div className="absolute inset-0 rounded-full border-2 border-white/10 border-t-brass-300 motion-safe:animate-spin" />
                        <div className="absolute inset-0 grid place-items-center text-2xl">🧸</div>
                      </div>
                      <p className="text-plush-200">Loading leaderboard...</p>
                    </StatePanel>
                  )}

                  {!loading && !error && leaderboardData.length === 0 && (
                    <StatePanel>
                      {/* The icon is passed as a child to keep its lighter
                          1.8 stroke. */}
                      <Medallion metal={RARITY_METAL.common} size="md" className="mb-4">
                        <Trophy className="h-6 w-6 text-plush-300" strokeWidth={1.8} />
                      </Medallion>
                      <p className="text-plush-200">No players yet. Be the first!</p>
                    </StatePanel>
                  )}

                  {!loading && !error && leaderboardData.length > 0 && (
                    <span className="sr-only">
                      {leaderboardData.length} {leaderboardData.length === 1 ? 'player' : 'players'} ranked.
                    </span>
                  )}
                </div>

                {error && (
                  <StatePanel tone="error">
                    <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-red-500/10 ring-1 ring-inset ring-red-400/40" aria-hidden="true">
                      <TriangleAlert className="h-6 w-6 text-red-300" strokeWidth={2} />
                    </div>
                    {/* The message alone is the alert; Retry follows it. */}
                    <div role="alert" className="flex flex-col items-center">
                      <p className="font-display text-lg font-bold leading-tight text-red-300">Error loading leaderboard</p>
                      <p className="mt-1.5 max-w-sm break-words text-sm text-plush-300">{error}</p>
                    </div>
                    <button
                      type="button"
                      onClick={retry}
                      className={`btn-brass mt-5 inline-flex h-11 items-center gap-2 rounded-xl px-5 font-display font-bold ${FOCUS_OUTLINE}`}
                    >
                      <RotateCcw aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
                      Retry
                    </button>
                  </StatePanel>
                )}

                {!loading && !error && podium.length > 0 && (
                  // Held to a podium's width on a wide panel, so the three
                  // steps stand together instead of spreading to the edges.
                  <div className="mx-auto max-w-lg px-1 sm:px-2">
                    <ol className="grid grid-cols-3 items-end gap-1.5 min-[360px]:gap-2 sm:gap-4">
                      {podium.map(player => (
                        <PodiumPlace key={player.rank} player={player} />
                      ))}
                    </ol>
                    {/* The floor the steps stand on. */}
                    <div aria-hidden="true" className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  </div>
                )}

                {!loading && !error && rest.length > 0 && (
                  <ol start={4} className="mt-4 space-y-2">
                    {rest.map(player => (
                      <li key={player.rank}>
                        <LeaderboardRow player={player} />
                      </li>
                    ))}
                  </ol>
                )}
              </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Leaderboard;
