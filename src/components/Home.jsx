import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import Collection from './Collection';
import Shop from './Shop';
import Battle from './Battle';
import PlayerProfile from './PlayerProfile';
import Leaderboard from './Leaderboard';
import DailyChallenge from './DailyChallenge';
import MatchmakingSystem from './MatchmakingSystem';
import { CardEvolution } from './CardEvolution';

const Home = () => {
  const [currentView, setCurrentView] = useState('collection');
  const [selectedTeddy, setSelectedTeddy] = useState(null);

  const handleMatchFound = (matchData) => {
    // Handle the match found event
    console.log('Match found:', matchData);
    setCurrentView('battle');
  };

  const renderView = () => {
    switch (currentView) {
      case 'collection':
        return <Collection onSelectTeddy={setSelectedTeddy} />;
      case 'shop':
        return <Shop />;
      case 'battle':
        return selectedTeddy ? (
          <Battle 
            playerTeddy={selectedTeddy} 
            opponentTeddy={{
              name: "Evil McFluffles",
              title: "The Diabolical Cuddle Master",
              attack: 5,
              defense: 5,
              specialMove: "Fluff Explosion",
              imageUrl: "https://placeholder.com/150" // Replace with actual image URL
            }} 
            onBattleEnd={(result) => console.log('Battle ended:', result)}
          />
        ) : (
          <div>Please select a teddy from your collection first.</div>
        );
      case 'profile':
        return <PlayerProfile />;
      case 'leaderboard':
        return <Leaderboard />;
      case 'dailyChallenge':
        return <DailyChallenge />;
      case 'matchmaking':
        return <MatchmakingSystem onMatchFound={handleMatchFound} />;
      case 'evolution':
        return selectedTeddy ? (
          <CardEvolution 
            card={selectedTeddy} 
            onEvolve={(evolvedTeddy) => setSelectedTeddy(evolvedTeddy)} 
          />
        ) : (
          <div>Please select a teddy from your collection first.</div>
        );
      default:
        return <div>Invalid view</div>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">Terrible Teddies</h1>
      <div className="flex flex-wrap justify-center space-x-2 space-y-2 mb-8">
        <Button onClick={() => setCurrentView('collection')}>Collection</Button>
        <Button onClick={() => setCurrentView('shop')}>Shop</Button>
        <Button onClick={() => setCurrentView('battle')}>Battle</Button>
        <Button onClick={() => setCurrentView('profile')}>Profile</Button>
        <Button onClick={() => setCurrentView('leaderboard')}>Leaderboard</Button>
        <Button onClick={() => setCurrentView('dailyChallenge')}>Daily Challenge</Button>
        <Button onClick={() => setCurrentView('matchmaking')}>Find Match</Button>
        <Button onClick={() => setCurrentView('evolution')}>Evolve Teddy</Button>
      </div>
      {renderView()}
    </div>
  );
};

export default Home;