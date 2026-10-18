import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown, Lock, Check, Clock, Gem, X, Sparkles, Swords } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { useGameStore } from '../stores/gameStore';
import { getCurrentSeason } from '../utils/season';
import { celebrate } from '@/lib/celebrate';
import { useDialog } from '@/hooks/useDialog';
import { RARITY, RARITY_METAL } from '@/lib/rarity';

// Plain <button>s throughout, not the shadcn Button: its bg-primary is a
// utility and would beat the btn-brass / btn-glass materials.
//
// Focus is drawn as an outline, not a ring: a Tailwind ring is a box-shadow,
// and it would replace the material's own — btn-brass's lit lip, btn-glass's
// rim, the warm glow round a claimable tile.
const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-300';

// The edge of a tile you can claim right now: polished brass, whatever the
// reward's rarity, so "this one is yours" reads before anything else does.
const BRASS_EDGE = 'linear-gradient(180deg, #fde68a 0%, #fbbf24 45%, #b45309 100%)';

// The rail's recessed well, and the spine that stays pinned over it as the
// rail scrolls. Same solid colour, so tiles slide under the spine cleanly.
const WELL = 'bg-[#140e1d]';

// Shared by the tiles and the spine's row labels so the two stay aligned.
const TILE_H = 'h-[7.75rem]';

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
const RewardCard = ({ reward, isPremium, tier, isUnlocked, isClaimed, canClaim, onClaim }) => {
  const label = reward.type === 'card' || reward.type === 'exclusive'
    ? reward.name
    : `${reward.amount ? '+' + reward.amount : ''}`;
  const state = isClaimed ? 'claimed'
    : canClaim ? 'claim'
    : !isUnlocked ? 'locked'
    : 'needs-premium';
  const quiet = state === 'claimed' || state === 'locked';
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
        {!canClaim && <span className="sr-only">Tier {tier} {track} reward:</span>}
        <span className={`grid h-8 place-items-center text-[28px] leading-none ${quiet ? 'opacity-45 grayscale' : ''}`}>
          {reward.icon}
        </span>
        <span className="mt-2 flex h-7 w-full items-center justify-center">
          <span className={`line-clamp-2 break-words text-center font-display text-[11px] font-bold leading-[0.875rem] sm:text-[12px] ${quiet ? 'text-plush-300' : 'text-white'}`}>
            {label}
          </span>
        </span>
        {reward.rarity && (
          <span className={`label-caps text-[8px] leading-3 ${RARITY[reward.rarity].text}`}>
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
          {state === 'needs-premium' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brass-300">
              <Crown aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
              Premium
            </span>
          )}
        </span>
      </span>
    </>
  );

  if (!canClaim) {
    return <div className={`relative block w-full rounded-xl p-px ${TILE_H}`}>{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClaim}
      aria-label={`Claim tier ${tier} ${track} reward`}
      className={`sheen relative block w-full rounded-xl p-px ${TILE_H} cursor-pointer transition-transform duration-150 hover:-translate-y-0.5
        shadow-[0_0_20px_-4px_rgba(251,191,36,0.6)] ${FOCUS}`}
    >
      {body}
    </button>
  );
};

