import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import DeckBuilder from './components/DeckBuilder';
import Shop from './components/Shop';
import BattleArena from './components/BattleArena';
import Leaderboard from './components/Leaderboard';
import { Button } from "@/components/ui/button";

const App = () => {
  const [session, setSession] = useState(null);
  const [currentView, setCurrentView] = useState('auth');
  const [playerTeddy, setPlayerTeddy] = useState(null);
  const [opponentTeddy, setOpponentTeddy] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) setCurrentView('deck');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setCurrentView('deck');
    });

    return () => subscription.unsubscribe();
  }, []);

  const startBattle = async () => {
    const { data: playerDeck } = await supabase
      .from('player_decks')
      .select('deck')
      .eq('user_id', session.user.id)
      .single();

    if (playerDeck && playerDeck.deck.length > 0) {
      const randomTeddyId = playerDeck.deck[Math.floor(Math.random() * playerDeck.deck.length)];
      const { data: selectedTeddy } = await supabase
        .from('terrible_teddies')
        .select('*')
        .eq('id', randomTeddyId)
        .single();

      setPlayerTeddy(selectedTeddy);

      // Select a random opponent teddy
      const { data: opponentTeddies } = await supabase
        .from('terrible_teddies')
        .select('*');
      const randomOpponentTeddy = opponentTeddies[Math.floor(Math.random() * opponentTeddies.length)];
      setOpponentTeddy(randomOpponentTeddy);

      setCurrentView('battle');
    } else {
      alert('Please build your deck first!');
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'auth':
        return <Auth />;
      case 'deck':
        return <DeckBuilder />;
      case 'shop':
        return <Shop />;
      case 'battle':
        return <BattleArena playerTeddy={playerTeddy} opponentTeddy={opponentTeddy} />;
      case 'leaderboard':
        return <Leaderboard />;
      default:
        return <Auth />;
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold mb-8 text-center">Terrible Teddies</h1>
      {session && (
        <nav className="mb-4">
          <Button onClick={() => setCurrentView('deck')} className="mr-2">Deck Builder</Button>
          <Button onClick={() => setCurrentView('shop')} className="mr-2">Shop</Button>
          <Button onClick={startBattle} className="mr-2">Battle</Button>
          <Button onClick={() => setCurrentView('leaderboard')} className="mr-2">Leaderboard</Button>
          <Button onClick={() => supabase.auth.signOut()}>Sign Out</Button>
        </nav>
      )}
      {renderCurrentView()}
    </div>
  );
};

export default App;