import React, { useState, useEffect } from 'react';
import { BattleArena } from './components/BattleArena';
import { Leaderboard } from './components/Leaderboard';
import { signIn, signUp, signOut } from './utils/auth';
import { checkAchievements } from './utils/achievements';
import { supabase } from './lib/supabase';

function App() {
  const [user, setUser] = useState(null);
  const [playerBear, setPlayerBear] = useState(null);
  const [opponentBear, setOpponentBear] = useState(null);

  useEffect(() => {
    const session = supabase.auth.session();
    setUser(session?.user ?? null);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user;
        setUser(currentUser ?? null);
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchPlayerBear();
      fetchOpponentBear();
      checkAchievements(user.id);
    }
  }, [user]);

  async function fetchPlayerBear() {
    const { data, error } = await supabase
      .from('teddy_bears')
      .select('*')
      .eq('owner_id', user.id)
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching player bear:', error);
    } else {
      setPlayerBear(data);
    }
  }

  async function fetchOpponentBear() {
    const { data, error } = await supabase
      .from('teddy_bears')
      .select('*')
      .neq('owner_id', user.id)
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching opponent bear:', error);
    } else {
      setOpponentBear(data);
    }
  }

  return (
    <div className="App">
      {user ? (
        <>
          <button onClick={() => signOut()}>Sign Out</button>
          {playerBear && opponentBear && (
            <BattleArena playerBear={playerBear} opponentBear={opponentBear} />
          )}
          <Leaderboard />
        </>
      ) : (
        <div>
          <h2>Welcome to Cheeky Teddy Brawl</h2>
          <button onClick={() => signIn('test@example.com', 'password123')}>Sign In</button>
          <button onClick={() => signUp('newuser@example.com', 'password123')}>Sign Up</button>
        </div>
      )}
    </div>
  );
}

export default App;
