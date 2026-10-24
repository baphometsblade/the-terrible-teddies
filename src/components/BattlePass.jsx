import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Crown, Lock, Check, Clock, Gem, X, Sparkles, Swords, Coins, Drama, PartyPopper, Hourglass,
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { useGameStore, ALL_CARDS, BATTLE_XP, coinsForDuplicate } from '../stores/gameStore';
import { getDailyChallenges, getWeeklyChallenges } from '../stores/challenges';
import { getCurrentSeason, formatSeasonEnd, SEASON_ENDING_DAYS } from '../utils/season';
import { celebrate } from '@/lib/celebrate';
import { useDialog } from '@/hooks/useDialog';
import { RARITY, RARITY_METAL } from '@/lib/rarity';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';
import { ignoreKeyRepeat } from '@/lib/keyRepeat';
import { Medallion, WalletChips } from '@/components/ui/game-chrome';
import { ArtOrEmoji } from './TeddyCard';
import { PACK_LOOK, PackStack } from './PackArt';
import { frameFor, EMOTES } from '@/lib/cosmetics';
import {
  BATTLE_PASS_REWARDS, PREMIUM_PASS_PRICE, currentTier as tierFor, canClaim, readyRewards, countReadyRewards,
  premiumTotals, listOf,
} from '@/lib/battlePass';

// Plain <button>s throughout, not the shadcn Button: its bg-primary is a
// utility and would beat the btn-brass / btn-glass materials.
//
// Every control here takes FOCUS_OUTLINE, not a ring: each carries a material
// or, on a claimable tile, a warm glow, and a ring (a box-shadow) would
// replace it.

// The edge of a tile you can claim right now: polished brass, whatever the
// reward's rarity, so "this one is yours" reads before anything else does.
const BRASS_EDGE = 'linear-gradient(180deg, #fde68a 0%, #fbbf24 45%, #b45309 100%)';

// The rail's recessed well, and the spine that stays pinned over it as the
// rail scrolls. Same solid colour, so tiles slide under the spine cleanly.
const WELL = 'bg-[#140e1d]';

// Shared by the tiles and the spine's row labels so the two stay aligned.
const TILE_H = 'h-[7.75rem]';

// A reward in words, for screen readers: the tile draws it as a picture, an
// amount and a rarity, none of which says "coins" or "card" on its own.
// `owned` is set for a card or cosmetic the player already has (see ownedNote).
const describeReward = (reward, owned = null) => {
  const n = reward.amount;
  const what = (() => {
    switch (reward.type) {
      case 'coins': return `${n} coins`;
      case 'gems': return `${n} gems`;
      case 'pack': return `${n} card pack${n === 1 ? '' : 's'}`;
      case 'card': return `${reward.name}, ${reward.rarity} card`;
      default: return reward.name ?? `${n ?? ''} ${reward.type}`.trim();
    }
  })();
  if (!owned) return what;
  return owned.coins
    ? `${what}. You already own it: claiming pays ${owned.coins} coins instead`
    : `${what}. You already own it`;
};

// What a reward looks like, drawn in the tile's 32px slot rather than as a
// platform emoji (which read as stickers next to the card art, and drew every
// card reward as the same playing-card glyph): coins and gems on a medallion,
// packs as the packs the Shop sells, a card as a small frame of its rarity's
// metal around its own art, a border as a swatch of the metal it puts on
// your cards, an emote on a medallion of its own.
const EMOTE_ICON = { quip: Drama, confetti: PartyPopper };
const CARDS_BY_ID = new Map(ALL_CARDS.map((c) => [c.id, c]));
// The face under a mini frame's art, as a padding-box layer.
const FACE = 'linear-gradient(#1a1226, #1a1226) padding-box';

const RewardArt = ({ reward }) => {
  switch (reward.type) {
    case 'coins':
      return <Medallion size="xs" icon={Coins} />;
    case 'gems':
      return <Medallion size="xs" icon={Gem} metal={RARITY_METAL.epic} iconClassName="text-fuchsia-300" />;
    case 'pack':
      return <PackStack look={PACK_LOOK.regular} quantity={reward.amount} size="xs" />;
    case 'card': {
      const card = CARDS_BY_ID.get(reward.cardId) ?? { id: reward.cardId, rarity: reward.rarity };
      return (
        <span
          data-reward-art="card"
          className="relative block h-8 w-[23px] overflow-hidden rounded-[4px] shadow-[0_4px_8px_-4px_rgba(0,0,0,0.9)]"
          style={{ border: '1.5px solid transparent', background: `${FACE}, ${RARITY_METAL[reward.rarity]} border-box` }}
        >
          <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-[2.5px]">
            <ArtOrEmoji teddy={card} emojiClassName="text-sm leading-none" imgClassName="absolute inset-0 h-full w-full object-cover" />
          </span>
        </span>
      );
    }
    case 'exclusive': {
      const frame = frameFor(reward.name);
      if (frame) {
        // A card-shaped window in the border's own metal: what it frames
        // your cards in.
        return (
          <span
            data-reward-art="border"
            className="block h-8 w-[23px] rounded-[4px]"
            style={{ border: '3px solid transparent', background: `${FACE}, ${frame.metal} border-box`, boxShadow: frame.glow }}
          />
        );
      }
      const effect = EMOTES.find((e) => e.name === reward.name)?.effect;
      return <Medallion size="xs" icon={EMOTE_ICON[effect] ?? Sparkles} />;
    }
    default:
      return null;
  }
};

