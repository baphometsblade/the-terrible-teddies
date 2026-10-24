import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Gem, Hourglass, CircleAlert, Undo2, ShieldAlert, Mail } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import {
  verifyPurchaseSession, rememberPendingPurchase, forgetPendingPurchase, watchPurchaseOnScreen,
} from '../utils/pendingPurchase';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/support';
import { fetchServerGemBalance } from '../utils/supabaseClient';
import { trackPurchaseOnce } from '../utils/purchaseAnalytics';
import { useDialog } from '@/hooks/useDialog';
import { RARITY_METAL } from '@/lib/rarity';
import { celebrate } from '@/lib/celebrate';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/focus';
import { SCRIM_PAD } from '@/lib/safeArea';

// Reads of the post-purchase gem balance before giving up on showing it here.
// The gems are already credited server-side; this only decides whether this
// device's counter can be updated now or catches up on the next launch.
const BALANCE_READ_ATTEMPTS = 3;

/**
 * How long to wait before the background check number `n` (0-based) while a
 * payment is pending, or null once the screen should stop and say so. Quick
 * at first, when a slow webhook is likeliest to land, then slower: six at
 * 4 s, four at 15 s, then every 30 s, about ten minutes in all. It used to
 * stop after six checks (~24 s) while still saying "We're checking
 * automatically", and then sat there saying it.
 */
export const pendingPollDelay = (n) => {
  if (n < 6) return 4_000;
  if (n < 10) return 15_000;
  if (n < 27) return 30_000;
  return null;
};

// Plain <button>s rather than the shadcn Button: its bg-primary is a utility
// and would beat the component-layer btn-brass / btn-glass materials. Every
// ACTION wears one, so it takes the outline, which leaves their shadow alone.
const ACTION = `inline-flex items-center justify-center gap-2 h-11 rounded-xl font-display font-bold whitespace-nowrap ${FOCUS_OUTLINE}`;

// The medallion and the light it sits in, per phase: brass for a completed
// purchase, amethyst while the order is in flight, pewter for a payment that
// was reversed or could not be checked.
const PHASE_LOOK = {
  verifying: { metal: RARITY_METAL.epic, light: 'rgba(192, 132, 252, 0.18)' },
  success: { metal: RARITY_METAL.legendary, light: 'rgba(251, 191, 36, 0.3)' },
  pending: { metal: RARITY_METAL.epic, light: 'rgba(192, 132, 252, 0.18)' },
  refunded: { metal: RARITY_METAL.common, light: 'rgba(129, 140, 248, 0.14)' },
  duplicate: { metal: RARITY_METAL.common, light: 'rgba(129, 140, 248, 0.14)' },
  disputed: { metal: RARITY_METAL.common, light: 'rgba(129, 140, 248, 0.14)' },
  error: { metal: RARITY_METAL.common, light: 'rgba(129, 140, 248, 0.14)' },
};

// What a question about this payment is about, per phase, for the mailto.
const SUPPORT_SUBJECT = {
  pending: 'Gems not received',
  refunded: 'Refunded payment',
  duplicate: 'Refunded payment',
  disputed: 'Disputed payment',
  error: 'Gems not received',
};

// The payment's reference, and the way to ask about it. Stripe's Checkout
// session id is what the support side can look the payment up by. With an
// address configured it is a prefilled email; without one, the reference is
// shown for the buyer to keep, and no contact is invented.
const PaymentReference = ({ sessionId, phase }) => {
  const mailto = supportMailto(sessionId, SUPPORT_SUBJECT[phase] ?? 'Payment question');
  return (
    <div className="mb-6 rounded-xl bg-night-950/45 border border-white/5 px-4 py-3 text-left">
      <p className="label-caps text-plush-300">Order reference</p>
      {/* select-all: one tap selects the whole id, for copying. */}
      <p className="mt-1 select-all break-all font-mono text-[13px] leading-snug text-white">{sessionId}</p>
      {mailto ? (
        <>
          <p className="mt-2 text-sm text-plush-200">Questions about this payment?</p>
          {/* Its own line, the icon on the first line of the text, so a
              long address wraps under itself rather than under the icon. */}
          <a
            href={mailto}
            className={`mt-1 flex w-fit max-w-full items-start gap-1.5 rounded-sm text-sm font-semibold text-brass-200 underline underline-offset-4 decoration-brass-300/60 hover:text-white ${FOCUS_RING}`}
          >
            <Mail aria-hidden="true" className="mt-[3px] h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
            <span className="min-w-0 [overflow-wrap:anywhere]">Email {SUPPORT_EMAIL}</span>
          </a>
        </>
      ) : (
        <p className="mt-2 text-sm text-plush-200">Keep this reference: it identifies this payment if you need help with it.</p>
      )}
    </div>
  );
};

