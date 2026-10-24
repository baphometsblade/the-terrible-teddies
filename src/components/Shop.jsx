import { useState, useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Package, Gem, Star, Coins, Timer, Sparkles, ShieldCheck, Percent, Check } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useGameStore, SHOP_ITEMS } from '../stores/gameStore';
import analytics from '../utils/analytics';
import { redirectToStripeCheckout, fetchOnePerAccountHoldings } from '../utils/stripe';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { useDialog } from '@/hooks/useDialog';
import { pressable } from '@/lib/a11y';
import { RARITY_METAL, RARITY_ORDER } from '@/lib/rarity';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';
import { Medallion, SectionHeading, WalletChips, DialogClose } from '@/components/ui/game-chrome';
import { ignoreKeyRepeat } from '@/lib/keyRepeat';
import { StoreTile, storeItems, bestValuePackId, useStoreBuy } from './StoreTile';
import { PackOddsDialog } from './PackOdds';

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
const ACTION =
  `inline-flex items-center justify-center gap-2 rounded-xl font-display font-bold whitespace-nowrap ${FOCUS_OUTLINE} ` +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const CHECKOUT_STATUS = 'Opening secure checkout…';

// Each gem tier wears the next metal up the rarity ladder, pewter to brass, so
// the five tiles read as a ladder rather than five copies of one tile.
//
// Deliberately a pressable div, not a <button disabled>: while checkout is
// starting the tile stops being a control at all (no role, no tab stop, no
// name), which is what the e2e suite asserts — a disabled button would still be
// announced as a purchase the buyer cannot make.
//
// The name ("Buy 3000 gems for $49.99") is pinned by the e2e suite, and a
// button's name makes its text presentational: BEST VALUE, the bonus and the
// total were never spoken, so the ladder sounded linear. They are its
// description instead.
const GemBundle = ({ bundle, tier, processing, onBuy }) => {
  const id = useId();
  const described = [
    bundle.popular && `${id}-best`,
    bundle.bonus > 0 && `${id}-bonus`,
    bundle.bonus > 0 && `${id}-total`,
  ].filter(Boolean).join(' ');
  return (
    <div
      {...pressable(onBuy, `Buy ${bundle.gems} gems for $${bundle.price.toFixed(2)}`, !processing)}
      aria-describedby={!processing && described ? described : undefined}
      // Every tile leaves room for the BEST VALUE pill from md up, so the five
      // medallions line up across the row; on a phone the best-value tile has a
      // row of its own and the others need not.
      className={`tile-glass sheen relative h-full rounded-2xl px-3 pb-4 flex flex-col items-center text-center cursor-pointer
        transition-transform duration-200 hover:-translate-y-0.5 ${FOCUS_OUTLINE}
        ${bundle.popular ? 'trim-brass col-span-2 md:col-span-1 pt-10' : 'pt-6 md:pt-10'}`}
    >
      {bundle.popular && (
        <>
          <span aria-hidden="true" className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(251,191,36,0.22),transparent_70%)]" />
          <span
            id={`${id}-best`}
            className="absolute top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brass-300 text-night-950 px-2 py-[3px] label-caps text-[10px] leading-none whitespace-nowrap shadow-[0_4px_10px_-4px_rgba(217,119,6,0.9)]"
          >
            BEST VALUE
          </span>
        </>
      )}
      <Medallion
        icon={Gem}
        size="md"
        metal={RARITY_METAL[RARITY_ORDER[tier]]}
        iconClassName="text-fuchsia-300"
        discClassName="bg-[radial-gradient(circle_at_50%_35%,rgba(232,121,249,0.25),transparent_65%)]"
        className="shadow-[0_6px_14px_-6px_rgba(0,0,0,0.9)]"
      />
      <span className="relative mt-3 font-display text-3xl font-extrabold leading-none text-white tabular-nums">
        {bundle.gems.toLocaleString()}
      </span>
      {bundle.bonus > 0 && <span id={`${id}-bonus`} className="relative mt-2 text-emerald-300 text-xs font-bold tracking-wide">+{bundle.bonus.toLocaleString()} BONUS</span>}
      {bundle.bonus > 0 && <span id={`${id}-total`} className="relative text-plush-300 text-[11px] mt-0.5">{(bundle.gems + bundle.bonus).toLocaleString()} total</span>}
      <span className="relative mt-auto pt-4">
        <span className="btn-brass inline-flex items-center h-9 px-5 rounded-full font-display font-extrabold text-base tabular-nums">
          ${bundle.price.toFixed(2)}
        </span>
      </span>
    </div>
  );
};

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

