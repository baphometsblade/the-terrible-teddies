import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

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

export const getAllDataFromTable = async (tableName) => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) throw error;

    console.log(`Retrieved all data from ${tableName}:`, data);
    return data;
  } catch (error) {
    console.error(`Error fetching data from ${tableName}:`, error);
    throw error;
  }
};
