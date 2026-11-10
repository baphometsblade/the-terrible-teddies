import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { paymentProvider, checkoutFunctionName } from '@/lib/paymentProvider';
import { redirectToCheckout } from '@/utils/stripe';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useDialog } from '@/hooks/useDialog';
import { SCRIM_PAD } from '@/lib/safeArea';

// Once, on the menu, after the first win. Not during a fight (this is only
// mounted on the bare menu). Payments closed: nothing, not a dead button.
export const StarterOffer = () => {
  const paymentsOpen = paymentProvider() !== 'none';
  const wins = useGameStore((s) => s.totalWins);
  const dismissed = useGameStore((s) => s.starterOfferDismissed);
  const dismiss = useGameStore((s) => s.dismissStarterOffer);
  const show = paymentsOpen && !dismissed && (wins || 0) >= 1;
  const { session } = useSupabaseAuth();
  const [busy, setBusy] = useState(false);
  const ref = useDialog(() => { if (show) dismiss(); });
  if (!show) return null;

  const buy = async () => {
    const endpoint = checkoutFunctionName(paymentProvider());
    if (!endpoint || !session?.user || busy) return;
    setBusy(true);
    try {
      await redirectToCheckout('starter_bundle', endpoint);
    } catch (err) {
      setBusy(false);
      if (err?.code === 'already_purchased') dismiss();
    }
  };

  return (
    <div className={`fixed inset-0 z-[70] dialog-scrim flex items-end justify-center sm:items-center ${SCRIM_PAD}`}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="starter-offer-title" className="w-full max-w-md rounded-2xl dialog-panel px-5 py-5">
        <div className="flex items-start gap-3">
          <h2 id="starter-offer-title" className="mr-auto font-display text-2xl font-extrabold text-brass-gradient">Starter Gem Pack</h2>
          <button type="button" aria-label="Not now" onClick={() => dismiss()} className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm font-semibold text-plush-200">Not now</button>
        </div>
        <p className="mt-2 text-sm text-plush-300">300 gems, once per account, $4.99. Same packs as everyone else. You can send it away.</p>
        <button type="button" onClick={buy} disabled={busy} className="btn-brass mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl font-display font-bold">
          {busy ? 'Opening checkout…' : 'Buy starter pack · $4.99'}
        </button>
      </div>
    </div>
  );
};