// `initialTab` is the tab it opens on: App sends a route to gems (the Battle
// Pass confirm, the empty Card Packs table) straight to "Buy Gems".
const Shop = ({ onClose, initialTab = 'packs' }) => {
  const { coins, gems, gemDebt, cardPacks, premiumPacks, legendaryPacks, coinDoublerExpiresAt } = useGameStore();
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
  // The Starter Gem Pack is one per account (the checkout function refuses a
  // second with a 409). Read the account's own purchases so a player who has
  // it sees it as claimed rather than meeting the refusal at the till. Until
  // the read answers, or if it fails, the offer stays on sale: the server
  // enforces the rule either way.
  const userId = session?.user?.id;
  const [starterClaimed, setStarterClaimed] = useState(false);
  useEffect(() => {
    if (!userId) return undefined;
    let live = true;
    fetchOnePerAccountHoldings(userId).then((held) => {
      if (live && held?.has('starter_bundle')) setStarterClaimed(true);
    });
    return () => { live = false; };
  }, [userId]);
  // Where focus goes when a tap on Buy Now comes back refused: the button it
  // was on has just been replaced by the claimed note.
  const starterClaimedRef = useRef(null);
  const focusStarterClaimed = useRef(false);
  const [activeTab, setActiveTab] = useState(TABS.some((t) => t.id === initialTab) ? initialTab : 'packs');
  const [showOdds, setShowOdds] = useState(false);
  const [processing, setProcessing] = useState(false);
  // Read by the Escape handler, which must see the current value.
  const processingRef = useRef(false);
  processingRef.current = processing;
  // The control that started a checkout, so focus can go back to it if the
  // checkout fails or the buyer comes Back from Stripe.
  const checkoutTriggerRef = useRef(null);

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
  // Not while a checkout is starting: closing the shop would not stop it, and
  // the buyer who pressed Escape to back out was sent to Stripe a moment later.
  const dialogRef = useDialog(() => { if (!processingRef.current) onClose(); });

  // While checkout starts, everything behind the overlay is inert (no pointer,
  // no keyboard, nothing for a screen reader), so focus — whose control has
  // just gone inert under it — is held on the dialog itself; when it ends it
  // goes back to the control that started it.
  const wasProcessing = useRef(false);
  useEffect(() => {
    const root = dialogRef.current;
    if (processing) {
      wasProcessing.current = true;
      root?.focus({ preventScroll: true });
      return;
    }
    if (!wasProcessing.current) return;
    wasProcessing.current = false;
    const trigger = checkoutTriggerRef.current;
    if (trigger?.isConnected && root?.contains(trigger)) trigger.focus({ preventScroll: true });
  }, [processing, dialogRef]);

  // The dialog is the only thing that can hold focus mid-checkout; Tab has
  // nowhere to go, and would otherwise walk out of the dialog past the inert
  // panel.
  const onDialogKeyDown = (e) => {
    if (processingRef.current && e.key === 'Tab') e.preventDefault();
  };

  useEffect(() => {
    analytics.trackShopView(activeTab);
  }, [activeTab]);

  // Gem-priced items are bought from a confirm (confirmNode), so the result
  // comes back later, through the callback.
  const { requestBuy, confirmNode } = useStoreBuy();
  const handleBuyItem = (item) => {
    // Re-read the clock: `now` only ticks once a minute, so it predates the
    // purchase, and a 24h Coin Doubler bought a moment ago read "25h left".
    requestBuy(item, (result) => { if (result.success) setNow(Date.now()); });
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

    checkoutTriggerRef.current = document.activeElement;
    setProcessing(true);
    try {
      analytics.trackBeginCheckout({ bundleId: bundle.id, gems: bundle.gems, price: bundle.price });
      await redirectToStripeCheckout(bundle.id);
      // Browser navigates away — no further code runs here
    } catch (err) {
      analytics.trackError(err, 'gem_purchase');
      setProcessing(false);
      if (err?.code === 'already_purchased') {
        // Not a failure to retry: this account has had its one.
        setStarterClaimed(true);
        focusStarterClaimed.current = true;
        toast({ title: 'Already claimed', description: err.message });
        return;
      }
      toast({
        title: "Checkout Failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Declared after the effect that hands focus back to the checkout trigger,
  // so it runs after it and wins: that trigger is gone.
  useEffect(() => {
    if (processing || !starterClaimed || !focusStarterClaimed.current) return;
    focusStarterClaimed.current = false;
    starterClaimedRef.current?.focus({ preventScroll: true });
  }, [processing, starterClaimed]);

  const coinPacks = storeItems(['pack']);
  const gemPacks = storeItems(['premium', 'legendary']);
  const coinBags = storeItems(['coins']);
  const bestValue = bestValuePackId();

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Shop"
      // Focusable only while it holds focus for a starting checkout.
      tabIndex={processing ? -1 : undefined}
      onKeyDown={onDialogKeyDown}
      // Scrolls. From md the panel is centred by my-auto rather than
      // items-center (a centred flex item taller than its box overflows at
      // both ends); below md it is pinned to the top, because there the tab
      // panels differ in height and a centred panel jumped ~145px under the
      // finger on every tab switch.
      // While checkout starts it does not scroll either: there is nothing
      // behind the overlay to scroll to.
      className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center ${SCRIM_PAD} outline-none ${
        processing ? 'overflow-hidden' : 'overflow-y-auto'
      }`}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        // React 18 has no boolean `inert`; the empty string sets the attribute.
        inert={processing ? '' : undefined}
        className="relative md:my-auto w-full max-w-4xl rounded-2xl dialog-panel overflow-hidden"
      >
        {/* Amber light over the counter. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-40 pointer-events-none bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgba(251,191,36,0.12),transparent_70%)]" />

        {/* Header. On a phone the balances drop to their own row under the
            title and the close control, so nothing is pushed off the edge. */}
        <div className="relative flex flex-wrap items-center gap-3 px-4 sm:px-6 pt-4 sm:pt-5 pb-4">
          <div className="flex items-center gap-3 min-w-0 mr-auto">
            <Medallion icon={Store} />
            <h2 className="font-display text-3xl font-extrabold leading-none text-brass-gradient">Shop</h2>
          </div>
          {/* The same wallet, in the same slot, as Card Packs: every tier of
              pack counts, so a player holding only a Legendary pack no longer
              reads 0 here. */}
          <WalletChips
            className="order-last w-full sm:order-none sm:w-auto"
            coins={coins}
            gems={gems}
            gemDebt={gemDebt}
            packs={{ regular: cardPacks, premium: premiumPacks, legendary: legendaryPacks }}
          />
          <DialogClose label="Close shop" onClick={onClose} />
        </div>

        {/* Tabs: a segmented control recessed into the panel. Below sm each
            key stacks its icon over its label, top-aligned: at 320 "Special
            Offers" takes two lines, and centred columns put its icon higher
            than its neighbours'. */}
        <div className="relative px-4 sm:px-6">
          <div className="seg-well flex gap-1">
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
                  className={`flex-1 min-w-0 flex flex-col sm:flex-row items-center justify-start sm:justify-center gap-1 sm:gap-2 rounded-lg px-1 py-2 sm:py-2.5
                    font-display font-bold text-[13px] sm:text-[15px] leading-tight ${FOCUS_OUTLINE}
                    ${active ? 'seg-on' : 'seg-off'}`}
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
                    <StoreTile key={item.id} item={item} bestValue={item.id === bestValue} onBuy={handleBuyItem} />
                  ))}
                </div>
                <div className="mt-6">
                  {/* The odds, before purchase: two of these tiers are sold
                      for gems, which are bought with real money. */}
                  <SectionHeading
                    action={(
                      <button
                        type="button"
                        onClick={() => setShowOdds(true)}
                        // 44px tall for a finger, but in the line's 16px:
                        // it reaches 17px up into the space above the
                        // heading and 11px down, short of the tiles 12px
                        // below (the first tile would cover its foot), and
                        // pt-1.5 keeps the words on the heading's line.
                        className={`inline-flex min-h-11 items-center gap-1 -mt-[17px] -mb-[11px] pt-1.5 px-1.5 rounded-md text-xs font-semibold whitespace-nowrap text-brass-200 hover:text-white ${FOCUS_RING}`}
                      >
                        {/* Shed below 360px, with the heading's hairline, so
                            the label stays on one line beside the heading. */}
                        <Percent aria-hidden="true" className="hidden min-[360px]:block w-3.5 h-3.5" strokeWidth={2.4} />
                        View odds
                      </button>
                    )}
                  >
                    Guaranteed packs
                  </SectionHeading>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {gemPacks.map(item => (
                      <StoreTile key={item.id} item={item} onBuy={handleBuyItem} />
                    ))}
                  </div>
                </div>
                {/* Gems for coins. Sold here and under the Card Packs table
                    alike — coins_large used to be sold nowhere, while the
                    Starter offer below pointed players at "Coin bags in the
                    shop". Two across from md, like the guaranteed packs: from
                    sm a half-width row left "Need 10 more" a 127px column. */}
                <div className="mt-6">
                  <SectionHeading>Coin bags</SectionHeading>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {coinBags.map(item => (
                      <StoreTile key={item.id} item={item} onBuy={handleBuyItem} />
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
                  {/* Said before the buyer pays, not after: the gems a bundle
                      brings pay what is owed first (creditGems), so the
                      balance rises by less than the bundle. */}
                  {gemDebt > 0 && (
                    <p data-gems-owed="" className="mx-auto mt-3 max-w-md rounded-xl bg-rose-950/40 px-4 py-2.5 text-sm text-rose-200 ring-1 ring-rose-300/20">
                      {`You owe ${gemDebt.toLocaleString()} gems after a reversed payment. The next gems you get, bought or earned, pay that first.`}
                    </p>
                  )}
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
                  {/* What the Stripe webhook actually does (eventRouting.js): a
                      full refund, or a chargeback that takes the money, takes
                      back the gems that payment bought, and any already spent
                      are owed (gameStore's gemDebt). This used to say purchases
                      were final, and point at a Terms of Service page that
                      does not exist. */}
                  <p>If a payment is fully refunded or charged back, the gems it bought are taken back, from future gems if they were already spent.</p>
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
                      {/* True now: the checkout function sells it once per account. */}
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
                      {starterClaimed ? (
                        // No button at all once it is used up: a control that
                        // can only be refused is a dead end. Focusable only by
                        // script, for the refused tap above.
                        <div
                          ref={starterClaimedRef}
                          tabIndex={-1}
                          className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400/10 font-display font-bold text-emerald-200 ring-1 ring-inset ring-emerald-300/40 ${FOCUS_OUTLINE}`}
                        >
                          <Check aria-hidden="true" className="h-4 w-4" strokeWidth={2.6} />
                          Claimed
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleGemPurchase({ id: 'starter_bundle', gems: 300, bonus: 0, price: 4.99 })}
                          disabled={processing}
                          className={`${ACTION} btn-brass mt-4 h-11 w-full px-8 text-base`}
                        >
                          {processing ? '…' : 'Buy Now'}
                        </button>
                      )}
                      <p className="mt-2 text-xs text-plush-300">
                        {starterClaimed ? "One per account, and you've had yours." : 'One per account.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="panel-glass relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col">
                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_60%_90%_at_0%_0%,rgba(192,132,252,0.16),transparent_70%)]" />
                    <div className="relative flex items-start gap-3">
                      <Medallion icon={Gem} metal={RARITY_METAL.epic} iconClassName="text-fuchsia-300" />
                      <div className="min-w-0">
                        <h4 className="font-display text-lg font-extrabold leading-tight text-white">Mega Gem Pack</h4>
                        <p className="mt-0.5 text-plush-300 text-sm">A one-time gem boost — credited as soon as your payment confirms.</p>
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
                      <Medallion icon={Coins} metal={RARITY_METAL.uncommon} iconClassName="text-emerald-300" />
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
                        onKeyDown={ignoreKeyRepeat}
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

      {/* Announced, so always mounted: a live region inserted already holding
          its text is not read by many screen readers. Outside the inert panel,
          and the overlay below is its picture (aria-hidden, so it is not read
          twice). */}
      <p role="status" className="sr-only">{processing ? CHECKOUT_STATUS : ''}</p>

      {showOdds && <PackOddsDialog onClose={() => setShowOdds(false)} />}
      {confirmNode}

      {processing && (
        // The spin is CSS (compositor-only) and stops when motion is off.
        <div aria-hidden="true" className={`fixed inset-0 z-[60] dialog-scrim grid place-items-center ${SCRIM_PAD}`}>
          <div className="dialog-panel rounded-2xl px-8 py-6 flex flex-col items-center gap-4">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-[3px] border-fuchsia-300/15 border-t-fuchsia-300 motion-safe:animate-spin [[data-motion=off]_&]:animate-none" />
              <div className="absolute inset-2 grid place-items-center rounded-full bg-night-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Gem className="w-7 h-7 text-fuchsia-300" strokeWidth={2} />
              </div>
            </div>
            <p className="label-caps text-plush-200">{CHECKOUT_STATUS}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shop;
