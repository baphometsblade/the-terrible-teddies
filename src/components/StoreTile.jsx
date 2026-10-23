import { useCallback, useId } from 'react';
import { Coins, Gem } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useGameStore, SHOP_ITEMS } from '@/stores/gameStore';
import analytics from '@/utils/analytics';
import { celebrate } from '@/lib/celebrate';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { PACK_LOOK, PackStack, CoinStack } from './PackArt';

// The one store tile. The Shop and the Card Packs table both sell from
// SHOP_ITEMS through it: Card Packs used to hardcode a second storefront whose
// names, copy and prices had already drifted from the Shop's, and whose
// unaffordable tiles went dead at half opacity while the Shop kept the same
// items live. Now there is one name, one price and one answer to "can I buy
// this?" in both places.

const TIER_OF = { pack: 'regular', premium: 'premium', legendary: 'legendary', coins: 'coins' };

/** The items a storefront sells as tiles, in SHOP_ITEMS order. */
export const storeItems = (types, items = SHOP_ITEMS) => items.filter((i) => types.includes(i.type));

/**
 * The coin pack that costs least per pack — the one BEST VALUE belongs on.
 * Derived, not placed by hand: the badge once sat on the 5-pack while the
 * 10-pack beside it was cheaper per card.
 */
export const bestValuePackId = (items = SHOP_ITEMS) => {
  const packs = items.filter((i) => i.type === 'pack' && i.currency === 'coins');
  let best = null;
  for (const i of packs) {
    if (!best || i.price / i.quantity < best.price / best.quantity) best = i;
  }
  return best?.id ?? null;
};

/**
 * Buying from either storefront: the same toasts, the same celebration, the
 * same analytics. Returns the store's result so a caller can follow up.
 */