export const BATTLE_PASS_REWARDS = [
  { tier: 1, xpRequired: 0, free: { type: 'coins', amount: 100, icon: '🪙' }, premium: { type: 'card', cardId: 7, name: 'Peeping Pete', icon: '🃏', rarity: 'uncommon' } },
  { tier: 2, xpRequired: 100, free: { type: 'pack', amount: 1, icon: '📦' }, premium: { type: 'coins', amount: 500, icon: '🪙' } },
  { tier: 3, xpRequired: 250, free: { type: 'coins', amount: 150, icon: '🪙' }, premium: { type: 'gems', amount: 25, icon: '💎' } },
  { tier: 4, xpRequired: 450, free: { type: 'gems', amount: 10, icon: '💎' }, premium: { type: 'card', cardId: 62, name: 'Chainsmoke Chad', icon: '🃏', rarity: 'rare' } },
  { tier: 5, xpRequired: 700, free: { type: 'pack', amount: 1, icon: '📦' }, premium: { type: 'exclusive', name: 'Gold Border', icon: '✨' } },
  { tier: 6, xpRequired: 1000, free: { type: 'coins', amount: 200, icon: '🪙' }, premium: { type: 'pack', amount: 3, icon: '📦' } },
  { tier: 7, xpRequired: 1350, free: { type: 'gems', amount: 15, icon: '💎' }, premium: { type: 'card', cardId: 66, name: 'Mama Mauls', icon: '🃏', rarity: 'epic' } },
  { tier: 8, xpRequired: 1750, free: { type: 'pack', amount: 2, icon: '📦' }, premium: { type: 'gems', amount: 50, icon: '💎' } },
  { tier: 9, xpRequired: 2200, free: { type: 'coins', amount: 300, icon: '🪙' }, premium: { type: 'exclusive', name: 'Teddy Emote', icon: '🎭' } },
  { tier: 10, xpRequired: 2700, free: { type: 'pack', amount: 2, icon: '📦' }, premium: { type: 'card', cardId: 69, name: "Big Spoon, Last Warning", icon: '👑', rarity: 'legendary' } },
  { tier: 11, xpRequired: 3250, free: { type: 'coins', amount: 350, icon: '🪙' }, premium: { type: 'gems', amount: 60, icon: '💎' } },
  { tier: 12, xpRequired: 3850, free: { type: 'pack', amount: 2, icon: '📦' }, premium: { type: 'pack', amount: 3, icon: '📦' } },
  { tier: 13, xpRequired: 4500, free: { type: 'gems', amount: 20, icon: '💎' }, premium: { type: 'card', cardId: 65, name: "The Debt Collector", icon: '🃏', rarity: 'rare' } },
  { tier: 14, xpRequired: 5200, free: { type: 'coins', amount: 400, icon: '🪙' }, premium: { type: 'gems', amount: 70, icon: '💎' } },
  { tier: 15, xpRequired: 5950, free: { type: 'pack', amount: 3, icon: '📦' }, premium: { type: 'exclusive', name: 'Diamond Border', icon: '💠' } },
  { tier: 16, xpRequired: 6750, free: { type: 'gems', amount: 25, icon: '💎' }, premium: { type: 'card', cardId: 68, name: "Duke of Dumpsterfire", icon: '🃏', rarity: 'epic' } },
  { tier: 17, xpRequired: 7600, free: { type: 'coins', amount: 450, icon: '🪙' }, premium: { type: 'coins', amount: 800, icon: '🪙' } },
  { tier: 18, xpRequired: 8500, free: { type: 'pack', amount: 3, icon: '📦' }, premium: { type: 'pack', amount: 4, icon: '📦' } },
  { tier: 19, xpRequired: 9450, free: { type: 'gems', amount: 30, icon: '💎' }, premium: { type: 'card', cardId: 19, name: "The Seam Reaper", icon: '🃏', rarity: 'epic' } },
  { tier: 20, xpRequired: 10450, free: { type: 'coins', amount: 500, icon: '🪙' }, premium: { type: 'gems', amount: 90, icon: '💎' } },
  { tier: 21, xpRequired: 11500, free: { type: 'pack', amount: 4, icon: '📦' }, premium: { type: 'exclusive', name: 'Confetti Cannon Emote', icon: '🎉' } },
  { tier: 22, xpRequired: 12600, free: { type: 'gems', amount: 35, icon: '💎' }, premium: { type: 'card', cardId: 20, name: "The Godfluffer", icon: '👑', rarity: 'legendary' } },
  { tier: 23, xpRequired: 13750, free: { type: 'coins', amount: 550, icon: '🪙' }, premium: { type: 'coins', amount: 1000, icon: '🪙' } },
  { tier: 24, xpRequired: 14950, free: { type: 'pack', amount: 4, icon: '📦' }, premium: { type: 'pack', amount: 5, icon: '📦' } },
  { tier: 25, xpRequired: 16200, free: { type: 'pack', amount: 5, icon: '📦' }, premium: { type: 'card', cardId: 21, name: "Fluffpocalypse Now", icon: '👑', rarity: 'legendary' } },
];

const PREMIUM_PASS_PRICE = 500; // gems

