import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const createMatch = async (playerOneId) => {
  const { data, error } = await supabase
    .from('matches')
    .insert({ player_one_id: playerOneId, status: 'waiting' })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const joinMatch = async (matchId, playerTwoId) => {
  const { data, error } = await supabase
    .from('matches')
    .update({ player_two_id: playerTwoId, status: 'in_progress' })
    .eq('id', matchId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const subscribeToMatch = (matchId, callback) => {
  return supabase
    .channel(`match:${matchId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, callback)
    .subscribe();
};