import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { useGameStore } from '../stores/gameStore';
import { verifyPurchaseSession } from '../utils/stripe';
import { fetchServerGemBalance } from '../utils/supabaseClient';
import confetti from 'canvas-confetti';
import analytics from '../utils/analytics';
import { useDialog } from '@/hooks/useDialog';

// Gem bundle prices for analytics (mirrors server-side definitions)
const BUNDLE_PRICES = {
  gems_small: 0.99, gems_medium: 2.99, gems_large: 9.99,
  gems_huge: 19.99, gems_mega: 49.99, starter_bundle: 4.99, weekly_gem_pass: 5.99,
};

const PurchaseSuccess = ({ sessionId, onDone }) => {
  const { reconcileServerGems } = useGameStore();
  const [phase, setPhase] = useState('verifying'); // verifying | success | pending | error
  const [gemsGranted, setGemsGranted] = useState(0);
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

        const serverBalance = await fetchServerGemBalance();
        if (!mountedRef.current) return;
        if (serverBalance !== null) reconcileServerGems(serverBalance);

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

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Purchase status"
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gradient-to-b from-night-700 to-night-900 rounded-2xl p-8 max-w-md w-full border border-plush-700/60 shadow-2xl text-center"
      >
        {phase === 'verifying' && (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              className="text-6xl mb-6 inline-block"
            >
              💎
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">Verifying Payment…</h2>
            <p className="text-white/60 text-sm mb-6">Hang tight while we confirm your purchase.</p>
            {/* Manual escape hatch: if the verification hangs (a slow/stalled
                network), the buyer must not be trapped on a control-free spinner.
                Escape stays disabled here to avoid an accidental mid-check
                dismissal, but this explicit control lets them leave — any
                credited gems reconcile on the next login, so nothing is lost. */}
            <button
              onClick={onDone}
              className="text-white/40 hover:text-white/70 text-sm underline underline-offset-2"
            >
              Taking too long? Close and check back later
            </button>
          </>
        )}

        {phase === 'success' && (
          <>
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-white mb-2">Purchase Complete!</h2>
            <p className="text-purple-300 text-lg mb-6">
              <span className="font-bold text-white text-2xl">{gemsGranted.toLocaleString()} 💎</span>
              <br />added to your account
            </p>
            <Button
              onClick={onDone}
              className="bg-gradient-to-r from-purple-700 to-fuchsia-800 hover:from-purple-800 hover:to-fuchsia-900 text-white px-8 py-3 font-bold text-lg"
            >
              Awesome! Let&apos;s Play
            </Button>
          </>
        )}

        {phase === 'pending' && (
          <>
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold text-white mb-2">Processing…</h2>
            <p className="text-white/70 mb-2">
              Your payment was received. Gems will appear within a minute.
            </p>
            <p className="text-white/50 text-sm mb-6">
              We&apos;re checking automatically. If gems don&apos;t appear, contact support with your order confirmation email.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => { pollTriesRef.current = 0; verify(); }} className="bg-purple-600 hover:bg-purple-700 text-white">
                Check now
              </Button>
              <Button onClick={onDone} variant="outline" className="border-white/30 text-white hover:bg-white/10">
                Return to Game
              </Button>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="text-6xl mb-4">😢</div>
            <h2 className="text-2xl font-bold text-white mb-2">Something Went Wrong</h2>
            <p className="text-white/70 mb-6">
              If you were charged, please contact support — we&apos;ll sort it out immediately.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => { pollTriesRef.current = 0; synced.current = false; verify(); }}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Try Again
              </Button>
              <Button onClick={onDone} variant="outline" className="border-white/30 text-white hover:bg-white/10">
                Return to Game
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default PurchaseSuccess;