// The Unlock-Premium confirmation is a modal over the Battle Pass dialog, so it
// hosts its own useDialog: it pushes onto the dialog stack (so it owns Escape and
// its own focus trap), moves focus into itself, and carries role=dialog/aria-modal.
// Without it, the outer BattlePass trap treated the 50-tile reward track and the
// confirm buttons as one flat focus set — Tab walked the whole background behind
// the overlay before reaching Purchase/Cancel. Matches SaveDeckDialog / CardDetailDialog.
const PurchaseConfirmDialog = ({ gems, price, rewardCount, onPurchase, onClose }) => {
  const ref = useDialog(onClose);
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Unlock Premium Pass"
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0.9 }}
      className="relative my-auto w-full max-w-md overflow-hidden rounded-2xl dialog-panel trim-brass px-6 pt-7 pb-6 text-center"
      onClick={e => e.stopPropagation()}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(251,191,36,0.24),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="relative mx-auto mb-3 h-16 w-16 rounded-full p-[3px]"
        style={{ background: RARITY_METAL.legendary }}
      >
        <div className="grid h-full w-full place-items-center rounded-full bg-night-900">
          <Crown className="h-7 w-7 text-brass-300" strokeWidth={1.75} />
        </div>
      </div>
      <h3 className="relative font-display text-2xl sm:text-3xl font-extrabold leading-tight text-brass-gradient">
        Unlock Premium Pass
      </h3>

      <div className="relative mt-5 rounded-xl bg-black/25 p-4 text-left ring-1 ring-white/5">
        <div className="label-caps mb-3 text-plush-300">Premium Pass includes:</div>
        <ul className="space-y-2 text-sm text-plush-100">
          <li className="flex items-start gap-2.5"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" strokeWidth={2.5} />3 guaranteed legendary cards</li>
          <li className="flex items-start gap-2.5"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" strokeWidth={2.5} />Premium cosmetic rewards</li>
          <li className="flex items-start gap-2.5"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" strokeWidth={2.5} />Bonus gems and coins</li>
          <li className="flex items-start gap-2.5"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" strokeWidth={2.5} />Special card borders &amp; emotes</li>
          <li className="flex items-start gap-2.5"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" strokeWidth={2.5} />All {rewardCount} premium tier rewards</li>
        </ul>
      </div>

      <div className="relative mt-5">
        <div className="label-caps text-plush-300">Price</div>
        <div className="mt-1 flex items-center justify-center gap-2 font-display text-4xl font-extrabold leading-none text-white tabular-nums">
          <Gem aria-hidden="true" className="h-7 w-7 text-fuchsia-300" strokeWidth={2.2} />
          {price}
          <span className="sr-only"> gems</span>
        </div>
        <div className={`mt-2 text-sm ${gems < price ? 'text-rose-300' : 'text-plush-300'}`}>You have: {gems} gems</div>
      </div>

      {/* Brass only while it can be bought. A short balance gets a dimmed
          glass key rather than see-through brass, which read as a muddy brown
          button that still looked like the thing to press. */}
      <div className="relative mt-6 flex gap-3">
        <button
          type="button"
          onClick={onPurchase}
          disabled={gems < price}
          className={`h-11 flex-1 rounded-xl font-display font-bold ${FOCUS} ${
            gems < price ? 'btn-glass cursor-not-allowed text-plush-400 opacity-70' : 'btn-brass'}`}
        >
          Purchase
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`btn-glass h-11 flex-1 rounded-xl font-display font-bold ${FOCUS}`}
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
};

