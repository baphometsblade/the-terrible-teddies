// The server rolls a pack and prices a shortcut. The client never sends
// card ids. When nobody is signed in, or the books are quiet, the caller
// keeps the local result.

import { supabase } from '@/utils/supabaseClient';

export const requestPackRoll = async (nonce, source) => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return null;
  const { data, error } = await supabase.rpc('settle_pack_open', {
    p_nonce: nonce,
    p_source: source,
  });
  if (error || !data || !Array.isArray(data.card_ids)) return null;
  return data;
};

export const syncConvenience = async (nonce, sku) => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return null;
  const { data, error } = await supabase.rpc('buy_convenience', {
    p_nonce: nonce,
    p_sku: sku,
  });
  if (error || !data) return null;
  return data;
};

export const syncPackWin = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return;
  await supabase.rpc('record_pack_win');
};