const PurchaseSuccess = ({ sessionId, onDone }) => {
  const { reconcileServerGems } = useGameStore();
  const [phase, setPhase] = useState('verifying'); // verifying | success | pending | refunded | duplicate | disputed | error
  // The background checks have run their course (see pendingPollDelay).
  const [stalled, setStalled] = useState(false);
  // A "Check now" in flight, and when the last one came back still pending.
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);
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

  // While this screen is checking the payment itself (verifying, pending,
  // stalled or after an error: see the return-to-tab effect below), a return
  // to the tab must not check it a second time and announce it twice. Once it
  // has stopped, a success whose balance could not be read included, the
  // hold goes, so settlePendingPurchase can finish what is left.
  const checksItself = phase === 'verifying' || phase === 'pending' || phase === 'error';
  useEffect(() => (checksItself ? watchPurchaseOnScreen() : undefined), [checksItself]);

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
        // The marker goes only once the gems are on this device. Dropped
        // earlier, a balance that could not be read, or the buyer closing the
        // screen during the reads, gave up the pick-up on the next return to
        // the tab, and the gems waited for the next launch.
        if (serverBalance !== null) {
          reconcileServerGems(serverBalance);
          forgetPendingPurchase(sessionId);
        }
        setBalanceShown(serverBalance !== null);

        setGemsGranted(purchase.gems_granted);
        setPhase('success');

        celebrate({
          particleCount: 200, spread: 120, origin: { y: 0.45 },
          colors: ['#9333EA', '#A855F7', '#C084FC', '#E879F9', '#fbbf24'],
        });

        // Once per payment, however many places see it complete: if the
        // balance could not be read, settlePendingPurchase finishes the
        // credit later and would otherwise count the sale again.
        trackPurchaseOnce(sessionId, purchase);
      } else if (purchase && (purchase.status === 'refunded' || purchase.status === 'disputed')) {
        // Reversed at Stripe: there is nothing to wait for, and "gems will
        // appear" (what any non-completed row used to be told) is false.
        forgetPendingPurchase(sessionId);
        setPhase(purchase.status);
      } else if (purchase && purchase.status === 'refunded_duplicate') {
        // A second payment for a one-per-account offer (two checkouts, both
        // paid): the webhook refunded it in full rather than credit it twice.
        forgetPendingPurchase(sessionId);
        setPhase('duplicate');
      } else {
        // Not confirmed yet; the marker set on arrival stays.
        setPhase('pending');
      }
    } catch (_err) {
      if (mountedRef.current && !silent) setPhase('error');
    }
  }, [sessionId, reconcileServerGems]);

  // Once per payment. StrictMode runs this effect twice, and each run started
  // its own 12-attempt verification loop that nothing cancels (the loop lives
  // in verifyPurchaseSession), so a slow webhook cost 24 reads, not 12.
  const verifyStartedFor = useRef(null);
  useEffect(() => {
    if (verifyStartedFor.current === sessionId) return;
    verifyStartedFor.current = sessionId;
    // Remembered from the moment the buyer lands, so the gems can still land
    // (settlePendingPurchase) however this screen is left: mid-verification
    // ("Close and check back later"), after an error, or while pending.
    // Forgotten once the row says completed, refunded or disputed.
    rememberPendingPurchase(sessionId);
    verify();
  }, [verify, sessionId]);

  // If the webhook is still catching up ('pending'), keep re-checking in the
  // background, on pendingPollDelay's slowing schedule, so gems appear by
  // themselves once it credits. The attempt counter lives in a ref so it
  // survives phase flips (a local variable would reset every time the effect
  // re-ran, making the cap unreachable).
  const pollTriesRef = useRef(0);
  // Guards against stacking checks. verifyPurchaseSession polls internally 12
  // times with a back-off (~39 s end to end), and the old interval launched a
  // fresh one every 4 s with nothing checking whether the previous was still
  // running — synced.current only latches after a SUCCESSFUL verify, which is
  // exactly the case that never happens while the webhook is slow. Measured
  // with the purchases row absent: 68 requests in 75 s, ramping to ~5/second.
  // Each tick is one request (maxAttempts 1), and a tick never starts while a
  // check (a tick, or "Check now") is still out.
  const pollingRef = useRef(false);
  // Bumped by "Check now" to start the schedule over from its quick end.
  const [pollEpoch, setPollEpoch] = useState(0);
  useEffect(() => {
    if (phase !== 'pending' || stalled) return undefined;
    let cancelled = false;
    let timer = null;
    const schedule = () => {
      const delay = pendingPollDelay(pollTriesRef.current);
      if (delay === null) { setStalled(true); return; }
      timer = setTimeout(tick, delay);
    };
    const tick = async () => {
      if (cancelled) return;
      if (pollingRef.current) { schedule(); return; }
      pollingRef.current = true;
      pollTriesRef.current += 1;
      try {
        await verify(true, 1);
      } finally {
        pollingRef.current = false;
      }
      if (!cancelled) schedule();
    };
    schedule();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [phase, stalled, verify, pollEpoch]);

  // One check, now, without the spinner; then the schedule starts over,
  // since the buyer is evidently still watching.
  const checkNow = async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    setChecking(true);
    try {
      await verify(true, 1);
    } finally {
      pollingRef.current = false;
    }
    if (!mountedRef.current) return;
    setChecking(false);
    setCheckedAt(new Date());
    pollTriesRef.current = 0;
    setStalled(false);
    setPollEpoch((e) => e + 1);
  };

  // A return to this tab with the screen still open checks once, as Check
  // now does. The screen holds settlePendingPurchase off while it is up, and
  // a stalled one had stopped checking, so a phone buyer who switched apps
  // and came back to "Still Waiting for Stripe" was never told the payment
  // had since confirmed, though the screen says the game checks again then.
  // The listeners read checkNow through a ref, so a render does not re-add them.
  const checkNowRef = useRef(checkNow);
  checkNowRef.current = checkNow;
  const checksOnReturn = phase === 'pending' || phase === 'error';
  useEffect(() => {
    if (!checksOnReturn) return undefined;
    const onReturn = () => {
      // visibilitychange fires for hiding as well as showing.
      if (document.visibilityState === 'hidden') return;
      // focus and visibilitychange arrive together; checkNow runs one check.
      checkNowRef.current();
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [checksOnReturn]);

  // Each phase swaps the whole body, so the control that had focus (Check
  // now, Try Again, Return to Game) can vanish with it and drop focus to
  // <body>. When that happens, focus the new phase's main action. Only then:
  // focus that survived the swap, or lives elsewhere, is left where it is.
  const primaryRef = useRef(null);
  const shownPhase = useRef(phase);
  useEffect(() => {
    if (shownPhase.current === phase) return;
    shownPhase.current = phase;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    primaryRef.current?.focus();
  }, [phase]);

  const look = PHASE_LOOK[phase];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Purchase status"
      // Scrolls, with the panel centred by my-auto rather than items-center: a
      // centred flex item taller than its box overflows at both ends.
      className={`fixed inset-0 z-50 dialog-scrim flex items-start justify-center ${SCRIM_PAD} overflow-y-auto`}
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
            {(phase === 'refunded' || phase === 'duplicate') && <Undo2 className="h-9 w-9 text-plush-200" strokeWidth={1.75} />}
            {phase === 'disputed' && <ShieldAlert className="h-9 w-9 text-plush-200" strokeWidth={1.75} />}
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
              ref={primaryRef}
              type="button"
              onClick={onDone}
              className={`rounded-md px-1 text-plush-300 hover:text-white text-sm underline underline-offset-4 decoration-plush-400/60 ${FOCUS_RING}`}
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
              // is behind. The payment stays remembered, so a return to the
              // tab (settlePendingPurchase) or the login sync brings it level.
              <p className="text-plush-200 text-sm -mt-2 mb-6 rounded-xl bg-night-950/45 border border-white/5 px-4 py-3">
                We couldn&apos;t refresh your balance on this screen just now, so the
                counter may not show them yet. They&apos;re safely on your account, and
                show up next time you come back to this tab, or next time the game starts.
              </p>
            )}
            <button ref={primaryRef} type="button" onClick={onDone} className={`${ACTION} btn-brass px-8 text-lg`}>
              Awesome! Let&apos;s Play
            </button>
          </div>
        )}

        {phase === 'pending' && (
          <div className="relative">
            {/* Never "payment received" before Stripe says so: no row yet
                means Stripe has not confirmed the payment to us. */}
            {/* A size down on a phone: at 3xl the heading alone took three lines at 320. */}
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight text-white mb-2">
              {stalled ? 'Still Waiting for Stripe' : 'Waiting for Payment Confirmation'}
            </h2>
            {stalled ? (
              <p className="text-plush-200 mb-2">
                Stripe hasn&apos;t confirmed this payment yet. Nothing is lost: tap Check now, or come back later.
              </p>
            ) : (
              <p className="text-plush-200 mb-2">
                Stripe hasn&apos;t confirmed this payment yet. This screen keeps checking for about ten minutes, and adds your gems once it does.
              </p>
            )}
            <p className="text-plush-300 text-sm mb-5">
              If you leave, the game checks again each time you come back to this tab, and every time it starts.
            </p>
            {checkedAt && (
              <p className="text-plush-200 text-sm -mt-2 mb-5">
                {`Checked at ${checkedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}: not confirmed yet.`}
              </p>
            )}
            <PaymentReference sessionId={sessionId} phase="pending" />
            <div className="flex flex-wrap gap-3 justify-center">
              {/* aria-disabled rather than disabled while a check is out:
                  disabling the focused button would drop keyboard focus. */}
              <button
                ref={primaryRef}
                type="button"
                onClick={checkNow}
                aria-disabled={checking || undefined}
                className={`${ACTION} btn-brass px-6 text-base aria-disabled:cursor-wait aria-disabled:opacity-70`}
              >
                {checking ? 'Checking…' : 'Check now'}
              </button>
              <button type="button" onClick={onDone} className={`${ACTION} btn-glass px-6 text-base`}>
                Return to Game
              </button>
            </div>
          </div>
        )}

        {phase === 'refunded' && (
          <div className="relative">
            <h2 className="font-display text-3xl font-extrabold leading-tight text-white mb-2">Payment Refunded</h2>
            <p className="text-plush-200 mb-5">
              This payment was refunded, so its gems aren&apos;t on your account.
            </p>
            <PaymentReference sessionId={sessionId} phase="refunded" />
            <button ref={primaryRef} type="button" onClick={onDone} className={`${ACTION} btn-glass px-6 text-base`}>
              Return to Game
            </button>
          </div>
        )}

        {phase === 'duplicate' && (
          <div className="relative">
            <h2 className="font-display text-3xl font-extrabold leading-tight text-white mb-2">Payment Refunded</h2>
            {/* What stripe-webhook does with a second paid one-per-account
                offer: refunds the whole payment (refunds.create with no
                amount) and credits nothing. */}
            <p className="text-plush-200 mb-5">
              This offer is one per account, and this account already has it, so this payment was refunded in full.
              No gems were added for it.
            </p>
            <PaymentReference sessionId={sessionId} phase="duplicate" />
            <button ref={primaryRef} type="button" onClick={onDone} className={`${ACTION} btn-glass px-6 text-base`}>
              Return to Game
            </button>
          </div>
        )}

        {phase === 'disputed' && (
          <div className="relative">
            <h2 className="font-display text-3xl font-extrabold leading-tight text-white mb-2">Payment Disputed</h2>
            {/* What the webhook does: a dispute that takes the money takes the
                gems off (reverse_gem_purchase), and one settled in the
                payment's favour puts them back (restore_gem_purchase). */}
            <p className="text-plush-200 mb-5">
              This payment is being disputed with the card issuer, so its gems have been taken off your account for now.
              If the dispute is settled in the payment&apos;s favour, they come back automatically.
            </p>
            <PaymentReference sessionId={sessionId} phase="disputed" />
            <button ref={primaryRef} type="button" onClick={onDone} className={`${ACTION} btn-glass px-6 text-base`}>
              Return to Game
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="relative">
            <h2 className="font-display text-3xl font-extrabold leading-tight text-white mb-2">Something Went Wrong</h2>
            {/* It used to say "contact support" with no contact anywhere. */}
            <p className="text-plush-200 mb-5">
              We couldn&apos;t check this payment just now. If you were charged, your gems are added once Stripe
              confirms it, at the latest the next time the game starts.
            </p>
            <PaymentReference sessionId={sessionId} phase="error" />
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                ref={primaryRef}
                type="button"
                onClick={() => { pollTriesRef.current = 0; synced.current = false; setStalled(false); verify(); }}
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
