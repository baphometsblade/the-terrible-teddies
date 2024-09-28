import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import DeckBuilder from './components/DeckBuilder';
import Shop from './components/Shop';
import BattleArena from './components/BattleArena';
import PlayerProfile from './components/PlayerProfile';
import Matchmaking from './components/Matchmaking';
import { Button } from "@/components/ui/button";

const App = () => {
  const [session, setSession] = useState(null);
  const [currentView, setCurrentView] = useState('auth');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) setCurrentView('profile');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setCurrentView('profile');
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleMatchFound = (matchData) => {
    console.log('Match found:', matchData);
    setCurrentView('battle');
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'auth':
        return <Auth />;
      case 'profile':
        return <PlayerProfile />;
      case 'deck':
        return <DeckBuilder />;
      case 'shop':
        return <Shop />;
      case 'battle':
        return <BattleArena />;
      case 'matchmaking':
        return <Matchmaking onMatchFound={handleMatchFound} />;
      default:
        return <Auth />;
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold mb-8 text-center">Terrible Teddies</h1>
      {session && (
        <nav className="mb-4">
          <Button onClick={() => setCurrentView('profile')} className="mr-2">Profile</Button>
          <Button onClick={() => setCurrentView('deck')} className="mr-2">Deck Builder</Button>
          <Button onClick={() => setCurrentView('shop')} className="mr-2">Shop</Button>
          <Button onClick={() => setCurrentView('matchmaking')} className="mr-2">Find Match</Button>
        </nav>
      )}
      {renderCurrentView()}
    </div>
  );
};

export default App;