import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Whether the deploy is wired up. The app gates on this and shows a clear
// configuration screen — throwing here instead would crash the whole module
// graph at import time and white-screen the app before React can render.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — set them in your ' +
    'environment (see .env.example). Running with a non-functional client.'
  );
}

// Use a syntactically-valid placeholder when unconfigured so createClient
// doesn't throw at import; real calls will fail and the UI gates them off.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

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

// Set the player's public display name (the leaderboard reads players.username).
// Server-side validation lives in set_player_username; this returns the stored
// name on success or null on failure so the caller can keep the local store in
// step only when the write actually landed.
export const setPlayerUsername = async (username) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc('set_player_username', {
    p_username: username,
  });
  if (error) {
    console.error('Error setting username:', error);
    return null;
  }
  return data ?? username;
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
