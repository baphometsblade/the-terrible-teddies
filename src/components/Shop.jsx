import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Package, Gem, Star, Coins, Crown, X, Timer, Sparkles, ShieldCheck } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useGameStore, SHOP_ITEMS } from '../stores/gameStore';
import confetti from 'canvas-confetti';
import analytics from '../utils/analytics';
import { redirectToStripeCheckout } from '../utils/stripe';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { useDialog } from '@/hooks/useDialog';
import { pressable } from '@/lib/a11y';
import { RARITY_METAL, RARITY_ORDER } from '@/lib/rarity';

const GEM_BUNDLES = [
  { id: 'gems_small', gems: 50, price: 0.99, bonus: 0, popular: false },
  { id: 'gems_medium', gems: 150, price: 2.99, bonus: 10, popular: false },
  { id: 'gems_large', gems: 500, price: 9.99, bonus: 50, popular: false },
  { id: 'gems_huge', gems: 1200, price: 19.99, bonus: 200, popular: false },
  { id: 'gems_mega', gems: 3000, price: 49.99, bonus: 750, popular: true },
];

// Shared shape of every focusable control here. Plain <button>s rather than
// the shadcn Button: its bg-primary is a utility and would beat the
// component-layer btn-brass / btn-glass materials.
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-night-900';
const ACTION =
  `inline-flex items-center justify-center gap-2 rounded-xl font-display font-bold whitespace-nowrap ${FOCUS} ` +
  'disabled:opacity-50 disabled:cursor-not-allowed';

// The three pack wrappers, one per tier, so a pack looks the same in the Shop
// as it does on the Card Packs table: a metal frame from the rarity ladder over
// a tinted face. Premium wears amethyst (it guarantees rare or better), the
// Legendary pack wears brass, and the standard pack is pewter.
const PACK_LOOK = {
  regular: {
    metal: RARITY_METAL.common,
    face: 'linear-gradient(165deg, #4b2a72 0%, #2b1845 55%, #170d25 100%)',
    Icon: Package,
    tone: 'text-brass-300',
  },
  premium: {
    metal: RARITY_METAL.epic,
    face: 'linear-gradient(165deg, #6d28d9 0%, #3b0f6b 55%, #1a0b30 100%)',
    Icon: Gem,
    tone: 'text-fuchsia-200',
  },
  legendary: {
    metal: RARITY_METAL.legendary,
    face: 'linear-gradient(165deg, #92400e 0%, #7c2d12 45%, #3b1508 100%)',
    Icon: Crown,
    tone: 'text-brass-200',
  },
};

// The crimped seal along the top and bottom of a foil pack.
const CRIMP = 'bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.2)_0_1px,rgba(0,0,0,0.25)_1px_3px)]';

const MiniPack = ({ look, className }) => (
  <span
    className={`relative block rounded-[7px] overflow-hidden shadow-[0_8px_16px_-8px_rgba(0,0,0,0.95)] ${className}`}
    style={{ border: '2px solid transparent', background: `${look.face} padding-box, ${look.metal} border-box` }}
  >
    <span className={`absolute inset-x-0 top-0 h-[5px] ${CRIMP}`} />
    <span className={`absolute inset-x-0 bottom-0 h-[5px] ${CRIMP}`} />
    <span className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_30%_10%,rgba(255,255,255,0.22),transparent_60%)]" />
    <span className="absolute inset-0 grid place-items-center">
      <look.Icon className={`w-[45%] h-[45%] ${look.tone}`} strokeWidth={2.2} />
    </span>
  </span>
);

// A bundle of 5 or 10 packs is drawn as a fanned stack, so quantity reads at a
// glance without leaning on the copy. Back to front: left, right, centre.
const FAN = {
  1: [''],
  2: ['-rotate-[9deg] -translate-x-2.5', 'rotate-[7deg] translate-x-2.5'],
  3: ['-rotate-[13deg] -translate-x-4 translate-y-1', 'rotate-[13deg] translate-x-4 translate-y-1', ''],
};
const PackStack = ({ look, quantity, size }) => {
  const layers = quantity >= 10 ? 3 : quantity >= 5 ? 2 : 1;
  return (
    <span className="grid place-items-center" aria-hidden="true">
      {FAN[layers].map((t, i) => (
        <span key={i} className={`col-start-1 row-start-1 ${t}`}>
          <MiniPack look={look} className={size} />
        </span>
      ))}
    </span>
  );
};

