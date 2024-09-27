import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './lib/supabase';
import Header from './components/Header';
import GameBoard from './components/GameBoard';
import Shop from './components/Shop';
import Profile from './components/Profile';
import Leaderboard from './components/Leaderboard';
import TeddyCollection from './components/TeddyCollection';
import UserSubmission from './components/UserSubmission';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

const queryClient = new QueryClient();

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 text-white">
          <Header session={session} />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={session ? <GameBoard /> : <Navigate to="/auth" />} />
              <Route path="/shop" element={session ? <Shop /> : <Navigate to="/auth" />} />
              <Route path="/profile" element={session ? <Profile /> : <Navigate to="/auth" />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/collection" element={session ? <TeddyCollection /> : <Navigate to="/auth" />} />
              <Route path="/submit" element={session ? <UserSubmission /> : <Navigate to="/auth" />} />
              <Route path="/auth" element={!session ? <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} /> : <Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;