// Hoisted to module scope for a stable component identity. Declared inside
// BattlePass it got a fresh type every render, so claiming a reward (or any
// toast) remounted all 30 tiles and replayed their entrance. The parent now
// passes the derived unlocked/claimed/canClaim flags and the claim handler.
//
// Only a claimable tile is a button (a native one). There are 50 tiles on this
// track and only the claimable ones may present as controls: a locked or
// already-claimed tier that still offered "Claim tier N reward" did nothing
// when activated — a screen-reader player tabbing the pass heard fifty offers
// and could act on none. Every other tile is ordinary content, and says in
// text what state it is in rather than with an overlay over its name.
//
// Claiming swaps the button for a plain tile, which takes the focused element
// out of the document: focus fell to <body>, and the next Tab sent useDialog
// back to the dialog's first control, three or four stops from the rail, once
// per claim. So a tile claimed while its button had focus takes focus itself
// (tabIndex -1, never a tab stop) and says "Claimed", and the next Tab goes on
// from there to the next tile. preventScroll: it is the same spot, and the
// rail must not move under the player.
//
// `owned` ({ coins } or null) marks a card or cosmetic the player already has,
// before it is claimed: a card pays its duplicate coins instead, a cosmetic
// nothing more. The tile says so, so claiming it holds no surprise.
const RewardCard = ({ reward, isPremium, tier, isUnlocked, isClaimed, canClaim, owned = null, onClaim }) => {
  const tileRef = useRef(null);
  const refocus = useRef(false);
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    if (!canClaim) tileRef.current?.focus({ preventScroll: true });
  });

  const label = reward.type === 'card' || reward.type === 'exclusive'
    ? reward.name
    : `${reward.amount ? '+' + reward.amount : ''}`;
  const state = isClaimed ? 'claimed'
    : canClaim ? 'claim'
    : !isUnlocked ? 'locked'
    : 'needs-premium';
  const quiet = state === 'claimed' || state === 'locked';
  // Once claimed it is owned whichever way it went; "Owned" is for before.
  const showOwned = !!owned && !isClaimed;
  const metal = state === 'claim' ? BRASS_EDGE : reward.rarity ? RARITY_METAL[reward.rarity] : null;
  const track = isPremium ? 'premium' : 'free';

  const fill = state === 'claim'
    ? 'bg-[linear-gradient(180deg,#4a3413_0%,#24170f_100%)]'
    : state === 'claimed'
      ? 'bg-[#17111f]'
      : isPremium
        ? 'bg-[linear-gradient(180deg,#3a2a1f_0%,#1f1628_100%)]'
        : 'bg-[linear-gradient(180deg,#2c2240_0%,#1d1529_100%)]';

  const body = (
    <>
      {/* The 1px edge: rarity metal for cards, a quiet hairline otherwise,
          brass when claimable. A layer of its own so a locked tile can dim its
          edge without dimming its text. */}
      <span
        aria-hidden="true"
        className={`absolute inset-0 rounded-xl ${metal ? '' : isPremium ? 'bg-brass-300/40' : 'bg-white/15'} ${
          state === 'claim' ? '' : state === 'needs-premium' ? 'opacity-80' : quiet ? 'opacity-40' : ''}`}
        style={metal ? { background: metal } : undefined}
      />
      <span className={`relative flex h-full flex-col items-center rounded-[11px] px-1.5 pt-3 pb-2 ${fill}`}>
        {/* The reward in words, then the drawing aria-hidden. A locked or
            claimed tile dims the drawing only (TeddyCard's dimmed treatment),
            so its words stay readable. */}
        {!canClaim && <span className="sr-only">Tier {tier} {track} reward: {describeReward(reward, showOwned ? owned : null)}.</span>}
        <span aria-hidden="true" className={`grid h-8 place-items-center ${quiet ? 'saturate-[0.3] brightness-[0.55]' : ''}`}>
          <RewardArt reward={reward} />
        </span>
        <span aria-hidden="true" className="mt-2 flex h-7 w-full items-center justify-center">
          <span className={`line-clamp-2 break-words text-center font-display text-[11px] font-bold leading-[0.875rem] sm:text-[12px] ${quiet ? 'text-plush-300' : 'text-white'}`}>
            {label}
          </span>
        </span>
        {/* Under the name: "Owned" (and what claiming it pays instead) for
            something the player already has, else a card's rarity. The
            frame's metal still says the rarity of an owned card. */}
        {showOwned ? (
          <span aria-hidden="true" data-owned="" className="inline-flex h-3 items-center gap-0.5 text-[9px] font-bold leading-3 text-emerald-300">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
            Owned
            {owned.coins > 0 && (
              <>
                <span className="text-plush-300">·</span>
                <span className="text-brass-200">+{owned.coins}</span>
                <Coins className="h-2.5 w-2.5 text-brass-300" strokeWidth={2.6} />
              </>
            )}
          </span>
        ) : reward.rarity && (
          <span aria-hidden="true" className={`label-caps text-[8px] leading-3 ${RARITY[reward.rarity].text}`}>
            {reward.rarity}
          </span>
        )}
        <span className="mt-auto flex h-5 items-center">
          {state === 'claim' && (
            <span className="btn-brass inline-flex h-5 items-center rounded-full px-2.5 label-caps text-[9px]">Claim</span>
          )}
          {state === 'claimed' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-plush-300">
              <Check aria-hidden="true" className="h-3 w-3 text-emerald-300" strokeWidth={3} />
              Claimed
            </span>
          )}
          {state === 'locked' && (
            <>
              <Lock aria-hidden="true" className="h-3 w-3 text-plush-300" strokeWidth={2.5} />
              <span className="sr-only">Locked</span>
            </>
          )}
          {/* "Premium" is all the tile has room for; a screen reader also
              hears that it is the pass this tier is waiting on. */}
          {state === 'needs-premium' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brass-300">
              <Crown aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
              Premium<span className="sr-only"> Pass required</span>
            </span>
          )}
        </span>
      </span>
    </>
  );

  if (!canClaim) {
    return (
      <div
        ref={tileRef}
        tabIndex={isClaimed ? -1 : undefined}
        className={`relative block w-full rounded-xl p-px ${TILE_H} ${isClaimed ? FOCUS_OUTLINE : ''}`}
      >
        {body}
      </div>
    );
  }
  // The name opens with the action, as before, and then says what it hands
  // out: a button's label replaces everything drawn inside it, so "Claim tier
  // 4 premium reward" alone never said that tier 4 is Chainsmoke Chad.
  return (
    <button
      type="button"
      onClick={(e) => {
        refocus.current = e.currentTarget === document.activeElement;
        onClaim();
      }}
      aria-label={`Claim tier ${tier} ${track} reward: ${describeReward(reward, showOwned ? owned : null)}`}
      className={`sheen relative block w-full rounded-xl p-px ${TILE_H} cursor-pointer transition-transform duration-150 hover:-translate-y-0.5
        shadow-[0_0_20px_-4px_rgba(251,191,36,0.6)] ${FOCUS_OUTLINE}`}
    >
      {body}
    </button>
  );
};