// In-game prices sit in a glass pill; real-money prices (the Buy Gems tab) are
// brass, because those are the purchases.
const PricePill = ({ currency, price, className = '' }) => {
  const Icon = currency === 'gems' ? Gem : Coins;
  return (
    <span
      className={`inline-flex items-center gap-1.5 shrink-0 rounded-full h-8 px-3 bg-night-950/70 border border-white/10
        shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] font-display font-extrabold text-[15px] tabular-nums
        ${currency === 'gems' ? 'text-fuchsia-200' : 'text-brass-200'} ${className}`}
    >
      <Icon aria-hidden="true" className="w-4 h-4" strokeWidth={2.4} />
      {price.toLocaleString()}
    </span>
  );
};

// The icon carries the meaning visually; the sr-only noun carries it for a
// screen reader. (aria-label on a role-less div is prohibited in ARIA 1.2.)
const Balance = ({ icon: Icon, value, tone, noun }) => (
  <div className="panel-glass rounded-xl h-10 pl-2.5 pr-3 flex items-center gap-1.5">
    <Icon aria-hidden="true" className={`w-4 h-4 ${tone}`} strokeWidth={2.4} />
    <span className={`font-display font-extrabold text-[15px] tabular-nums ${tone}`}>{value}</span>
    <span className="sr-only">{noun}</span>
  </div>
);

const SectionHeading = ({ children }) => (
  <div className="flex items-center gap-3 mb-3">
    <h3 className="label-caps text-plush-300 shrink-0">{children}</h3>
    <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
  </div>
);

// Hoisted to module scope so their identity is stable across renders. Declared
// inside Shop they were redefined every render, so a coin/pack purchase (which
// stays on the shop screen and re-renders it) remounted every tile and replayed
// its entrance animation, dropping focus from the just-clicked card. The parent
// passes the buy handler (and processing flag) as props.
//
// A pack tile is a native button: it is always actionable (an unaffordable
// pack still answers with a "Not enough coins" toast), so nothing here needs
// the role to come and go.
const PackCard = ({ item, onBuy }) => {
  const tier = item.type === 'pack' ? 'regular' : item.type;
  const look = PACK_LOOK[tier];
  const feature = tier !== 'regular';
  return (
    <button
      type="button"
      onClick={onBuy}
      aria-label={`Buy ${item.name} for ${item.price} ${item.currency}`}
      className={`panel-glass sheen relative w-full h-full rounded-2xl text-left transition-[transform,background-color] duration-200
        hover:-translate-y-0.5 hover:bg-night-700/60 ${FOCUS}
        ${tier === 'legendary' ? 'trim-brass' : ''} ${tier === 'premium' ? 'border-purple-300/25' : ''}
        ${feature
          ? 'flex items-center gap-4 p-4 sm:p-5'
          : 'flex items-center gap-3 p-3 pr-4 sm:flex-col sm:text-center sm:gap-3 sm:p-5'}`}
    >
      {/* The tier's own light, pooled behind the pack art. */}
      {feature && (
        <span
          aria-hidden="true"
          className={`absolute inset-0 pointer-events-none ${tier === 'legendary'
            ? 'bg-[radial-gradient(ellipse_55%_90%_at_12%_50%,rgba(251,191,36,0.2),transparent_70%)]'
            : 'bg-[radial-gradient(ellipse_55%_90%_at_12%_50%,rgba(192,132,252,0.18),transparent_70%)]'}`}
        />
      )}
      <span className={`relative shrink-0 grid place-items-center ${feature ? 'w-20 h-24' : 'w-[72px] h-16 sm:w-28 sm:h-24'}`}>
        <PackStack look={look} quantity={item.quantity} size={feature ? 'w-14 h-[76px]' : 'w-10 h-[54px] sm:w-14 sm:h-[76px]'} />
      </span>
      <span className={`relative flex-1 min-w-0 flex flex-col gap-0.5 ${feature ? '' : 'sm:items-center'}`}>
        <span className={`font-display font-extrabold leading-tight text-white ${feature ? 'text-xl' : 'text-base sm:text-lg'}`}>{item.name}</span>
        <span className="text-xs leading-snug text-plush-300">{item.description}</span>
        {feature && <PricePill currency={item.currency} price={item.price} className="mt-2.5 self-start" />}
      </span>
      {!feature && <PricePill currency={item.currency} price={item.price} className="relative" />}
    </button>
  );
};

