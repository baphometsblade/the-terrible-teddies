import React, { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import TerribleTeddiesGame from './components/TerribleTeddiesGame';
import { SupabaseProvider } from './integrations/supabase/auth';
import { initPostHog, captureEvent } from './utils/posthog';
import { setupTerribleTeddies, checkTableExists } from './lib/supabase';

function App() {
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        initPostHog();
        captureEvent('App_Loaded');

        console.log('Checking Terrible Teddies table...');
        const tableExists = await checkTableExists();
        if (!tableExists) {
          console.log('Table does not exist. Setting up Terrible Teddies...');
          const setupResult = await setupTerribleTeddies();
          if (!setupResult) {
            throw new Error('Failed to set up Terrible Teddies');
          }
        }
        setIsSupabaseReady(true);
      } catch (error) {
        console.error('Error during app initialization:', error);
        setError(error.message);
      }
    };

    initializeApp();
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!isSupabaseReady) {
    return <div>Loading... Please wait while we set up the game.</div>;
  }

  return (
    <SupabaseProvider>
      <div className="container mx-auto p-4">
        <TerribleTeddiesGame />
      </div>
      <Toaster />
    </SupabaseProvider>
  );
}

export default App;