// What a battle and today's challenges pay in season XP, from the figures
// that pay it: BATTLE_XP (recordBattleResult) and the challenges on today's
// and this week's boards whose reward is XP and that are not yet claimed. The
// footer used to say "Win battles and complete daily challenges to earn XP!",
// and on most days none of the challenges on the board paid any.
const xpSources = (claimedChallenges = []) => {
  const challenges = [
    ...getDailyChallenges().map((c) => ({ ...c, when: 'Today' })),
    ...getWeeklyChallenges().map((c) => ({ ...c, when: 'This week' })),
  ].filter((c) => c.reward?.type === 'xp' && !claimedChallenges.includes(c.id));
  return {
    battles: `Win or lose, every battle earns XP: +${BATTLE_XP.win} for a win, +${BATTLE_XP.loss} for a loss.`,
    challenges: challenges.map((c) => `${c.when}'s challenge “${c.name}” pays +${c.reward.amount} XP.`),
  };
};

const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

// One line of the confirm's list, with a quieter second line under it.
const Includes = ({ children, note }) => (
  <li className="flex items-start gap-2.5">
    <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" strokeWidth={2.5} />
    <span>
      {children}
      {note && <span className="mt-0.5 block text-xs text-plush-300">{note}</span>}
    </span>
  </li>
);

