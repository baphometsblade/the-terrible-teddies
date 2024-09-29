import React, { useEffect, useState } from 'react';
import { initializeDatabase } from './lib/database';
import GameInterface from './components/GameInterface';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeDb = async () => {
      try {
        await initializeDatabase();
        setIsDbReady(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setError(`Failed to initialize database: ${error.message}. Please try refreshing the page or contact support if the issue persists.`);
      }
    };
    initializeDb();
  }, []);

  if (error) {
    return <div className="text-center mt-8 text-red-600">{error}</div>;
  }

  if (!isDbReady) {
    return <div className="text-center mt-8">Initializing database... This may take a few moments.</div>;
  }

  return (
    <div className="App">
      <GameInterface />
    </div>
  );
}

export default App;