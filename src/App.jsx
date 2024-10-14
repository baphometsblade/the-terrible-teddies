import React, { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import TerribleTeddiesGame from './components/TerribleTeddiesGame';
import { SupabaseProvider } from './integrations/supabase/auth';
import { initPostHog, captureEvent } from './utils/posthog';
import { setupTerribleTeddies, checkTableExists } from './lib/supabase';
import TeddyDisplay from './components/TeddyDisplay';

function App() {
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        initPostHog();
        captureEvent('App_Loaded');

        console.log('Checking Terrible Teddies table...');
        const tableExists = await checkTableExists();
        if (!tableExists) {
          console.log('Table does not exist. Setting up Terrible Teddies...');
          await setupTerribleTeddies();
        }
        setIsSupabaseReady(true);
      } catch (error) {
        console.error('Error during app initialization:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading... Please wait while we set up the game.</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
        <p className="text-lg">{error}</p>
        <button 
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <SupabaseProvider>
      <div className="container mx-auto p-4">
        {isSupabaseReady ? (
          <>
            <TerribleTeddiesGame />
            <TeddyDisplay />
          </>
        ) : (
          <div>Setting up the game... This may take a moment.</div>
        )}
      </div>
      <Toaster />
    </SupabaseProvider>
  );
}

export default App;