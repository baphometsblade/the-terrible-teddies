import { supabase, fetchServerGemBalance } from '../utils/supabaseClient';
import {
  verifyPurchaseSession, pendingPurchase, forgetPendingPurchase, purchaseOnScreen,
} from '../utils/pendingPurchase';
import { useGameStore, serverCreditAt } from '../stores/gameStore';
import { trackPurchaseOnce } from '../utils/purchaseAnalytics';
import { toast } from '@/components/ui/use-toast';

let inFlight = null;

// What a payment that will not be credited says, worded as the purchase
// screen's own phases are (PurchaseSuccess). The buyer left that screen
// before Stripe answered, so this is the only place they hear it: the marker
// used to be dropped in silence, and the duplicate-refund case (a second
// Starter Gem Pack paid in another tab) is exactly a buyer who left early.
// The purchases row is the buyer's own (purchases_select_own), so whoever
// reads it here is the account that paid.
export const SETTLED_NOTICE = {
  refunded: {
    title: 'Payment refunded',
    description: 'That payment was refunded, so its gems aren’t on your account.',
  },
  refunded_duplicate: {
    title: 'Payment refunded',
    description: 'That offer is one per account, and this account already has it, so the payment was refunded in full. No gems were added for it.',
  },
  disputed: {
    title: 'Payment disputed',
    description: 'That payment is being disputed with the card issuer, so its gems aren’t on your account for now. If the dispute is settled in its favour, they come back automatically.',
  },
};

/**
 * What a purchase announcement adds when gems were owed after a reversed
 * payment. Those are paid first from any gems coming in (creditGems), so the
 * counter rises by less than the purchase, and "550 gems added" over a
 * counter that went from 0 to 10 reads as a payment that never arrived: a
 * support ticket, or another chargeback. `credit` is how the credit that
 * carried the purchase was split (serverCreditAt), `stillOwed` the gems owed
 * now. Null when none of the purchase went to what was owed.
 */
export function owedLine(granted, credit, stillOwed) {
  const toDebt = Math.min(credit?.toDebt ?? 0, granted);
  if (!(toDebt > 0)) return null;
  const toBalance = granted - toDebt;
  if (toBalance > 0) {
    return `${toDebt.toLocaleString()} of them paid what was owed after a reversed payment, and ${toBalance.toLocaleString()} went to your balance.`;
  }
  return stillOwed > 0
    ? `All of them went to what was owed after a reversed payment, and ${stillOwed.toLocaleString()} gems are still owed.`
    : 'All of them paid what was owed after a reversed payment.';
}

/**
 * Settle a payment the player came back from before Stripe confirmed it.
 * useRehydrateOnFocus calls this each time the tab comes back to the front.
 *
 * Before this, a buyer who left the "Processing…" screen early got their
 * gems only at the next login or token refresh, though the copy promised
 * them "within a minute". Now one check runs per return to the tab while a
 * payment is pending (never otherwise: no marker, no request). Once the row
 * says completed, the server balance is read and reconciled for the account
 * that is signed in, the sale is counted, and the marker is dropped; a
 * refunded or disputed row drops it too, since there is nothing to credit,
 * and says why (SETTLED_NOTICE).
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
    // An announcement, queued: it arrives with the return to the tab, as the
    // cloud save's own notices do, and neither should cut the other short.
    toast({ queue: true, ...SETTLED_NOTICE[purchase.status] });
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
  // The sale, counted once per payment: the purchase screen may already have
  // counted it while leaving the credit to this (its balance read failed).
  trackPurchaseOnce(pending.sessionId, purchase);
  const owed = owedLine(purchase.gems_granted, serverCreditAt(balance), useGameStore.getState().gemDebt);
  toast({
    queue: true,
    title: 'Payment confirmed',
    description: `${purchase.gems_granted.toLocaleString()} gems from your purchase are on your account.${owed ? ` ${owed}` : ''}`,
  });
  return 'credited';
}
