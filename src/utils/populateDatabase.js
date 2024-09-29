import { supabase } from '../lib/supabase';

export const populatePlayers = async () => {
  const { data: existingPlayers, error: fetchError } = await supabase
    .from('players')
    .select('id')
    .limit(1);

  if (fetchError) {
    console.error('Error checking existing players:', fetchError);
    return;
  }

  if (existingPlayers && existingPlayers.length > 0) {
    console.log('Players table already populated');
    return;
  }

  const initialPlayers = [
    {
      username: 'TeddyMaster',
      coins: 1000,
      wins: 10,
      losses: 5,
      rank: 'Intermediate',
      avatar_url: 'https://example.com/avatar1.png'
    },
    {
      username: 'BearBattler',
      coins: 500,
      wins: 5,
      losses: 3,
      rank: 'Novice',
      avatar_url: 'https://example.com/avatar2.png'
    },
    // Add more initial players as needed
  ];

  const { error: insertError } = await supabase
    .from('players')
    .insert(initialPlayers);

  if (insertError) {
    console.error('Error populating players table:', insertError);
  } else {
    console.log('Players table populated successfully');
  }
};

export const populateDatabase = async () => {
  await populatePlayers();
  // Add more population functions here as needed
};