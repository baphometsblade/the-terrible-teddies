import { supabase } from '../lib/supabase';

export const setupDatabase = async () => {
  const { error: playersError } = await supabase.rpc('create_players_table');
  if (playersError) {
    console.error('Error creating players table:', playersError);
  } else {
    console.log('Players table created successfully');
  }

  const { error: challengesError } = await supabase.rpc('create_daily_challenges_table');
  if (challengesError) {
    console.error('Error creating daily challenges table:', challengesError);
  } else {
    console.log('Daily challenges table created successfully');
  }

  const { error: completionsError } = await supabase.rpc('create_challenge_completions_table');
  if (completionsError) {
    console.error('Error creating challenge completions table:', completionsError);
  } else {
    console.log('Challenge completions table created successfully');
  }
};