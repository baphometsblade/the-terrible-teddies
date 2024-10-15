import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Battle from './Battle';
import Shop from './Shop';
import Evolution from './Evolution';
import PowerUpSystem from './PowerUpSystem';
import AchievementSystem from './AchievementSystem';
import SeasonalEvent from './SeasonalEvent';
import TeddyCollection from './TeddyCollection';

const GameContent = ({ gameState, playerTeddies, selectedTeddy, setSelectedTeddy, onBattleEnd, powerUps, setPowerUps, achievements, setAchievements }) => {
  switch (gameState) {
    case 'battle':
      return (
        <Battle
          playerTeddy={selectedTeddy}
          opponentTeddy={playerTeddies[Math.floor(Math.random() * playerTeddies.length)]}
          powerUps={powerUps}
          onBattleEnd={onBattleEnd}
        />
      );
    case 'shop':
      return <Shop />;
    case 'evolution':
      return <Evolution teddy={selectedTeddy} />;
    case 'powerUps':
      return <PowerUpSystem powerUps={powerUps} setPowerUps={setPowerUps} />;
    case 'achievements':
      return <AchievementSystem achievements={achievements} setAchievements={setAchievements} />;
    case 'seasonalEvent':
      return <SeasonalEvent />;
    default:
      return (
        <Tabs defaultValue="collection" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="collection">Collection</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>
          <TabsContent value="collection">
            <h2 className="text-2xl font-bold mb-4">Your Teddies</h2>
            <TeddyCollection
              playerTeddies={playerTeddies}
              selectedTeddy={selectedTeddy}
              setSelectedTeddy={setSelectedTeddy}
            />
          </TabsContent>
          <TabsContent value="stats">
            <h2 className="text-2xl font-bold mb-4">Your Stats</h2>
            <p>Player statistics to be implemented.</p>
          </TabsContent>
          <TabsContent value="events">
            <h2 className="text-2xl font-bold mb-4">Upcoming Events</h2>
            <p>Event calendar to be implemented.</p>
          </TabsContent>
        </Tabs>
      );
  }
};

export default GameContent;