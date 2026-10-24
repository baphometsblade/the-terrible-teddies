import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Gem } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useGameStore, SHOP_ITEMS } from '@/stores/gameStore';
import analytics from '@/utils/analytics';
import { celebrate } from '@/lib/celebrate';
import { FOCUS_OUTLINE } from '@/lib/focus';
import { RARITY_METAL } from '@/lib/rarity';
import { SCRIM_PAD } from '@/lib/safeArea';
import { ignoreKeyRepeat } from '@/lib/keyRepeat';
import { useDialog } from '@/hooks/useDialog';
import { Medallion } from '@/components/ui/medallion';
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
 * How long after a buy (or a confirm closing) another request is ignored: a
 * double-click or a double tap is two clicks a few hundred ms apart, and
 * each used to buy.
 */
export const REPEAT_BUY_MS = 400;

/**
 * Buying from either storefront: the same toasts, the same celebration, the
 * same analytics, and the same guard on paid currency.
 *
 * `requestBuy(item, then)` buys a coin-priced item at once. A gem-priced one
 * the player can afford is only asked about: `confirmNode` (render it) is the
 * confirm, and the gems are spent once, from its Buy. Gems are bought with
 * real money and a spend cannot be undone, which is why premium stores
 * confirm them. One the player cannot afford goes straight to the "Not
 * enough gems" answer: there is nothing to confirm. `then(result)` runs once
 * the store has answered, whenever that is.
 */
export function useStoreBuy() {
  const buyShopItem = useGameStore((s) => s.buyShopItem);
  const { toast } = useToast();
  // The confirm's item, in a ref as well as in state: two clicks landing in
  // one frame both run with the same render's closure, and only the ref has
  // already been cleared by the first.
  const [pending, setPending] = useState(null);
  const pendingRef = useRef(null);
  const quietUntil = useRef(0);

  const buy = useCallback((item, then) => {
    quietUntil.current = Date.now() + REPEAT_BUY_MS;
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
    then?.(result);
    return result;
  }, [buyShopItem, toast]);

  const requestBuy = useCallback((item, then) => {
    if (pendingRef.current || Date.now() < quietUntil.current) return;
    if (item.currency === 'gems' && useGameStore.getState().gems >= item.price) {
      pendingRef.current = { item, then };
      setPending(pendingRef.current);
      return;
    }
    buy(item, then);
  }, [buy]);

  const close = useCallback(() => {
    pendingRef.current = null;
    quietUntil.current = Date.now() + REPEAT_BUY_MS;
    setPending(null);
  }, []);
  // Cleared before buying, so a second Buy (a double-click, a second Enter)
  // finds nothing left to buy.
  const confirm = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    close();
    buy(p.item, p.then);
  }, [buy, close]);

  const confirmNode = pending
    ? <GemSpendConfirm item={pending.item} onConfirm={confirm} onCancel={close} />
    : null;
  return { requestBuy, confirmNode };
}

// The confirm's picture: the tile's own art for packs and coin bags, the
// Shop card's medallion for the Coin Doubler.
const ConfirmArt = ({ item }) => {
  if (item.type === 'booster') {
    return <Medallion icon={Coins} metal={RARITY_METAL.uncommon} size="lg" iconClassName="text-emerald-300" />;
  }
  const tier = TIER_OF[item.type] || 'regular';
  return tier === 'coins'
    ? <CoinStack quantity={item.quantity} size="md" />
    : <PackStack look={PACK_LOOK[tier]} quantity={item.quantity} size="md" />;
};

/**
 * "Buy this for gems?": the item, its price, and the balance before and
 * after. A modal over the storefront with its own useDialog (Escape, Back and
 * the focus trap are its own), modelled on the Battle Pass's confirm.
 *
 * It opens on Cancel, not Buy, because the press that opened it is often an
 * Enter still held down. Its keys ignore auto-repeat as the tiles do, so that
 * hold neither buys nor cancels. A click on the scrim does not close it:
 * the second click of a double-click lands there.
 */
