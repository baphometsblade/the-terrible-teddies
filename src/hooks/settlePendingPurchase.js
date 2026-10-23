import { supabase, fetchServerGemBalance } from '../utils/supabaseClient';
import {
  verifyPurchaseSession, pendingPurchase, forgetPendingPurchase, purchaseOnScreen,
} from '../utils/pendingPurchase';
import { useGameStore } from '../stores/gameStore';
import { toast } from '@/components/ui/use-toast';

let inFlight = null;

/**
 * Settle a payment the player came back from before Stripe confirmed it.
 * useRehydrateOnFocus calls this each time the tab comes back to the front.
 *
 * Before this, a buyer who left the "Processing…" screen early got their
 * gems only at the next login or token refresh, though the copy promised
 * them "within a minute". Now one check runs per return to the tab while a
 * payment is pending (never otherwise: no marker, no request). Once the row
 * says completed, the server balance is read and reconciled for the account
 * that is signed in, and the marker is dropped; a refunded or disputed row
 * drops it too, since there is nothing to credit.
 *
 * The reconcile keeps its two guarantees: it credits only the rise above the
 * high-water mark (so a second settle, or the purchase screen doing the same,
 * adds nothing), and it is bound to the account the balance was read for.
 *
 * @returns {Promise<'none'|'on-screen'|'signed-out'|'pending'|'credited'|'unconfirmed'|'other-account'|'refunded'|'refunded_duplicate'|'disputed'>}
 */
export function settlePendingPurchase() {
  // focus and visibilitychange arrive together: one check, not two.
  if (!inFlight) inFlight = settle().finally(() => { inFlight = null; });
  return inFlight;
}

async function settle() {
  const pending = pendingPurchase();
  if (!pending) return 'none';
  // The purchase screen is checking this payment itself.
  if (purchaseOnScreen()) return 'on-screen';

  // The session is held locally; reading it costs no request.
  const { data } = await supabase.auth.getSession();
  const uid = data?.session?.user?.id;
  if (!uid) return 'signed-out';

  const purchase = await verifyPurchaseSession(pending.sessionId, 1);
  // refunded_duplicate: a second paid one-per-account offer, refunded by the
  // webhook instead of credited. Settled, with nothing to credit.
  if (!purchase || !['completed', 'refunded', 'refunded_duplicate', 'disputed'].includes(purchase.status)) return 'pending';

  if (purchase.status !== 'completed') {
    forgetPendingPurchase(pending.sessionId);
    return purchase.status;
  }

  const balance = await fetchServerGemBalance(uid);
  // Credited server-side, but this device could not read the new balance:
  // keep the marker, so the next return tries again.
  if (balance === null) return 'unconfirmed';
  // The save now belongs to someone else (the account changed while the
  // check was out). The reconcile would refuse to credit it anyway, and
  // announcing the payment would tell the next player about the previous
  // buyer's gems. Say nothing and keep the marker; the buyer's own login
  // reconciles their balance.
  const owner = useGameStore.getState().ownerUserId;
  if (owner !== null && owner !== uid) return 'other-account';
  useGameStore.getState().reconcileServerGems(balance, uid);
  forgetPendingPurchase(pending.sessionId);
  toast({
    title: 'Payment confirmed',
    description: `${purchase.gems_granted.toLocaleString()} gems from your purchase are on your account.`,
  });
  return 'credited';
}