// The Unlock-Premium confirmation is a modal over the Battle Pass dialog, so it
// hosts its own useDialog: it pushes onto the dialog stack (so it owns Escape and
// its own focus trap), moves focus into itself, and carries role=dialog/aria-modal.
// Without it, the outer BattlePass trap treated the 50-tile reward track and the
// confirm buttons as one flat focus set — Tab walked the whole background behind
// the overlay before reaching Purchase/Cancel. Matches SaveDeckDialog / CardDetailDialog.
//
// Everything it promises is read from the reward table and the player's own
// save, and it states the term: it sold "3 guaranteed legendary cards" (which
// turn into coins if already owned) and never said the pass lasts one season.
const PurchaseConfirmDialog = ({
  gems, price, season, seasonXP, readyOnUnlock, ownedCards, unlockedCosmetics, onPurchase, onGetGems, onClose,
}) => {
  const ref = useDialog(onClose);
  // Opens on Cancel, not Purchase. useDialog focuses the first control, and
  // that is Purchase: an Enter held down on "Unlock Premium" auto-repeats into
  // the confirm and spends the gems before the price has been seen. Declared
  // after useDialog, so its effect runs second — useDialog has already noted
  // the Unlock button as the place to hand focus back to.
  const cancelRef = useRef(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const totals = premiumTotals();
  const premiumTiers = BATTLE_PASS_REWARDS.filter((r) => r.premium).length;
  const legendaries = totals.cards.filter((c) => c.rarity === 'legendary').length;
  const ownedPassCards = totals.cards.filter((c) => ownedCards.includes(c.cardId));
  const ownedPassCoins = ownedPassCards.reduce((n, c) => n + coinsForDuplicate(c.cardId), 0);
  const emotes = totals.exclusives.filter((name) => !frameFor(name));
  const borders = totals.exclusives.filter((name) => frameFor(name));
  const ownedExclusives = totals.exclusives.filter((name) => unlockedCosmetics.includes(name));
  const last = BATTLE_PASS_REWARDS[BATTLE_PASS_REWARDS.length - 1];
  const xpLeft = Math.max(0, last.xpRequired - seasonXP);
  const ending = season.daysLeft <= SEASON_ENDING_DAYS;
  const short = gems < price;

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Unlock Premium Pass"
      // The hold that opened it keeps repeating on Cancel, which closed it.
      onKeyDown={ignoreKeyRepeat}
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0.9 }}
      className="relative my-auto w-full max-w-md overflow-hidden rounded-2xl dialog-panel trim-brass px-5 pt-7 pb-6 text-center sm:px-6"
      onClick={e => e.stopPropagation()}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(251,191,36,0.24),transparent_70%)]"
      />
      {/* flex: block-level, so mx-auto centres it on a line of its own
          (Medallion is inline-block). The icon is passed as children only to
          keep its lighter 1.75 stroke. Shed on a short screen, where the
          confirm already scrolls. */}
      <Medallion size="lg" className="mx-auto mb-3 flex [@media(max-height:700px)]:hidden">
        <Crown className="h-7 w-7 text-brass-300" strokeWidth={1.75} />
      </Medallion>
      <h3 className="relative font-display text-2xl sm:text-3xl font-extrabold leading-tight text-brass-gradient">
        Unlock Premium Pass
      </h3>

      <div className="relative mt-4 rounded-xl bg-black/25 p-4 text-left ring-1 ring-white/5">
        {/* The list is the whole track added up, and says so: it was headed
            "On every premium tier you reach", which read as each tier paying
            all of it. How much of the track is reached already is beside it,
            and how far the rest is sits with the term below. */}
        <div className="label-caps text-plush-300">{`Across all ${premiumTiers} premium tiers:`}</div>
        <p data-pass-reached="" className="mb-3 mt-1 text-xs leading-snug text-plush-300">
          {'Each tier’s reward is yours when you reach it.'}
          {readyOnUnlock > 0 && ` You have reached ${readyOnUnlock === premiumTiers ? `all ${readyOnUnlock}` : readyOnUnlock} already: ${
            readyOnUnlock === 1 ? 'it is' : 'they are'} ready to claim the moment you unlock.`}
        </p>
        <ul className="space-y-2.5 text-sm text-plush-100">
          <Includes
            note={ownedPassCards.length > 0
              ? `You own ${listOf(ownedPassCards.map((c) => c.name))} already: ${ownedPassCards.length === 1 ? 'it pays' : 'those pay'} ${ownedPassCoins.toLocaleString()} coins instead.`
              : 'Any you already own pay their duplicate coins instead.'}
          >
            {`${plural(totals.cards.length, 'card')}, ${legendaries} of them legendary`}
          </Includes>
          <Includes>
            {`+${totals.gems.toLocaleString()} gems, +${totals.coins.toLocaleString()} coins and ${plural(totals.packs, 'card pack')}`}
          </Includes>
          <Includes note={ownedExclusives.length > 0 ? `You already have ${listOf(ownedExclusives)}.` : null}>
            {`${listOf(borders)} card frames and ${plural(emotes.length, 'emote')}, yours to keep`}
          </Includes>
        </ul>
      </div>

      {/* The term, beside the price it is paid at: one season, and what
          happens at its end. Here rather than above the list so that on a
          short phone, where the confirm scrolls and opens at its buttons,
          the term is on screen with them. */}
      <div data-pass-term="" className="relative mt-4 text-sm leading-snug text-plush-200">
        <p>
          Premium lasts for <span className="font-semibold text-white">{season.name}</span>, which ends{' '}
          <span className="whitespace-nowrap font-semibold text-white">{formatSeasonEnd(season.endDate)}</span>{' '}
          ({plural(season.daysLeft, 'day')} from now).
        </p>
        <p className="mt-1.5 text-xs text-plush-300">
          Then XP, tiers and Premium reset. Tiers you reached but did not claim are delivered to you, and
          cards and cosmetics stay yours.
        </p>
        {/* What is left to earn, in wins (what a win pays, from BATTLE_XP).
            Rose in the season's last days, when that is the thing to know
            before paying. */}
        {xpLeft > 0 && (
          <p data-pass-pace="" className={`mt-1.5 text-xs ${ending ? 'font-semibold text-rose-300' : 'text-plush-300'}`}>
            {`${ending ? `Only ${plural(season.daysLeft, 'day')} left: t` : 'T'}ier ${last.tier} is ${xpLeft.toLocaleString()} XP away, about ${plural(Math.ceil(xpLeft / BATTLE_XP.win), 'win')}.`}
          </p>
        )}
      </div>

      <div className="relative mt-5">
        <div className="label-caps text-plush-300">Price</div>
        <div className="mt-1 flex items-center justify-center gap-2 font-display text-4xl font-extrabold leading-none text-white tabular-nums">
          <Gem aria-hidden="true" className="h-7 w-7 text-fuchsia-300" strokeWidth={2.2} />
          {price}
          <span className="sr-only"> gems</span>
        </div>
        <div className={`mt-2 text-sm ${short ? 'text-rose-300' : 'text-plush-300'}`}>
          {short ? `You have ${gems} gems: ${price - gems} short.` : `You have ${gems} gems.`}
        </div>
      </div>

      {/* Brass for the way forward: Purchase while it can be bought, and a
          route to gems while it cannot (it used to be a disabled Purchase,
          with nowhere to go but Cancel). */}
      <div className="relative mt-6 flex gap-3">
        {short && onGetGems ? (
          <button
            type="button"
            onClick={onGetGems}
            className={`btn-brass inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl font-display font-bold ${FOCUS_OUTLINE}`}
          >
            <Gem aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
            Get gems
          </button>
        ) : (
          <button
            type="button"
            onClick={onPurchase}
            disabled={short}
            className={`h-11 flex-1 rounded-xl font-display font-bold ${FOCUS_OUTLINE} ${
              short ? 'btn-glass cursor-not-allowed text-plush-400 opacity-70' : 'btn-brass'}`}
          >
            Purchase
          </button>
        )}
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          className={`btn-glass h-11 flex-1 rounded-xl font-display font-bold ${FOCUS_OUTLINE}`}
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
};

