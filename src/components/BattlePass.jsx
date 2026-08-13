import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { useGameStore } from '../stores/gameStore';
import { getCurrentSeason } from '../utils/season';
import confetti from 'canvas-confetti';
import { useDialog } from '@/hooks/useDialog';
import { pressable } from '@/lib/a11y';
import { RARITY } from '@/lib/rarity';

const rarityBorder = (r) =>
  r === 'legendary' ? `${RARITY[r].border} ${RARITY[r].glow} shadow-lg` : RARITY[r].border;

// Hoisted to module scope for a stable component identity. Declared inside
// BattlePass it got a fresh type every render, so claiming a reward (or any
// toast) remounted all 30 tiles and replayed their entrance. The parent now
// passes the derived unlocked/claimed/canClaim flags and the claim handler.
const RewardCard = ({ reward, isPremium, tier, isUnlocked, isClaimed, canClaim, onClaim }) => (
  <motion.div
    whileHover={canClaim ? { scale: 1.05 } : {}}
    whileTap={canClaim ? { scale: 0.95 } : {}}
    {...pressable(
      () => canClaim && onClaim(),
      `Claim tier ${tier} ${isPremium ? 'premium' : 'free'} reward`,
    )}
    className={`
      relative w-20 h-24 rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer transition-all
      ${isPremium
        ? 'bg-gradient-to-br from-brass-600/25 to-amber-900/30 border-2'
        : 'bg-white/10 border border-white/20'}
      ${reward.rarity ? rarityBorder(reward.rarity) : isPremium ? 'border-brass-400/50' : ''}
      ${!isUnlocked ? 'opacity-40' : ''}
      ${isClaimed ? 'opacity-60' : ''}
      ${canClaim ? 'hover:border-white' : ''}
    `}
  >
    {isClaimed && (
      <div className="absolute inset-0 bg-green-500/30 rounded-lg flex items-center justify-center">
        <span className="text-2xl">✅</span>
      </div>
    )}

    {!isUnlocked && (
      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
        <span className="text-xl">🔒</span>
      </div>
    )}

    <div className="text-2xl mb-1">{reward.icon}</div>
    <div className="text-white text-[10px] font-semibold text-center">
      {reward.type === 'card' ? reward.name :
       reward.type === 'exclusive' ? reward.name :
       `${reward.amount ? '+' + reward.amount : ''}`}
    </div>
    {reward.rarity && (
      <div className={`text-[8px] uppercase font-bold ${RARITY[reward.rarity].text}`}>
        {reward.rarity}
      </div>
    )}
  </motion.div>
);

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
      className="relative bg-gradient-to-b from-night-700 to-night-900 rounded-2xl p-6 max-w-md w-full border-2 border-brass-400 worn"
      onClick={e => e.stopPropagation()}
    >
      <h3 className="text-2xl font-display font-bold text-white text-center mb-4">⭐ Unlock Premium Pass</h3>

      <div className="bg-black/30 rounded-xl p-4 mb-4">
        <div className="text-white font-semibold mb-2">Premium Pass includes:</div>
        <ul className="text-white/80 text-sm space-y-1">
          <li>✓ Exclusive legendary cards</li>
          <li>✓ Premium cosmetic rewards</li>
          <li>✓ Bonus gems and coins</li>
          <li>✓ Special card borders & emotes</li>
          <li>✓ All {rewardCount} premium tier rewards</li>
        </ul>
      </div>

      <div className="text-center mb-4">
        <div className="text-white/50 text-sm">Price</div>
        <div className="text-3xl font-bold text-brass-300 flex items-center justify-center gap-2">
          💎 {price}
        </div>
        <div className="text-white/50 text-sm">You have: {gems} gems</div>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={onPurchase}
          disabled={gems < price}
          className="flex-1 bg-gradient-to-r from-brass-400 to-brass-500 text-night-950 font-bold hover:from-brass-300 hover:to-brass-400"
        >
          Purchase
        </Button>
        <Button
          onClick={onClose}
          variant="outline"
          className="flex-1 text-white border-white/30"
        >
          Cancel
        </Button>
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
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#fbbf24', '#f59e0b', '#fde68a'] });
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
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        toast({ title: "Card Unlocked!", description: `You got ${rewardData.name}!` });
        break;
      case 'exclusive':
        // Record the cosmetic as owned so the claim is a real grant, not a
        // no-op. No UI renders borders/emotes yet, but the entitlement now
        // persists (and survives a season reset by being cleared with the pass).
        unlockCosmetic(rewardData.name);
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        toast({ title: "Exclusive Unlocked!", description: `You got ${rewardData.name}!` });
        break;
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Battle Pass"
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-b from-night-700 via-night-800 to-night-950 rounded-2xl max-w-5xl w-full shadow-2xl border border-plush-700/40 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-brass-600 via-brass-500 to-amber-900 p-4 relative overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
          />
          {/* flex-wrap + tighter gaps so the header fits a 390px phone. Without
              it the title + "Season ends" + Unlock button + close ran to ~453px
              and the panel's overflow-hidden clipped the close button off the
              right edge, leaving no way to dismiss the pass on a phone. */}
          <div className="flex flex-wrap justify-between items-center gap-2 relative z-10">
            <div>
              <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
                <span className="text-3xl">🏆</span> Battle Pass
              </h2>
              <p className="text-white/80 text-sm">{season.name}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="text-right">
                <div className="text-white/70 text-xs">Season ends in</div>
                <div className="text-white font-bold">{season.daysLeft} day{season.daysLeft !== 1 ? 's' : ''}</div>
              </div>
              {!hasPremium && (
                <Button
                  onClick={() => setShowPurchaseConfirm(true)}
                  className="bg-night-900 text-brass-300 font-bold hover:bg-night-800 border border-brass-400/50"
                >
                  💎 {PREMIUM_PASS_PRICE} - Unlock Premium
                </Button>
              )}
              {hasPremium && (
                <div className="bg-night-900 text-brass-300 px-4 py-2 rounded-lg font-bold flex items-center gap-2 border border-brass-400/50">
                  ⭐ Premium Active
                </div>
              )}
              <button onClick={onClose} className="text-white/70 hover:text-white text-2xl" aria-label="Close battle pass">×</button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-black/30">
          <div className="flex items-center gap-4">
            <div className="bg-brass-400 text-night-950 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg">
              {currentTier}
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/70">Tier {currentTier} → {currentTier + 1}</span>
                <span className="text-brass-300">{xpToNext} XP to next tier</span>
              </div>
              <Progress
                value={xpProgress}
                className="h-3 bg-white/10 [&>div]:bg-brass-400"
                aria-label={`Battle pass progress: tier ${currentTier}, ${xpToNext} XP to tier ${currentTier + 1}`}
              />
            </div>
            <div className="text-white/50 text-sm">
              Total: {battlePassXP} XP
            </div>
          </div>
        </div>

        {/* Rewards Track */}
        <div className="p-6 overflow-x-auto" ref={scrollRef}>
          <div className="flex gap-4 min-w-max pb-4">
            {BATTLE_PASS_REWARDS.map((reward) => (
              <div key={reward.tier} className="flex flex-col items-center gap-2">
                {/* Tier number */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  reward.tier <= currentTier ? 'bg-brass-400 text-night-950' : 'bg-white/20 text-white/50'
                }`}>
                  {reward.tier}
                </div>

                {/* XP requirement */}
                <div className="text-white/50 text-[10px]">{reward.xpRequired} XP</div>

                {/* Premium reward (top) */}
                <RewardCard
                  reward={reward.premium}
                  isPremium={true}
                  tier={reward.tier}
                  isUnlocked={reward.tier <= currentTier}
                  isClaimed={claimedRewards.premium.includes(reward.tier)}
                  canClaim={reward.tier <= currentTier && !claimedRewards.premium.includes(reward.tier) && hasPremium}
                  onClaim={() => claimReward(reward.tier, true)}
                />

                {/* Divider */}
                <div className={`w-16 h-0.5 ${reward.tier <= currentTier ? 'bg-brass-400' : 'bg-white/20'}`} />

                {/* Free reward (bottom) */}
                <RewardCard
                  reward={reward.free}
                  isPremium={false}
                  tier={reward.tier}
                  isUnlocked={reward.tier <= currentTier}
                  isClaimed={claimedRewards.free.includes(reward.tier)}
                  canClaim={reward.tier <= currentTier && !claimedRewards.free.includes(reward.tier)}
                  onClaim={() => claimReward(reward.tier, false)}
                />

                {/* Free label */}
                <div className="text-white/40 text-[10px]">FREE</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-black/30 p-4 text-center">
          <p className="text-white/50 text-sm">
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
            className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
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