const BattlePass = ({ onClose }) => {
  const {
    gems, addCoins, addGems, addCardPack, addCard, unlockCosmetic, seasonXP,
    hasBattlePassPremium, purchaseBattlePassPremium,
    claimedBattlePassRewards, claimBattlePassReward, syncSeason,
  } = useGameStore();
  const { toast } = useToast();
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);
  const scrollRef = useRef(null);
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
      const wanted = current.offsetLeft + 2 * col - rail.clientWidth;
      // Whole columns only, so no tile is left half-hidden under the spine.
      rail.scrollLeft = Math.max(0, Math.floor(Math.min(wanted, first.offsetLeft - spine) / col) * col);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const hasPremium = hasBattlePassPremium;
  const claimedRewards = claimedBattlePassRewards;

  const battlePassXP = seasonXP;
  const currentTier = BATTLE_PASS_REWARDS.reduce((tier, reward) => {
    return battlePassXP >= reward.xpRequired ? reward.tier : tier;
  }, 0);

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
    if (outcome === 'purchased') {
      setShowPurchaseConfirm(false);
      celebrate({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#fbbf24', '#f59e0b', '#fde68a'] });
      toast({ title: "Premium Pass Unlocked!", description: "You now have access to all premium rewards!" });
    } else if (outcome === 'already-owned') {
      setShowPurchaseConfirm(false);
    } else {
      toast({ title: "Not Enough Gems", description: `You need ${PREMIUM_PASS_PRICE} gems.`, variant: "destructive" });
    }
  };

  const claimReward = (tier, isPremium) => {
    const reward = BATTLE_PASS_REWARDS.find(r => r.tier === tier);
    if (!reward) return;

    const rewardData = isPremium ? reward.premium : reward.free;

    if (tier > currentTier) {
      toast({ title: "Tier Not Reached", description: "Keep playing to unlock this tier!", variant: "destructive" });
      return;
    }

    if (isPremium && !hasPremium) {
      toast({ title: "Premium Required", description: "Unlock the Premium Pass to claim this reward!", variant: "destructive" });
      return;
    }

    // Claim first — claimBattlePassReward atomically records the tier and
    // returns false if it was already claimed, so a double-click can't grant
    // the reward twice.
    if (!claimBattlePassReward(tier, isPremium, reward.xpRequired)) {
      toast({ title: "Already Claimed", description: "You've already claimed this reward.", variant: "destructive" });
      return;
    }

    switch (rewardData.type) {
      case 'coins':
        addCoins(rewardData.amount);
        toast({ title: "Coins Claimed!", description: `+${rewardData.amount} coins` });
        break;
      case 'gems':
        addGems(rewardData.amount);
        toast({ title: "Gems Claimed!", description: `+${rewardData.amount} gems` });
        break;
      case 'pack':
        addCardPack(rewardData.amount);
        toast({ title: "Packs Claimed!", description: `+${rewardData.amount} card pack(s)` });
        break;
      case 'card':
        addCard(rewardData.cardId);
        celebrate({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        toast({ title: "Card Unlocked!", description: `You got ${rewardData.name}!` });
        break;
      case 'exclusive':
        // Record the cosmetic as owned so the claim is a real grant, not a
        // no-op. No UI renders borders/emotes yet, but the entitlement now
        // persists (and survives a season reset by being cleared with the pass).
        unlockCosmetic(rewardData.name);
        celebrate({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        toast({ title: "Exclusive Unlocked!", description: `You got ${rewardData.name}!` });
        break;
    }
  };

  // How many tiles are waiting to be claimed — the same test each tile's
  // canClaim uses below, so the count and the brass tiles always agree.
  const readyCount = BATTLE_PASS_REWARDS.reduce((n, r) => (
    r.tier > currentTier ? n
      : n + (claimedRewards.free.includes(r.tier) ? 0 : 1)
        + (hasPremium && !claimedRewards.premium.includes(r.tier) ? 1 : 0)
  ), 0);
  const lastTier = BATTLE_PASS_REWARDS[BATTLE_PASS_REWARDS.length - 1].tier;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Battle Pass"
      // Scrolls, with the panel centred by my-auto rather than items-center: a
      // centred flex item taller than its box overflows at both ends, which on
      // a short phone put the header — and the close button — out of reach.
      className="fixed inset-0 z-50 dialog-scrim flex items-start justify-center overflow-y-auto p-3 sm:p-6"
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
              premium button on a row underneath (full width on a phone, under the
              text from sm). From lg up, one row: title block, countdown, button,
              close — below that the five do not fit side by side, and the
              gradient title is what gets squeezed out of its column.

              The title never wraps: a brass gradient stretched over two lines
              of a wrapped heading is drawn as one tall gradient, and it is
              sized down at 320px so it does not have to. The season name is
              never truncated either (it used to be, at 320px). Nothing in this
              row may be wider than the panel: its overflow-hidden would clip
              the close button off the right edge and leave no way out. */}
          <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1
            lg:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] lg:gap-y-1.5 lg:gap-x-5"
          >
            <div
              aria-hidden="true"
              className="col-start-1 row-span-3 row-start-1 h-12 w-12 shrink-0 rounded-full p-[2px] shadow-[0_6px_16px_-6px_rgba(0,0,0,0.8)] lg:row-span-2 lg:row-start-1 lg:h-14 lg:w-14"
              style={{ background: RARITY_METAL.legendary }}
            >
              <div className="grid h-full w-full place-items-center rounded-full bg-night-900">
                <Trophy className="h-6 w-6 text-brass-300 lg:h-7 lg:w-7" strokeWidth={1.75} />
              </div>
            </div>

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
              lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:gap-2.5"
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

            <div className="col-span-3 col-start-1 row-start-4 mt-3 sm:col-span-2 sm:col-start-2 lg:col-span-1 lg:col-start-4 lg:row-span-2 lg:row-start-1 lg:mt-0">
              {!hasPremium && (
                <button
                  type="button"
                  onClick={() => setShowPurchaseConfirm(true)}
                  className={`btn-brass sheen relative inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl pl-3.5 pr-1.5
                    font-display font-bold sm:w-auto ${FOCUS}`}
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
                <div className="trim-brass relative flex h-11 items-center justify-center gap-2 rounded-xl bg-brass-400/10 px-4 font-display font-bold text-brass-200 sm:inline-flex">
                  <Crown aria-hidden="true" className="h-4 w-4 text-brass-300" strokeWidth={2.4} />
                  Premium Active
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`btn-glass col-start-3 row-start-1 grid h-10 w-10 shrink-0 place-items-center self-start rounded-xl
                lg:col-start-5 lg:row-span-2 lg:row-start-1 lg:self-center ${FOCUS}`}
              aria-label="Close battle pass"
            >
              <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* Season progress */}
        <div className="px-4 pt-5 sm:px-6">
          <div className="panel-glass flex items-center gap-4 rounded-2xl p-3.5 sm:gap-5 sm:p-4">
            <div
              aria-hidden="true"
              className="h-14 w-14 shrink-0 rounded-full p-[2px]"
              style={{ background: RARITY_METAL.legendary }}
            >
              <div className="grid h-full w-full place-items-center rounded-full bg-night-900 font-display text-2xl font-extrabold tabular-nums text-brass-200">
                {currentTier}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="font-display text-lg font-bold leading-tight text-white">Tier {currentTier} → {currentTier + 1}</span>
                <span className="text-sm font-semibold tabular-nums text-brass-200">{xpToNext} XP to next tier</span>
              </div>
              <Progress
                value={xpProgress}
                className="mt-2 h-2.5 bg-black/45 ring-1 ring-white/10 [&>div]:bg-gradient-to-r [&>div]:from-brass-300 [&>div]:to-brass-500"
                aria-label={`Battle pass progress: tier ${currentTier}, ${xpToNext} XP to tier ${currentTier + 1}`}
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
            {/* relative: the columns' offsetLeft is measured from this track. */}
            <div className="relative flex min-w-max pr-2">
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
                        canClaim={reward.tier <= currentTier && !claimedRewards.premium.includes(reward.tier) && hasPremium}
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
                        canClaim={reward.tier <= currentTier && !claimedRewards.free.includes(reward.tier)}
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
        <div className="mt-5 flex items-center justify-center gap-2 border-t border-white/5 bg-black/20 px-4 py-3.5 text-center">
          <Swords aria-hidden="true" className="h-4 w-4 shrink-0 text-brass-300" strokeWidth={2.2} />
          <p className="text-sm text-plush-200">
            Win battles and complete daily challenges to earn XP!
          </p>
        </div>
      </motion.div>

      {/* Purchase Confirmation */}
      <AnimatePresence>
        {showPurchaseConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] dialog-scrim flex items-start justify-center overflow-y-auto p-3 sm:p-6"
            onClick={() => setShowPurchaseConfirm(false)}
          >
            <PurchaseConfirmDialog
              gems={gems}
              price={PREMIUM_PASS_PRICE}
              rewardCount={BATTLE_PASS_REWARDS.length}
              onPurchase={handlePurchasePremium}
              onClose={() => setShowPurchaseConfirm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BattlePass;