// Each gem tier wears the next metal up the rarity ladder, pewter to brass, so
// the five tiles read as a ladder rather than five copies of one tile.
//
// Deliberately a pressable div, not a <button disabled>: while checkout is
// starting the tile stops being a control at all (no role, no tab stop, no
// name), which is what the e2e suite asserts — a disabled button would still be
// announced as a purchase the buyer cannot make.
const GemBundle = ({ bundle, tier, processing, onBuy }) => (
  <div
    {...pressable(onBuy, `Buy ${bundle.gems} gems for $${bundle.price.toFixed(2)}`, !processing)}
    // Every tile leaves room for the BEST VALUE pill from md up, so the five
    // medallions line up across the row; on a phone the best-value tile has a
    // row of its own and the others need not.
    className={`panel-glass sheen relative h-full rounded-2xl px-3 pb-4 flex flex-col items-center text-center cursor-pointer
      transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-night-700/60 ${FOCUS}
      ${bundle.popular ? 'trim-brass col-span-2 md:col-span-1 pt-10' : 'pt-6 md:pt-10'}`}
  >
    {bundle.popular && (
      <>
        <span aria-hidden="true" className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(251,191,36,0.22),transparent_70%)]" />
        <span className="absolute top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brass-300 text-night-950 px-2 py-[3px] label-caps text-[10px] leading-none whitespace-nowrap shadow-[0_4px_10px_-4px_rgba(217,119,6,0.9)]">
          BEST VALUE
        </span>
      </>
    )}
    <span
      aria-hidden="true"
      className="relative w-14 h-14 rounded-full p-[2px] shadow-[0_6px_14px_-6px_rgba(0,0,0,0.9)]"
      style={{ background: RARITY_METAL[RARITY_ORDER[tier]] }}
    >
      <span className="grid place-items-center w-full h-full rounded-full bg-night-900 bg-[radial-gradient(circle_at_50%_35%,rgba(232,121,249,0.25),transparent_65%)]">
        <Gem className="w-6 h-6 text-fuchsia-300" strokeWidth={2} />
      </span>
    </span>
    <span className="relative mt-3 font-display text-3xl font-extrabold leading-none text-white tabular-nums">
      {bundle.gems.toLocaleString()}
    </span>
    {bundle.bonus > 0 && <span className="relative mt-2 text-emerald-300 text-xs font-bold tracking-wide">+{bundle.bonus} BONUS</span>}
    {bundle.bonus > 0 && <span className="relative text-plush-300 text-[11px] mt-0.5">{bundle.gems + bundle.bonus} total</span>}
    <span className="relative mt-auto pt-4">
      <span className="btn-brass inline-flex items-center h-9 px-5 rounded-full font-display font-extrabold text-base tabular-nums">
        ${bundle.price.toFixed(2)}
      </span>
    </span>
  </div>
);

const TABS = [
  { id: 'packs', label: 'Card Packs', icon: Package },
  { id: 'gems', label: 'Buy Gems', icon: Gem },
  { id: 'special', label: 'Special Offers', icon: Star },
];

const TAB_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2 },
};