export const GemSpendConfirm = ({ item, onConfirm, onCancel }) => {
  const ref = useDialog(onCancel);
  // Declared after useDialog, so its effect runs second: useDialog has noted
  // the tile as the place to hand focus back to, and focused Buy.
  const cancelRef = useRef(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  const titleId = useId();
  const gems = useGameStore((s) => s.gems);
  const doublerEnds = useGameStore((s) => s.coinDoublerExpiresAt);
  // buyShopItem adds a running booster's hours on rather than restarting it.
  const extending = item.type === 'booster' && typeof doublerEnds === 'number' && doublerEnds > Date.now();
  const verb = extending ? 'Extend' : 'Buy';
  const after = Math.max(0, gems - item.price);
  return (
    <div className={`fixed inset-0 z-[60] dialog-scrim flex items-start justify-center overflow-y-auto ${SCRIM_PAD}`}>
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={ignoreKeyRepeat}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        className="relative my-auto w-full max-w-sm overflow-hidden rounded-2xl dialog-panel px-5 pt-6 pb-5 text-center sm:px-6"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(232,121,249,0.16),transparent_70%)]"
        />
        <span aria-hidden="true" data-confirm-art="" className="relative grid h-24 place-items-center">
          <ConfirmArt item={item} />
        </span>
        <h2 id={titleId} className="relative mt-3 font-display text-2xl font-extrabold leading-tight text-white">
          {`${verb} ${item.name}?`}
        </h2>
        <p className="relative mt-1 text-sm text-plush-300">
          {extending ? `Adds ${item.durationHours} hours to the one running.` : item.description}
        </p>
        <div className="relative mt-4 rounded-xl bg-black/25 px-4 py-3 ring-1 ring-white/5">
          <div className="flex items-center justify-center gap-2 font-display text-3xl font-extrabold leading-none text-white tabular-nums">
            <Gem aria-hidden="true" className="h-6 w-6 text-fuchsia-300" strokeWidth={2.2} />
            {item.price.toLocaleString()}
            <span className="sr-only"> gems</span>
          </div>
          {/* Two halves that each stay whole: at 320 the line broke as
              "3,606 / after". */}
          <p data-confirm-balance="" className="mt-2 text-sm text-plush-300 tabular-nums">
            <span className="whitespace-nowrap">{`You have ${gems.toLocaleString()} gems`}</span>
            {' · '}
            <span className="whitespace-nowrap">{`${after.toLocaleString()} after`}</span>
          </p>
        </div>
        <div className="relative mt-5 flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            aria-label={`${verb} for ${item.price} gems`}
            className={`btn-brass inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl font-display font-bold tabular-nums ${FOCUS_OUTLINE}`}
          >
            {verb}
            <span aria-hidden="true" className="inline-flex items-center gap-1">
              <span>·</span>
              <Gem className="h-4 w-4" strokeWidth={2.4} />
              {item.price.toLocaleString()}
            </span>
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={`btn-glass h-11 flex-1 rounded-xl font-display font-bold ${FOCUS_OUTLINE}`}
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const PILL_SIZE = {
  md: 'h-8 px-3 gap-1.5 text-[15px]',
  sm: 'h-7 px-2 gap-1 text-[13px]',
};

// Where a tile's column is too narrow for "Need 1,600 more", the visible word
// "more" goes (a screen reader still hears it): below 360px everywhere, and in
// the Shop's three-across standard packs until md. Measured, not guessed:
// e2e/packs.spec.js holds every pill inside its tile at a zero balance (the
// widest numbers) at each of those widths.
export const TERSE = {
  phone: 'max-[359px]:sr-only',
  phoneAndThreeAcross: 'max-[359px]:sr-only sm:max-md:sr-only',
};

/**
 * An in-game price on a glass pill (real-money prices are brass, on the gem
 * tiles). Short of it, the pill says how much more is needed instead — the
 * tile stays a live control, and the number the player actually wants is the
 * gap, not the price they cannot pay. `terse` is where the word "more" drops.
 */
export const PricePill = ({ currency, price, short = 0, size = 'md', terse = TERSE.phone, id }) => {
  const Icon = currency === 'gems' ? Gem : Coins;
  const tone = currency === 'gems' ? 'text-fuchsia-200' : 'text-brass-200';
  return (
    <span
      data-price-pill=""
      className={`inline-flex items-center shrink-0 rounded-full bg-night-950/70 border border-white/10
        shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] font-display font-extrabold tabular-nums whitespace-nowrap
        ${PILL_SIZE[size]} ${short > 0 ? 'text-plush-200' : tone}`}
    >
      <Icon aria-hidden="true" className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${tone}`} strokeWidth={2.4} />
      {short > 0
        ? (
          <span id={id}>
            {`Need ${short.toLocaleString()}`}
            <span className={terse}> more</span>
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
    onKeyDown: ignoreKeyRepeat,
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
        <span aria-hidden="true" data-tile-art="" className="h-16 grid place-items-center">
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
      {/* A coin bag's pile is 5.6em (78px at md) at every width, so its slot
          is too; a single mini pack is 4em and fits the narrower one. */}
      <span
        data-tile-art=""
        className={`relative shrink-0 grid place-items-center ${
          tier === 'coins' ? 'w-20 h-24' : feature ? 'w-16 sm:w-20 h-24' : 'w-[72px] h-16 sm:w-28 sm:h-24'
        }`}
      >
        <TileArt tier={tier} item={item} size={feature ? 'md' : 'smToMd'} />
      </span>
      <span className={`relative flex-1 min-w-0 flex flex-col gap-0.5 ${feature ? '' : 'sm:items-center'}`}>
        <span className={`font-display font-extrabold leading-tight text-white ${feature ? 'text-xl' : 'text-base sm:text-lg'}`}>{item.name}</span>
        <span id={`${id}-desc`} className="text-xs leading-snug text-plush-300">{item.description}</span>
        <span className={feature ? 'mt-2.5' : 'mt-2 sm:mt-auto sm:pt-2.5'}>
          <PricePill
            currency={item.currency}
            price={item.price}
            short={short}
            terse={feature ? TERSE.phone : TERSE.phoneAndThreeAcross}
            id={`${id}-short`}
          />
        </span>
      </span>
    </button>
  );
};
