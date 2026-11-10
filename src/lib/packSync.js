// Posts a pack the client already rolled so the server can recompute the
// coins from the card ids. The local result stands when nobody is signed in
// or the books are quiet. A receipt that comes back with a different coin
// figure is applied as a delta, so the server total wins when it answers.
// The nonce makes a retry pay once.

import { supabase } from '@/utils/supabaseClient';

export const syncPackOpen = (nonce, source, cardIds, localCoins, adjust) => {
  const run = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) return;
    const { data } = await supabase.rpc('settle_pack_open', {
      p_nonce: nonce,
      p_source: source,
      p_card_ids: cardIds,
    });
    if (!data || typeof data.coins !== 'number') return;
    const delta = data.coins - localCoins;
    if (delta) adjust(delta);
  };
  run().catch(() => {});
};

export const syncConvenience = (nonce, sku) => {
  const run = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) return;
    await supabase.rpc('buy_convenience', { p_nonce: nonce, p_sku: sku });
  };
  run().catch(() => {});
};