// `onGetGems` (from App) closes the pass and opens the Shop on its gems tab.
const BattlePass = ({ onClose, onGetGems }) => {
  const {
    coins, gems, gemDebt, seasonXP, ownedCards, unlockedCosmetics, claimedChallenges,
    hasBattlePassPremium, purchaseBattlePassPremium,
    claimedBattlePassRewards, claimBattlePassTier, syncSeason,
  } = useGameStore();
  const { toast } = useToast();
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);
  const scrollRef = useRef(null);
  const trackRef = useRef(null);
  // Buying the pass swaps the Unlock button for the "Premium Active" badge, so
  // the confirm's close has nothing to hand focus back to and it fell to
  // <body>. Once the confirm has finished leaving, the badge takes it instead.
  const premiumBadgeRef = useRef(null);
  const focusPremiumBadge = useRef(false);
  // Escape targets the innermost layer: dismiss the nested purchase-confirm
  // overlay first, and only close the whole pass when no overlay is open.
  // (useDialog reads the callback through a ref, so this closure stays live.)
  const dialogRef = useDialog(() => (showPurchaseConfirm ? setShowPurchaseConfirm(false) : onClose()));

  // Live season info (recomputed per render) — and roll the pass over on open
  // if the calendar season has advanced since the player last earned XP.
  const season = getCurrentSeason();
  useEffect(() => {
    syncSeason();
  }, [syncSeason]);

  // Open the rail where the action is. Twenty-five tiers do not fit on any
  // screen, and on a phone barely three do, so a tier-15 player used to open
  // the pass on tier 1 with the tier they were on — and everything they could
  // claim — out of sight. Scrolled once, on open (never after a claim, which
  // would slide the rail out from under the player's finger): the current
  // tier and the one after it in view, but never so far that the earliest
  // unclaimed reward leaves the left edge. Read from the rendered rail a frame
  // later rather than from state, so a season rollover that syncSeason applies
  // on this same open is already on screen when it is measured. Measured with
  // layout offsets (against the positioned track), not getBoundingClientRect:
  // the panel is still scaling in on that frame, and client rects are scaled.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const rail = scrollRef.current;
      const current = rail?.querySelector('[data-current-tier]');
      if (!current) return;
      const first = rail.querySelector('[data-ready-tier]') ?? current;
      const spine = rail.querySelector('[data-rail-spine]')?.offsetWidth ?? 0;
      const col = current.offsetWidth;
      // The scroll that puts the next tier's right edge on the rail's.
      const wanted = current.offsetLeft + 2 * col - rail.clientWidth;
      // Whole columns only, so no tile is left half-hidden under the spine —
      // rounded UP: rounding down stops short of `wanted`, and what it cuts is
      // the next tier, on the right (22px of it at 412px wide). The cap needs
      // no rounding: a column's offsetLeft less the spine is already a whole
      // number of columns.
      const target = Math.min(Math.ceil(Math.max(0, wanted) / col) * col, first.offsetLeft - spine);
      rail.scrollLeft = Math.max(0, target);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // The far end of the rail obeys the same whole-columns rule. The browser
  // stops a scroll at scrollWidth − clientWidth, and unless that happens to be
  // a whole number of columns the last stop leaves a sliver of a tier beside
  // the spine (22px of tier 23 at 320px). So the track's right padding takes
  // up the remainder. Laid out before paint (the open-scroll above reads the
  // range a frame later), and again whenever the rail changes width.
  useLayoutEffect(() => {
    const rail = scrollRef.current;
    const track = trackRef.current;
    if (!rail || !track) return undefined;
    const fit = () => {
      const col = track.querySelector('[data-tier-column]')?.offsetWidth;
      if (!col) return;
      const spine = track.querySelector('[data-rail-spine]')?.offsetWidth ?? 0;
      const content = spine + BATTLE_PASS_REWARDS.length * col;
      // 0 to col−1px. Zero is fine: the last column's own px-1 still keeps its
      // tile off the rail's edge, and topping it up to "at least a hair" put a
      // whole blank column at the end of the rail at 390px.
      const pad = (((rail.clientWidth - content) % col) + col) % col;
      track.style.paddingRight = `${pad}px`;
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(rail);
    return () => observer.disconnect();
  }, []);

  const hasPremium = hasBattlePassPremium;
  const claimedRewards = claimedBattlePassRewards;

  const battlePassXP = seasonXP;
  const currentTier = tierFor(battlePassXP);

  const nextTier = BATTLE_PASS_REWARDS.find(r => r.xpRequired > battlePassXP);
  const xpToNext = nextTier ? nextTier.xpRequired - battlePassXP : 0;
  const xpProgress = nextTier 
    ? ((battlePassXP - (BATTLE_PASS_REWARDS[nextTier.tier - 2]?.xpRequired || 0)) / 
       (nextTier.xpRequired - (BATTLE_PASS_REWARDS[nextTier.tier - 2]?.xpRequired || 0))) * 100
    : 100;

  const handlePurchasePremium = () => {
    // One store-side step, so a double-click can't pay twice for one pass (see
    // purchaseBattlePassPremium).
    const outcome = purchaseBattlePassPremium(PREMIUM_PASS_PRICE);
    if (outcome === 'purchased' || outcome === 'already-owned') {
      focusPremiumBadge.current = true;
    }
    if (outcome === 'purchased') {
      setShowPurchaseConfirm(false);
      celebrate({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#fbbf24', '#f59e0b', '#fde68a'] });
      toast({ title: "Premium Pass Unlocked!", description: `Premium rewards on every tier you reach, until ${formatSeasonEnd(season.endDate)}.` });
    } else if (outcome === 'already-owned') {
      setShowPurchaseConfirm(false);
    } else {
      toast({ title: "Not Enough Gems", description: `You need ${PREMIUM_PASS_PRICE} gems.`, variant: "destructive" });
    }
  };

  // Claimed in the store, which checks eligibility itself and says what it
  // really handed over; the toast is worded from that receipt.
  const claimReward = (tier, isPremium) => {
    const out = claimBattlePassTier(tier, isPremium ? 'premium' : 'free');
    if (!out.ok) {
      const why = {
        'not-reached': ['Tier Not Reached', 'Keep playing to unlock this tier!'],
        'needs-premium': ['Premium Required', 'Unlock the Premium Pass to claim this reward!'],
        'already-claimed': ['Already Claimed', "You've already claimed this reward."],
      }[out.reason];
      if (why) toast({ title: why[0], description: why[1], variant: 'destructive' });
      return;
    }
    if (out.alreadyOwned) {
      // A card already owned paid its duplicate coins; a cosmetic already
      // owned is not granted twice. No confetti for either.
      toast({
        title: 'Already owned',
        description: out.card ? `${out.card.name} → +${out.coins} coins` : `You already have ${out.cosmetic}.`,
      });
      return;
    }
    if (out.card || out.cosmetic) {
      celebrate({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      toast(out.card
        ? { title: 'Card Unlocked!', description: `You got ${out.card.name}!` }
        : { title: 'Exclusive Unlocked!', description: `You got ${out.cosmetic}! It stays yours after the season.` });
      return;
    }
    if (out.coins) toast({ title: 'Coins Claimed!', description: `+${out.coins} coins` });
    else if (out.gems) toast({ title: 'Gems Claimed!', description: `+${out.gems} gems` });
    else if (out.packs) toast({ title: 'Packs Claimed!', description: `+${plural(out.packs, 'card pack')}` });
  };

  // One reading of the pass for the "N ready" count (the helper the menu tile
  // badges with too), each tile's canClaim below and the confirm, all through
  // the predicate the store's claim checks, so none of them can disagree.
  const pass = { seasonXP: battlePassXP, claimed: claimedRewards, hasPremium };
  const readyCount = countReadyRewards(pass);
  const lastTier = BATTLE_PASS_REWARDS[BATTLE_PASS_REWARDS.length - 1].tier;
  // In the season's last days the rail says how many rewards are unclaimed and
  // when the season stops: claiming then is the player's call (what is left
  // is delivered at the end either way, so it says that too, rather than
  // pretend it is lost).
  const ending = season.daysLeft <= SEASON_ENDING_DAYS && readyCount > 0;
  // What a reward already owned pays instead, for the tile to say before the
  // claim: a card its duplicate coins, a cosmetic nothing more.
  const ownedOf = (reward) => {
    if (reward.type === 'card' && ownedCards.includes(reward.cardId)) return { coins: coinsForDuplicate(reward.cardId) };
    if (reward.type === 'exclusive' && unlockedCosmetics.includes(reward.name)) return { coins: 0 };
    return null;
  };
  const xp = xpSources(claimedChallenges);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Battle Pass"
      // Scrolls, with the panel centred by my-auto rather than items-center: a
      // centred flex item taller than its box overflows at both ends, which on
      // a short phone put the header — and the close button — out of reach.
      className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative my-auto w-full max-w-5xl overflow-hidden rounded-2xl dialog-panel"
      >
        {/* Header. Amber light pools from the top-left corner, behind the
            medallion; the brass lettering and the one brass button sit in it. */}
        <div className="relative overflow-hidden border-b border-white/5 px-4 pt-4 pb-4 sm:px-6 sm:pt-5 sm:pb-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_150%_at_0%_0%,rgba(251,191,36,0.20),transparent_70%)]"
          />
          {/* A grid, so one set of elements can take two arrangements.

              Below lg: the medallion beside three short lines (title, season,
              countdown) with the close control at the top right, and the
              wallet and the premium button on a row underneath (the button
              full width on a phone, beside the wallet from sm). From lg up,
              one row: title block, countdown, wallet, button, close — below
              that the six do not fit side by side, and the gradient title is
              what gets squeezed out of its column. The wallet is the Shop's
              and Card Packs': this dialog sells a 500-gem pass, and the
              balance it is paid from first appeared in the confirm.

              The title never wraps: a brass gradient stretched over two lines
              of a wrapped heading is drawn as one tall gradient, and it is
              sized down at 320px so it does not have to. The season name is
              never truncated either (it used to be, at 320px). Nothing in this
              row may be wider than the panel: its overflow-hidden would clip
              the close button off the right edge and leave no way out.

              So from lg the title's column never shrinks below the title (a
              gradient title squeezed narrower than its text draws the overflow
              transparent: at 1024 with 48,210 coins it read "Battle Pas"), and
              the wallet is what gives instead: its chips stack, the column
              narrows to the wider one. The countdown and the button do not
              wrap, so the grid has nowhere else to take the space from. */}
          <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1
            lg:grid-cols-[auto_minmax(min-content,1fr)_auto_auto_auto_auto] lg:gap-y-1.5 lg:gap-x-4"
          >
            <Medallion
              size="smToLg"
              icon={Trophy}
              className="col-start-1 row-span-3 row-start-1 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.8)] lg:row-span-2 lg:row-start-1"
            />

            <h2 className="col-start-2 row-start-1 whitespace-nowrap font-display text-[1.75rem] font-extrabold leading-none text-brass-gradient
              min-[360px]:text-3xl lg:self-end lg:text-4xl"
            >
              Battle Pass
            </h2>

            <p className="col-span-2 col-start-2 row-start-2 text-sm font-semibold leading-snug text-plush-200 lg:col-span-1 lg:col-start-2 lg:self-start">
              {season.name}
            </p>

            {/* Phones: one quiet line under the season name. From md up: a
                small-caps label over the count, beside the button. */}
            <div className="col-span-2 col-start-2 row-start-3 flex items-center gap-1.5
              lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:gap-2.5 lg:whitespace-nowrap"
            >
              <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-brass-300 lg:h-4 lg:w-4" strokeWidth={2.2} />
              <div className="flex flex-wrap items-baseline gap-x-1 leading-tight lg:block">
                {/* plush-200 while it sits in the header's amber pool (5.8:1 at
                    the pool's brightest; plush-300 would be 4.2:1 there). */}
                <span className="text-xs font-semibold text-plush-200 lg:block lg:text-[11px] lg:font-bold lg:uppercase lg:tracking-[0.16em] lg:text-plush-300">
                  Season ends in
                </span>
                <span className="text-xs font-bold tabular-nums text-white lg:block lg:font-display lg:text-base">
                  {season.daysLeft} day{season.daysLeft !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Close comes before the premium button in the DOM, wherever the
                grid draws the two: useDialog focuses the first control on open,
                and that must be the way out, not a 500-gem purchase that two
                stray Enters (or one held one) would walk straight through. It
                also makes Tab run top to bottom below lg, where Close sits on
                the first row and the button on the fourth. */}
            <button
              type="button"
              onClick={onClose}
              className={`btn-glass col-start-3 row-start-1 grid h-10 w-10 shrink-0 place-items-center self-start rounded-xl
                lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:self-center ${FOCUS_OUTLINE}`}
              aria-label="Close battle pass"
            >
              <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
            </button>

            {/* One wrapping row below lg; from lg, display: contents hands the
                wallet and the button a grid column each. */}
            <div className="col-span-3 col-start-1 row-start-4 mt-3 flex flex-wrap items-center gap-2 sm:col-span-2 sm:col-start-2 lg:contents">
              <WalletChips
                coins={coins}
                gems={gems}
                gemDebt={gemDebt}
                className="flex-nowrap lg:col-start-4 lg:row-span-2 lg:row-start-1 lg:flex-wrap lg:justify-end"
              />
              <div className="w-full sm:w-auto lg:col-start-5 lg:row-span-2 lg:row-start-1 lg:whitespace-nowrap">
                {!hasPremium && (
                  <button
                    type="button"
                    onClick={() => setShowPurchaseConfirm(true)}
                    onKeyDown={ignoreKeyRepeat}
                    className={`btn-brass sheen relative inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl pl-3.5 pr-1.5
                      font-display font-bold sm:w-auto ${FOCUS_OUTLINE}`}
                  >
                    <Crown aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
                    <span>Unlock Premium</span>
                    <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-night-950 px-2 text-sm text-brass-200 tabular-nums">
                      <Gem aria-hidden="true" className="h-3.5 w-3.5 text-fuchsia-300" strokeWidth={2.4} />
                      {PREMIUM_PASS_PRICE}
                      <span className="sr-only"> gems</span>
                    </span>
                  </button>
                )}
                {hasPremium && (
                  <div
                    ref={premiumBadgeRef}
                    tabIndex={-1}
                    className={`trim-brass relative flex h-11 items-center justify-center gap-2 rounded-xl bg-brass-400/10 px-4 font-display font-bold text-brass-200 sm:inline-flex ${FOCUS_OUTLINE}`}
                  >
                    <Crown aria-hidden="true" className="h-4 w-4 text-brass-300" strokeWidth={2.4} />
                    Premium Active
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Season progress */}
        <div className="px-4 pt-5 sm:px-6">
          <div className="panel-glass flex items-center gap-4 rounded-2xl p-3.5 sm:gap-5 sm:p-4">
            <Medallion size="md" discClassName="font-display text-2xl font-extrabold tabular-nums text-brass-200">
              {currentTier}
            </Medallion>
            <div className="min-w-0 flex-1">
              {/* Past the last tier there is no next one: it used to read
                  "Tier 25 → 26 · 0 XP to next tier", naming a tier that does
                  not exist. */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                {nextTier ? (
                  <>
                    <span className="font-display text-lg font-bold leading-tight text-white">Tier {currentTier} → {currentTier + 1}</span>
                    <span className="text-sm font-semibold tabular-nums text-brass-200">{xpToNext} XP to next tier</span>
                  </>
                ) : (
                  <>
                    <span className="font-display text-lg font-bold leading-tight text-white">Tier {currentTier}</span>
                    <span className="text-sm font-semibold text-brass-200">Max tier reached</span>
                  </>
                )}
              </div>
              <Progress
                value={xpProgress}
                className="mt-2 h-2.5 bg-black/45 ring-1 ring-white/10 [&>div]:bg-gradient-to-r [&>div]:from-brass-300 [&>div]:to-brass-500"
                aria-label={nextTier
                  ? `Battle pass progress: tier ${currentTier}, ${xpToNext} XP to tier ${currentTier + 1}`
                  : `Battle pass progress: tier ${currentTier}, max tier reached`}
              />
              <div className="mt-1.5 text-xs font-semibold tabular-nums text-plush-300">
                Total: {battlePassXP} XP
              </div>
            </div>
          </div>
        </div>

        {/* Rewards track */}
        <div className="px-4 pt-5 sm:px-6">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h3 className="label-caps text-plush-300">Season Rewards</h3>
            {readyCount > 0 && (
              <span className="rounded-full bg-brass-400 px-2 py-[2px] text-[11px] font-extrabold leading-tight text-night-950">
                {readyCount} ready
              </span>
            )}
          </div>
          {ending && (
            <p data-season-ending="" className="-mt-1 mb-2.5 flex items-start gap-1.5 text-xs leading-snug text-brass-200">
              <Hourglass aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0 text-brass-300" strokeWidth={2.4} />
              <span>
                <span className="font-bold text-white">{`${readyCount} unclaimed — claim before ${formatSeasonEnd(season.endDate)}.`}</span>
                {' '}Anything still unclaimed then is delivered to you when the season ends.
              </span>
            </p>
          )}
          {/* A region with a tab stop of its own, so the rail can be scrolled
              from the keyboard even when no tile on it is claimable. */}
          <div
            ref={scrollRef}
            role="region"
            aria-label="Reward tiers"
            tabIndex={0}
            className={`snap-x snap-proximity scroll-pl-8 overflow-x-auto rounded-2xl ${WELL} shadow-[inset_0_2px_12px_rgba(0,0,0,0.6)] ring-1 ring-white/5
              [scrollbar-color:rgba(251,191,36,0.35)_transparent] [scrollbar-width:thin]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300`}
          >
            {/* relative: the columns' offsetLeft is measured from this track.
                Its right padding is set from the rail's width (see the layout
                effect above); pr-2 is only the value before that runs. */}
            <div ref={trackRef} className="relative flex min-w-max pr-2">
              {/* The spine: which row is which, pinned while the tiers scroll
                  under it. Decorative — each tile names its own track. */}
              <div
                aria-hidden="true"
                data-rail-spine
                className={`sticky left-0 z-10 flex w-8 shrink-0 flex-col rounded-l-2xl ${WELL} pt-3 pb-3 shadow-[10px_0_12px_-8px_rgba(0,0,0,0.9)]`}
              >
                <div className="h-8" />
                <div className="mt-1 h-4" />
                <div className={`mt-3 ${TILE_H} flex flex-col items-center justify-center gap-1.5 text-brass-300`}>
                  <Crown className="h-3.5 w-3.5" strokeWidth={2.4} />
                  <span className="label-caps rotate-180 text-[9px] [writing-mode:vertical-rl]">Premium</span>
                </div>
                <div className={`mt-2 ${TILE_H} flex flex-col items-center justify-center gap-1.5 text-plush-300`}>
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
                  <span className="label-caps rotate-180 text-[9px] [writing-mode:vertical-rl]">Free</span>
                </div>
              </div>

              {BATTLE_PASS_REWARDS.map((reward) => {
                const reached = reward.tier <= currentTier;
                const isCurrent = reward.tier === currentTier;
                const ready = reached && (
                  !claimedRewards.free.includes(reward.tier)
                  || (hasPremium && !claimedRewards.premium.includes(reward.tier))
                );
                return (
                  <div
                    key={reward.tier}
                    data-tier-column
                    data-current-tier={isCurrent || undefined}
                    data-ready-tier={ready || undefined}
                    className="relative w-[6.25rem] shrink-0 snap-start px-1 pt-3 pb-3 sm:w-[6.75rem]"
                  >
                    {/* The tier you are on glows. */}
                    {isCurrent && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-x-0 inset-y-1 rounded-xl bg-brass-400/[0.07] ring-1 ring-inset ring-brass-300/30"
                      />
                    )}

                    {/* Tier node on the progress line */}
                    <div className="relative flex h-8 items-center justify-center" aria-hidden="true">
                      {reward.tier > 1 && (
                        <span className={`absolute left-0 right-1/2 top-1/2 h-0.5 -translate-y-1/2 ${reached ? 'bg-brass-300' : 'bg-white/10'}`} />
                      )}
                      {reward.tier < lastTier && (
                        <span className={`absolute left-1/2 right-0 top-1/2 h-0.5 -translate-y-1/2 ${reward.tier < currentTier ? 'bg-brass-300' : 'bg-white/10'}`} />
                      )}
                      <span
                        className={`relative grid place-items-center rounded-full font-display font-extrabold tabular-nums ${
                          isCurrent
                            ? 'h-8 w-8 bg-gradient-to-b from-brass-200 to-brass-500 text-[15px] text-night-950 shadow-[0_0_0_3px_rgba(251,191,36,0.22),0_0_18px_rgba(251,191,36,0.6)]'
                            : reached
                              ? 'h-7 w-7 bg-gradient-to-b from-brass-300 to-brass-500 text-sm text-night-950'
                              : 'h-7 w-7 bg-night-800 text-sm text-plush-300 ring-1 ring-white/10'
                        }`}
                      >
                        {reward.tier}
                      </span>
                    </div>

                    {/* XP requirement */}
                    <div className={`relative mt-1 h-4 text-center text-[10px] font-semibold leading-4 tabular-nums ${reached ? 'text-brass-200' : 'text-plush-300'}`}>
                      {reward.xpRequired} XP
                    </div>

                    {/* Premium reward (top) */}
                    <div className="relative mt-3">
                      <RewardCard
                        reward={reward.premium}
                        isPremium={true}
                        tier={reward.tier}
                        isUnlocked={reward.tier <= currentTier}
                        isClaimed={claimedRewards.premium.includes(reward.tier)}
                        canClaim={canClaim(pass, reward, 'premium')}
                        owned={ownedOf(reward.premium)}
                        onClaim={() => claimReward(reward.tier, true)}
                      />
                    </div>

                    {/* Free reward (bottom) */}
                    <div className="relative mt-2">
                      <RewardCard
                        reward={reward.free}
                        isPremium={false}
                        tier={reward.tier}
                        isUnlocked={reward.tier <= currentTier}
                        isClaimed={claimedRewards.free.includes(reward.tier)}
                        canClaim={canClaim(pass, reward, 'free')}
                        owned={ownedOf(reward.free)}
                        onClaim={() => claimReward(reward.tier, false)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div data-xp-sources="" className="mt-5 flex items-start justify-center gap-2 border-t border-white/5 bg-black/20 px-4 py-3.5 text-left sm:items-center sm:text-center">
          <Swords aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brass-300 sm:mt-0" strokeWidth={2.2} />
          <p className="text-sm text-plush-200">
            {xp.battles}
            {xp.challenges.map((line) => <span key={line}>{' '}{line}</span>)}
          </p>
        </div>
      </motion.div>

      {/* Purchase Confirmation */}
      <AnimatePresence
        onExitComplete={() => {
          if (!focusPremiumBadge.current) return;
          focusPremiumBadge.current = false;
          premiumBadgeRef.current?.focus({ preventScroll: true });
        }}
      >
        {showPurchaseConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[60] dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}
            onClick={() => setShowPurchaseConfirm(false)}
          >
            <PurchaseConfirmDialog
              gems={gems}
              price={PREMIUM_PASS_PRICE}
              season={season}
              seasonXP={battlePassXP}
              readyOnUnlock={readyRewards({ ...pass, hasPremium: true }).filter((r) => r.track === 'premium').length}
              ownedCards={ownedCards}
              unlockedCosmetics={unlockedCosmetics}
              onPurchase={handlePurchasePremium}
              onGetGems={onGetGems}
              onClose={() => setShowPurchaseConfirm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BattlePass;
