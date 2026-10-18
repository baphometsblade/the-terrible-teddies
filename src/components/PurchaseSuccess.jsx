import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Gem, Hourglass, CircleAlert } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { verifyPurchaseSession } from '../utils/stripe';
import { fetchServerGemBalance } from '../utils/supabaseClient';
import confetti from 'canvas-confetti';
import analytics from '../utils/analytics';
import { useDialog } from '@/hooks/useDialog';
import { RARITY_METAL } from '@/lib/rarity';

// Gem bundle prices for analytics (mirrors server-side definitions)
const BUNDLE_PRICES = {
  gems_small: 0.99, gems_medium: 2.99, gems_large: 9.99,
  gems_huge: 19.99, gems_mega: 49.99, starter_bundle: 4.99, weekly_gem_pass: 5.99,
};

// Reads of the post-purchase gem balance before giving up on showing it here.
// The gems are already credited server-side; this only decides whether this
// device's counter can be updated now or catches up on the next launch.
const BALANCE_READ_ATTEMPTS = 3;

// Plain <button>s rather than the shadcn Button: its bg-primary is a utility
// and would beat the component-layer btn-brass / btn-glass materials.
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-night-900';
const ACTION = `inline-flex items-center justify-center gap-2 h-11 rounded-xl font-display font-bold whitespace-nowrap ${FOCUS}`;

// The medallion and the light it sits in, per phase: brass for a completed
// purchase, amethyst while the order is in flight, pewter for a failure.
const PHASE_LOOK = {
  verifying: { metal: RARITY_METAL.epic, light: 'rgba(192, 132, 252, 0.18)' },
  success: { metal: RARITY_METAL.legendary, light: 'rgba(251, 191, 36, 0.3)' },
  pending: { metal: RARITY_METAL.epic, light: 'rgba(192, 132, 252, 0.18)' },
  error: { metal: RARITY_METAL.common, light: 'rgba(129, 140, 248, 0.14)' },
};

