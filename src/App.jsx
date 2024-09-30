import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initSupabase } from './lib/supabase';
import Game from './components/Game';
import ErrorBoundary from './components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [isSupabaseInitialized, setIsSupabaseInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      const initialized = await initSupabase();
      setIsSupabaseInitialized(initialized);
    };
    init();
  }, []);

  if (!isSupabaseInitialized) {
    return <div>Initializing application...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <div className="App">
          <Game />
        </div>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;