export function useStoreBuy() {
  const buyShopItem = useGameStore((s) => s.buyShopItem);
  const { toast } = useToast();
  return useCallback((item) => {
    const result = buyShopItem(item.id);
    if (result.success) {
      analytics.trackInGamePurchase({
        itemId: item.id,
        itemName: item.name,
        cost: item.price,
        currency: item.currency,
      });
      toast({ title: 'Purchase Successful!', description: result.message });
      celebrate({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } else {
      toast({ title: 'Purchase Failed', description: result.message, variant: 'destructive' });
    }
    return result;
  }, [buyShopItem, toast]);
}

const PILL_SIZE = {
  md: 'h-8 px-3 gap-1.5 text-[15px]',
  sm: 'h-7 px-2 gap-1 text-[13px]',
};

/**
 * An in-game price on a glass pill (real-money prices are brass, on the gem
 * tiles). Short of it, the pill says how much more is needed instead — the
 * tile stays a live control, and the number the player actually wants is the
 * gap, not the price they cannot pay.
 */
export const PricePill = ({ currency, price, short = 0, size = 'md', id }) => {
  const Icon = currency === 'gems' ? Gem : Coins;
  const tone = currency === 'gems' ? 'text-fuchsia-200' : 'text-brass-200';
  return (
    <span
      className={`inline-flex items-center shrink-0 rounded-full bg-night-950/70 border border-white/10
        shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] font-display font-extrabold tabular-nums whitespace-nowrap
        ${PILL_SIZE[size]} ${short > 0 ? 'text-plush-200' : tone}`}
    >
      <Icon aria-hidden="true" className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${tone}`} strokeWidth={2.4} />
      {/* Below 360px a compact tile is ~115px inside, and "Need 1,234 more"
          ran out of it: there the visible word "more" goes, and a screen
          reader still hears all of it. */}
      {short > 0
        ? (
          <span id={id}>
            {`Need ${short.toLocaleString()}`}
            <span className={size === 'sm' ? 'max-[359px]:sr-only' : ''}> more</span>
          </span>
        )
        : price.toLocaleString()}
    </span>
  );
};

const BADGE = 'rounded-full bg-brass-300 text-night-950 px-2 py-[3px] label-caps text-[9px] leading-none whitespace-nowrap shadow-[0_4px_10px_-4px_rgba(217,119,6,0.9)]';

const TileArt = ({ tier, item, size }) => (tier === 'coins'
  ? <CoinStack quantity={item.quantity} size={size} />
  : <PackStack look={PACK_LOOK[tier]} quantity={item.quantity} size={size} />);

/**
 * One item, as a tile. `variant` is the storefront's layout: 'shop' for the
 * Shop's tab panels (a row on phones; standard packs stand up from sm, the
 * gem-priced tiles stay rows with their tier's light behind the art), and
 * 'compact' for the quick shop under the Card Packs table, which carries
 * SHOP_ITEMS' `short` copy.
 *
 * A native button, always actionable: short of the price, a press answers with
 * the "Not enough" toast. Its name is "Buy <name> for <price> <currency>";
 * a button's name makes its text presentational, so the copy, BEST VALUE and
 * the shortfall reach a screen reader as its description.
 */
export const StoreTile = ({ item, onBuy, variant = 'shop', bestValue = false, className = '' }) => {
  const id = useId();
  const balance = useGameStore((s) => (item.currency === 'coins' ? s.coins : s.gems));
  const short = Math.max(0, item.price - balance);
  const tier = TIER_OF[item.type] || 'regular';
  const described = [`${id}-desc`, bestValue && `${id}-best`, short > 0 && `${id}-short`].filter(Boolean).join(' ');
  const common = {
    type: 'button',
    onClick: () => onBuy(item),
    'aria-label': `Buy ${item.name} for ${item.price} ${item.currency}`,
    'aria-describedby': described,
  };
  const trim = tier === 'legendary' || bestValue ? 'trim-brass' : '';
  const badge = bestValue && <span id={`${id}-best`} className={BADGE}>BEST VALUE</span>;

  if (variant === 'compact') {
    return (
      <button
        {...common}
        className={`tile-glass sheen relative h-full w-full rounded-xl px-2 pt-8 pb-3 flex flex-col items-center text-center
          transition-transform duration-200 hover:-translate-y-0.5 ${trim} ${FOCUS_OUTLINE} ${className}`}
      >
        {badge && <span className="absolute top-2 left-1/2 -translate-x-1/2">{badge}</span>}
        <span aria-hidden="true" className="h-16 grid place-items-center">
          <TileArt tier={tier} item={item} size="sm" />
        </span>
        <span className="mt-2 font-display font-extrabold text-[15px] leading-tight text-white">{item.name}</span>
        <span id={`${id}-desc`} className="mt-0.5 text-plush-300 text-[11px] leading-snug">{item.short ?? item.description}</span>
        <span className="mt-auto pt-2.5">
          <PricePill currency={item.currency} price={item.price} short={short} size="sm" id={`${id}-short`} />
        </span>
      </button>
    );
  }

  const feature = tier !== 'regular';
  const look = PACK_LOOK[tier];
  const light = look?.light ?? 'rgba(251, 191, 36, 0.12)';
  return (
    <button
      {...common}
      className={`tile-glass sheen relative w-full h-full rounded-2xl text-left transition-transform duration-200
        hover:-translate-y-0.5 ${FOCUS_OUTLINE} ${trim} ${tier === 'premium' ? 'border-purple-300/25' : ''}
        ${feature
          ? 'flex items-center gap-3 sm:gap-4 p-4 sm:p-5'
          : 'flex items-center gap-3 p-3 pr-4 sm:flex-col sm:text-center sm:gap-3 sm:p-5'}
        ${bestValue && !feature ? 'pt-8 sm:pt-5' : ''} ${className}`}
    >
      {/* The tier's own light, pooled behind the art. */}
      {feature && (
        <span
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 55% 90% at 12% 50%, ${light}, transparent 70%)` }}
        />
      )}
      {/* Top-right on a phone row (the tile grows a top margin for it, or it
          sat on the name); centred over the art once the tile stands up. */}
      {badge && (
        <span className="absolute top-2 right-2 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-2.5">{badge}</span>
      )}
      {/* The price sits under the copy on a phone rather than beside it:
          beside it, a 320px screen left the name a 52px column. */}
      <span className={`relative shrink-0 grid place-items-center ${feature ? 'w-16 sm:w-20 h-24' : 'w-[72px] h-16 sm:w-28 sm:h-24'}`}>
        <TileArt tier={tier} item={item} size={feature ? 'md' : 'smToMd'} />
      </span>
      <span className={`relative flex-1 min-w-0 flex flex-col gap-0.5 ${feature ? '' : 'sm:items-center'}`}>
        <span className={`font-display font-extrabold leading-tight text-white ${feature ? 'text-xl' : 'text-base sm:text-lg'}`}>{item.name}</span>
        <span id={`${id}-desc`} className="text-xs leading-snug text-plush-300">{item.description}</span>
        <span className={feature ? 'mt-2.5' : 'mt-2 sm:mt-auto sm:pt-2.5'}>
          <PricePill currency={item.currency} price={item.price} short={short} id={`${id}-short`} />
        </span>
      </span>
    </button>
  );
};