const PurchaseSuccess = ({ sessionId, onDone }) => {
  const { reconcileServerGems } = useGameStore();
  const [phase, setPhase] = useState('verifying'); // verifying | success | pending | error
  const [gemsGranted, setGemsGranted] = useState(0);
  // Whether this device's gem counter actually reflects the purchase yet.
  const [balanceShown, setBalanceShown] = useState(true);
  const synced = useRef(false);
  const mountedRef = useRef(true);
  // Escape must not dismiss the dialog mid-verification — unmounting aborts
  // the in-flight check and the buyer's gems wouldn't appear until the next
  // full reload's login reconciliation.
  const dialogRef = useDialog(() => { if (phase !== 'verifying') onDone(); });

  useEffect(() => {
    // Reset on (re)mount, not just at init: React 18 StrictMode mounts, unmounts,
    // then remounts, and any real remount must clear the stale `false` left by the
    // previous cleanup — otherwise every post-await guard bails and the buyer is
    // stranded on the "Verifying…" spinner even though the purchase completed.
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // silent=true is used by the background re-poll: it must not flip the phase
  // to 'verifying', because that would unmount/remount the polling effect on
  // every tick (resetting its counter — the poll would never terminate) and
  // flash the spinner. A transient error during a silent poll also stays in
  // 'pending' so the next tick can retry.
  const verify = useCallback(async (silent = false, maxAttempts) => {
    if (!sessionId || synced.current) return;
    if (!silent && mountedRef.current) setPhase('verifying');
    try {
      const purchase = await verifyPurchaseSession(sessionId, maxAttempts);
      if (!mountedRef.current) return;

      if (purchase && purchase.status === 'completed') {
        if (synced.current) return;
        synced.current = true;

        // 'completed' is only ever written by fulfill_gem_purchase, in the
        // same transaction that credits user_gems — so the gems are on the
        // account by now. What can still fail is THIS device learning the new
        // balance: one flaky read returned null, the reconcile was skipped, and
        // the dialog announced "500 gems added to your account" over a gem
        // counter that had not moved. The buyer has just paid real money and is
        // watching it apparently not arrive — a support ticket, or a chargeback
        // that would then claw the gems back for real. Retry briefly, and if it
        // still fails, say what is true instead.
        let serverBalance = null;
        for (let attempt = 0; attempt < BALANCE_READ_ATTEMPTS; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 600 * attempt));
          if (!mountedRef.current) return;
          serverBalance = await fetchServerGemBalance();
          if (serverBalance !== null) break;
        }
        if (!mountedRef.current) return;
        if (serverBalance !== null) reconcileServerGems(serverBalance);
        setBalanceShown(serverBalance !== null);

        setGemsGranted(purchase.gems_granted);
        setPhase('success');

        confetti({
          particleCount: 200, spread: 120, origin: { y: 0.45 },
          colors: ['#9333EA', '#A855F7', '#C084FC', '#E879F9', '#fbbf24'],
        });

        analytics.trackPurchase({
          itemId: purchase.bundle_id,
          itemName: `${purchase.gems_granted} Gems`,
          price: BUNDLE_PRICES[purchase.bundle_id] ?? 0,
          currency: 'USD',
        });
      } else {
        setPhase('pending');
      }
    } catch (_err) {
      if (mountedRef.current && !silent) setPhase('error');
    }
  }, [sessionId, reconcileServerGems]);

  useEffect(() => {
    verify();
  }, [verify]);

  // If the webhook is still catching up ('pending'), keep re-polling in the
  // background so gems appear automatically once it credits — instead of
  // leaving the player on a dead-end screen. The attempt counter lives in a
  // ref so it survives phase flips (a local variable would reset every time
  // the effect re-ran, making the cap unreachable).
  const pollTriesRef = useRef(0);
  // Guards against stacking loops. verifyPurchaseSession polls internally 12
  // times with a back-off (~39 s end to end), and this interval used to launch
  // a fresh one every 4 s with nothing checking whether the previous was still
  // running — synced.current only latches after a SUCCESSFUL verify, which is
  // exactly the case that never happens while the webhook is slow. Measured
  // with the purchases row absent: 68 requests in 75 s, ramping to ~5/second,
  // with a worst case of 12 + 6x12 = 84 for a single purchase.
  const pollingRef = useRef(false);
  useEffect(() => {
    if (phase !== 'pending') return;
    const id = setInterval(async () => {
      if (pollTriesRef.current >= 6) { clearInterval(id); return; }
      if (pollingRef.current) return; // a tick is still in flight — do not stack
      pollingRef.current = true;
      pollTriesRef.current += 1;
      try {
        // maxAttempts 1: this tick IS the retry cadence, so the background path
        // is one request per 4 s rather than a nested 12-request back-off loop.
        await verify(true, 1);
      } finally {
        pollingRef.current = false;
      }
    }, 4000);
    return () => clearInterval(id);
  }, [phase, verify]);

  const look = PHASE_LOOK[phase];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Purchase status"
      // Scrolls, with the panel centred by my-auto rather than items-center: a
      // centred flex item taller than its box overflows at both ends.
      className="fixed inset-0 z-50 dialog-scrim flex items-start justify-center p-4 overflow-y-auto"
    >
      {/* aria-live: the whole body swaps between verifying / success /
          pending / error with focus staying put, so a screen-reader buyer was
          told nothing when "Verifying Payment…" became "Purchase Complete!" —
          on the one screen where they most need to know what happened. */}
      <motion.div
        aria-live="polite"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={`relative my-auto w-full max-w-md overflow-hidden rounded-2xl dialog-panel px-6 py-8 sm:px-8 text-center ${
          phase === 'success' ? 'trim-brass' : ''
        }`}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-48 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 60% 80% at 50% 0%, ${look.light}, transparent 70%)` }}
        />

        {/* key={phase}: the medallion pops once each time the phase changes. */}
        <motion.div
          key={phase}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={phase === 'success' ? { scale: [0.7, 1.15, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={{ duration: phase === 'success' ? 0.55 : 0.3 }}
          className="relative mx-auto mb-5 h-20 w-20 rounded-full p-[3px] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.9)]"
          style={{ background: look.metal }}
          aria-hidden="true"
        >
          <div className="relative flex h-full w-full items-center justify-center rounded-full bg-night-900">
            {phase === 'verifying' && (
              // CSS spin (compositor-only), stopped when motion is off.
              <div className="absolute inset-1.5 rounded-full border-2 border-fuchsia-300/15 border-t-fuchsia-300 motion-safe:animate-spin [[data-motion=off]_&]:animate-none" />
            )}
            {phase === 'verifying' && <Gem className="h-8 w-8 text-fuchsia-300" strokeWidth={1.75} />}
            {phase === 'success' && <Gem className="h-9 w-9 text-brass-300" strokeWidth={1.75} />}
            {phase === 'pending' && <Hourglass className="h-9 w-9 text-fuchsia-300" strokeWidth={1.75} />}
            {phase === 'error' && <CircleAlert className="h-9 w-9 text-plush-200" strokeWidth={1.75} />}
          </div>
        </motion.div>

        {phase === 'verifying' && (
          <div className="relative">
            <h2 className="font-display text-3xl font-extrabold leading-tight text-white mb-2">Verifying Payment…</h2>
            <p className="text-plush-300 text-sm mb-6">Hang tight while we confirm your purchase.</p>
            {/* Manual escape hatch: if the verification hangs (a slow/stalled
                network), the buyer must not be trapped on a control-free spinner.
                Escape stays disabled here to avoid an accidental mid-check
                dismissal, but this explicit control lets them leave — any
                credited gems reconcile on the next login, so nothing is lost. */}
            <button
              type="button"
              onClick={onDone}
              className={`rounded-md px-1 text-plush-300 hover:text-white text-sm underline underline-offset-4 decoration-plush-400/60 ${FOCUS}`}
            >
              Taking too long? Close and check back later
            </button>
          </div>
        )}

        {phase === 'success' && (
          <div className="relative">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold leading-tight text-brass-gradient mb-4">Purchase Complete!</h2>
            <div className="mb-6">
              <div className="panel-glass inline-flex items-center gap-2.5 rounded-xl px-5 py-2.5">
                <Gem aria-hidden="true" className="h-6 w-6 text-fuchsia-300" strokeWidth={2} />
                <span className="font-display text-3xl font-extrabold leading-none text-white tabular-nums">{gemsGranted.toLocaleString()}</span>
                <span className="sr-only">gems</span>
              </div>
              <p className="mt-2 text-plush-200">added to your account</p>
            </div>
            {!balanceShown && (
              // Not "something went wrong": nothing did. The purchase is
              // complete and credited; only this screen's copy of the balance
              // is behind, and the login sync brings it level on next launch.
              <p className="text-plush-200 text-sm -mt-2 mb-6 rounded-xl bg-night-950/45 border border-white/5 px-4 py-3">
                We couldn&apos;t refresh your balance on this screen just now, so the
                counter may not show them yet. They&apos;re safely on your account and
                will appear next time you open the game.
              </p>
            )}
            <button type="button" onClick={onDone} className={`${ACTION} btn-brass px-8 text-lg`}>
              Awesome! Let&apos;s Play
            </button>
          </div>
        )}

        {phase === 'pending' && (
          <div className="relative">
            <h2 className="font-display text-3xl font-extrabold leading-tight text-white mb-2">Processing…</h2>
            <p className="text-plush-200 mb-2">
              Your payment was received. Gems will appear within a minute.
            </p>
            <p className="text-plush-300 text-sm mb-6">
              We&apos;re checking automatically. If gems don&apos;t appear, contact support with your order confirmation email.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button type="button" onClick={() => { pollTriesRef.current = 0; verify(); }} className={`${ACTION} btn-brass px-6 text-base`}>
                Check now
              </button>
              <button type="button" onClick={onDone} className={`${ACTION} btn-glass px-6 text-base`}>
                Return to Game
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="relative">
            <h2 className="font-display text-3xl font-extrabold leading-tight text-white mb-2">Something Went Wrong</h2>
            <p className="text-plush-200 mb-6">
              If you were charged, please contact support — we&apos;ll sort it out immediately.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={() => { pollTriesRef.current = 0; synced.current = false; verify(); }}
                className={`${ACTION} btn-brass px-6 text-base`}
              >
                Try Again
              </button>
              <button type="button" onClick={onDone} className={`${ACTION} btn-glass px-6 text-base`}>
                Return to Game
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PurchaseSuccess;
