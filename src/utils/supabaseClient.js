import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

export const fetchServerGemBalance = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_gems')
    .select('gems')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching gem balance:', error);
    return null;
  }
  return data?.gems ?? null;
};

export const ensurePlayerProfile = async (username = null) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { error } = await supabase.rpc('upsert_player_profile', {
    p_user_id: user.id,
    p_username: username,
  });

  if (error) {
    console.error('Error creating player profile:', error);
    return null;
  }
  return true;
};

export const syncBattleResult = async (won, damageDealt = 0, healingDone = 0, coinsEarned = 0) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { error } = await supabase.rpc('sync_battle_result', {
    p_user_id: user.id,
    p_won: won,
    p_damage_dealt: damageDealt,
    p_healing_done: healingDone,
    p_coins_earned: coinsEarned,
  });

  if (error) {
    console.error('Error syncing battle result:', error);
    return null;
  }
  return true;
};

export const syncPlayerLevel = async (level, xp) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { error } = await supabase.rpc('sync_player_level', {
    p_user_id: user.id,
    p_level: level,
    p_xp: xp,
  });

  if (error) {
    console.error('Error syncing player level:', error);
    return null;
  }
  return true;
};

export const fetchPlayerProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching player profile:', error);
    return null;
  }
  return data;
};
