import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { initDatabase } from './utils/initDatabase';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import GameInterface from './components/GameInterface';

function App() {
  const [session, setSession] = useState(null);
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    initDatabase().then(() => setIsDbReady(true));
  }, []);

  if (!isDbReady) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return (
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={['google', 'facebook']}
      />
    );
  }

  return (
    <div className="App">
      <GameInterface session={session} />
    </div>
  );
}

export default App;