const Shop = ({ onClose }) => {
  const { coins, gems, cardPacks, buyShopItem, coinDoublerExpiresAt } = useGameStore();
  // Purchases re-render via the store subscription, but time ELAPSING is not a
  // store write — a dialog left open across the expiry would keep advertising
  // an "Active" booster that recordBattleResult (which recomputes from
  // Date.now()) no longer honors. Tick once a minute so the card follows the
  // clock, same pattern as the Challenges reset countdown.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const doubler = SHOP_ITEMS.find(i => i.id === 'coin_doubler');
  const doublerActive = typeof coinDoublerExpiresAt === 'number' && coinDoublerExpiresAt > now;
  const doublerHoursLeft = doublerActive
    ? Math.max(1, Math.ceil((coinDoublerExpiresAt - now) / 3_600_000))
    : 0;
  const { session } = useSupabaseAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('packs');
  const [processing, setProcessing] = useState(false);

  // handleGemPurchase sets `processing` and then hands the tab to Stripe via a
  // cross-document navigation, so the only setProcessing(false) — in the catch
  // — can never run. Pressing Back from Checkout restores this component from
  // the back/forward cache with its React state intact, i.e. processing still
  // true, and `processing && <overlay>` below is a full-screen blocking layer.
  // The shopper who changes their mind at the payment page comes back to a
  // spinner they cannot dismiss. pageshow with persisted=true is the one signal
  // that distinguishes a bfcache restore from a fresh mount.
  useEffect(() => {
    const onPageShow = (e) => { if (e.persisted) setProcessing(false); };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);
  const dialogRef = useDialog(onClose);

  useEffect(() => {
    analytics.trackShopView(activeTab);
  }, [activeTab]);

  const handleBuyItem = (item) => {
    const result = buyShopItem(item.id);
    if (result.success) {
      analytics.trackInGamePurchase({
        itemId: item.id,
        itemName: item.name,
        cost: item.price,
        currency: item.currency,
      });
      toast({ title: "Purchase Successful!", description: result.message });
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } else {
      toast({ title: "Purchase Failed", description: result.message, variant: "destructive" });
    }
  };

  const handleGemPurchase = async (bundle) => {
    if (!session?.user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to purchase gems.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      analytics.trackBeginCheckout({ bundleId: bundle.id, gems: bundle.gems, price: bundle.price });
      await redirectToStripeCheckout(bundle.id);
      // Browser navigates away — no further code runs here
    } catch (err) {
      analytics.trackError(err, 'gem_purchase');
      setProcessing(false);
      toast({
        title: "Checkout Failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const coinPacks = SHOP_ITEMS.filter(i => i.type === 'pack');
  const gemPacks = SHOP_ITEMS.filter(i => ['premium', 'legendary'].includes(i.type));

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Shop"
      // Scrolls, with the panel centred by my-auto rather than items-center: a
      // centred flex item taller than its box overflows at both ends.
      className="fixed inset-0 z-50 dialog-scrim flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative my-auto w-full max-w-4xl rounded-2xl dialog-panel overflow-hidden"
      >
        {/* Amber light over the counter. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-40 pointer-events-none bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgba(251,191,36,0.12),transparent_70%)]" />

        {/* Header. On a phone the balances drop to their own row under the
            title and the close control, so nothing is pushed off the edge. */}
        <div className="relative flex flex-wrap items-center gap-3 px-4 sm:px-6 pt-4 sm:pt-5 pb-4">
          <div className="flex items-center gap-3 min-w-0 mr-auto">
            <div aria-hidden="true" className="w-11 h-11 shrink-0 rounded-full p-[2px]" style={{ background: RARITY_METAL.legendary }}>
              <div className="grid place-items-center w-full h-full rounded-full bg-night-900">
                <Store className="w-5 h-5 text-brass-300" strokeWidth={2} />
              </div>
            </div>
            <h2 className="font-display text-3xl font-extrabold leading-none text-brass-gradient">Shop</h2>
          </div>
          <div className="order-last w-full sm:order-none sm:w-auto flex flex-wrap items-center gap-2">
            <Balance icon={Coins} value={coins.toLocaleString()} tone="text-brass-300" noun="coins" />
            <Balance icon={Gem} value={gems.toLocaleString()} tone="text-fuchsia-300" noun="gems" />
            <Balance icon={Package} value={cardPacks.toLocaleString()} tone="text-sky-300" noun="card packs" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`btn-glass grid place-items-center w-10 h-10 shrink-0 rounded-xl ${FOCUS}`}
            aria-label="Close shop"
          >
            <X aria-hidden="true" className="w-5 h-5" strokeWidth={2.4} />
          </button>
        </div>

        {/* Tabs: a segmented control recessed into the panel. */}
        <div className="relative px-4 sm:px-6">
          <div className="flex gap-1 rounded-xl p-1 bg-night-950/70 border border-white/5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  // Which tab is active was conveyed only by a text colour and a
                  // bottom border, so a screen-reader user heard three identical
                  // buttons and no indication of which panel they were looking at.
                  // aria-pressed rather than role=tab: these are plain buttons, and
                  // claiming the tab role would also require tablist/tabpanel
                  // wiring and arrow-key navigation that is not implemented here.
                  aria-pressed={active}
                  className={`flex-1 min-w-0 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-lg px-1 py-2 sm:py-2.5
                    font-display font-bold text-[13px] sm:text-[15px] leading-tight transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300
                    ${active ? 'btn-glass border-brass-300/40 text-brass-200' : 'border border-transparent text-plush-300 hover:text-white'}`}
                >
                  <tab.icon aria-hidden="true" className={`w-4 h-4 shrink-0 ${active ? 'text-brass-300' : ''}`} strokeWidth={2.2} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* A floor under the tab panels from md up (the tallest, Card Packs),
            so switching tabs does not resize the dialog and re-centre it. */}
        <div className="relative px-4 sm:px-6 pt-5 pb-6 flex flex-col md:min-h-[31.5rem]">
          <AnimatePresence mode="wait">
            {activeTab === 'packs' && (
              <motion.div key="packs" {...TAB_MOTION}>
                <SectionHeading>Standard packs</SectionHeading>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {coinPacks.map(item => (
                    <PackCard key={item.id} item={item} onBuy={() => handleBuyItem(item)} />
                  ))}
                </div>
                <div className="mt-6">
                  <SectionHeading>Guaranteed packs</SectionHeading>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {gemPacks.map(item => (
                      <PackCard key={item.id} item={item} onBuy={() => handleBuyItem(item)} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'gems' && (
              <motion.div key="gems" {...TAB_MOTION} className="flex-1 flex flex-col">
                <div className="text-center mb-5">
                  <h3 className="font-display text-2xl font-extrabold text-white leading-tight">Get More Gems</h3>
                  <p className="mt-1 text-sm text-plush-300">Use gems to buy premium packs with guaranteed rare cards!</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {GEM_BUNDLES.map((bundle, tier) => (
                    <GemBundle key={bundle.id} bundle={bundle} tier={tier} processing={processing} onBuy={() => handleGemPurchase(bundle)} />
                  ))}
                </div>
                <div className="mt-auto pt-6">
                <div className="pt-4 border-t border-white/5 flex flex-col items-center gap-1 text-center text-plush-400 text-xs">
                  <p className="inline-flex items-center gap-1.5">
                    <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-emerald-300" strokeWidth={2.4} />
                    Secure payment processing powered by Stripe
                  </p>
                  <p>All purchases are final. See Terms of Service for details.</p>
                </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'special' && (
              <motion.div key="special" {...TAB_MOTION}>
                {/* The headline offer: brass-trimmed, the only brass button on the tab. */}
                <div className="panel-glass trim-brass relative overflow-hidden rounded-2xl p-5 sm:p-6 mb-4">
                  <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_90%_at_0%_0%,rgba(251,191,36,0.2),transparent_70%)]" />
                  <div className="relative flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
                    <div className="flex-1 min-w-0">
                      <div className="label-caps text-brass-300 mb-1.5">NEW PLAYER BOOST</div>
                      <h3 className="font-display text-3xl font-extrabold leading-tight text-brass-gradient">Starter Gem Pack</h3>
                      <p className="mt-1 text-plush-200">A big gem boost to get you started.</p>
                      <ul className="mt-4 space-y-2 text-sm text-plush-100">
                        {[
                          { icon: Gem, tone: 'text-fuchsia-300', text: '300 Gems' },
                          { icon: Package, tone: 'text-sky-300', text: 'Spend them on Premium & Legendary card packs' },
                          { icon: Coins, tone: 'text-brass-300', text: '…or Coin bags in the shop' },
                        ].map(({ icon: Icon, tone, text }) => (
                          <li key={text} className="flex items-center gap-2.5">
                            <span aria-hidden="true" className="grid place-items-center w-6 h-6 shrink-0 rounded-full bg-night-950/60 border border-white/10">
                              <Icon className={`w-3.5 h-3.5 ${tone}`} strokeWidth={2.4} />
                            </span>
                            {text}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col items-center text-center md:min-w-[13rem] rounded-xl bg-night-950/45 border border-white/5 px-5 py-4">
                      <div className="font-display text-4xl font-extrabold leading-none text-white tabular-nums">$4.99</div>
                      <div className="mt-2 text-emerald-300 text-sm font-semibold">vs 160 gems in the $2.99 pack</div>
                      <button
                        type="button"
                        onClick={() => handleGemPurchase({ id: 'starter_bundle', gems: 300, bonus: 0, price: 4.99 })}
                        disabled={processing}
                        className={`${ACTION} btn-brass mt-4 h-11 w-full px-8 text-base`}
                      >
                        {processing ? '…' : 'Buy Now'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="panel-glass relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col">
                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_90%_at_0%_0%,rgba(192,132,252,0.16),transparent_70%)]" />
                    <div className="relative flex items-start gap-3">
                      <span aria-hidden="true" className="w-11 h-11 shrink-0 rounded-full p-[2px]" style={{ background: RARITY_METAL.epic }}>
                        <span className="grid place-items-center w-full h-full rounded-full bg-night-900">
                          <Gem className="w-5 h-5 text-fuchsia-300" strokeWidth={2} />
                        </span>
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-display text-lg font-extrabold leading-tight text-white">Mega Gem Pack</h4>
                        <p className="mt-0.5 text-plush-300 text-sm">A one-time gem boost — credited instantly.</p>
                      </div>
                    </div>
                    <div className="relative mt-4 pt-3 border-t border-white/5 flex justify-between items-center gap-3">
                      <span className="font-display font-extrabold text-fuchsia-200">350 gems</span>
                      <button
                        type="button"
                        onClick={() => handleGemPurchase({ id: 'weekly_gem_pass', gems: 350, bonus: 0, price: 5.99 })}
                        disabled={processing}
                        className={`${ACTION} btn-glass h-10 px-4 text-[15px] tabular-nums`}
                      >
                        $5.99
                      </button>
                    </div>
                  </div>

                  <div className={`panel-glass relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col ${
                    doublerActive ? 'border-emerald-300/60' : ''
                  }`}>
                    <div
                      aria-hidden="true"
                      className={`absolute inset-0 pointer-events-none ${doublerActive
                        ? 'bg-[radial-gradient(ellipse_70%_100%_at_0%_0%,rgba(52,211,153,0.16),transparent_70%)]'
                        : 'bg-[radial-gradient(ellipse_60%_90%_at_0%_0%,rgba(52,211,153,0.1),transparent_70%)]'}`}
                    />
                    <div className="relative flex items-start gap-3">
                      <span aria-hidden="true" className="w-11 h-11 shrink-0 rounded-full p-[2px]" style={{ background: RARITY_METAL.uncommon }}>
                        <span className="grid place-items-center w-full h-full rounded-full bg-night-900">
                          <Coins className="w-5 h-5 text-emerald-300" strokeWidth={2} />
                        </span>
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-display text-lg font-extrabold leading-tight text-white">Coin Doubler</h4>
                        <p className="mt-0.5 text-plush-300 text-sm">
                          {doublerActive
                            ? `Active — every battle pays double for ${doublerHoursLeft} more hour${doublerHoursLeft === 1 ? '' : 's'}.`
                            : `Double coins from every battle for ${doubler.durationHours}h!`}
                        </p>
                      </div>
                    </div>
                    <div className="relative mt-4 pt-3 border-t border-white/5 flex justify-between items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-emerald-300 text-sm font-semibold">
                        {doublerActive
                          ? <Timer aria-hidden="true" className="w-4 h-4" strokeWidth={2.4} />
                          : <Sparkles aria-hidden="true" className="w-4 h-4" strokeWidth={2.4} />}
                        <span>{doublerActive ? `${doublerHoursLeft}h left` : 'Pays out as you play'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleBuyItem(doubler)}
                        disabled={gems < doubler.price}
                        // The accessible name must track the state AND contain
                        // the visible text (WCAG 2.5.3 Label in Name): a voice
                        // user saying "Click Extend" gets no match if the name
                        // still says "Buy", and a screen reader announcing
                        // "Buy" hides that this extends a running booster.
                        aria-label={`${doublerActive ? 'Extend' : 'Buy'} Coin Doubler for ${doubler.price} gems`}
                        className={`${ACTION} btn-glass h-10 px-4 text-[15px] tabular-nums`}
                      >
                        <Gem aria-hidden="true" className="w-4 h-4 text-fuchsia-300" strokeWidth={2.4} />
                        {doubler.price}{doublerActive ? ' · Extend' : ''}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {processing && (
        // The spin is CSS (compositor-only) and stops when motion is off.
        <div className="fixed inset-0 z-[60] dialog-scrim grid place-items-center p-4" role="status">
          <div className="dialog-panel rounded-2xl px-8 py-6 flex flex-col items-center gap-4">
            <div className="relative w-20 h-20" aria-hidden="true">
              <div className="absolute inset-0 rounded-full border-[3px] border-fuchsia-300/15 border-t-fuchsia-300 motion-safe:animate-spin [[data-motion=off]_&]:animate-none" />
              <div className="absolute inset-2 grid place-items-center rounded-full bg-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Gem className="w-7 h-7 text-fuchsia-300" strokeWidth={2} />
              </div>
            </div>
            <p className="label-caps text-plush-200">Opening secure checkout…</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shop;
