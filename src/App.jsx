import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Game from './components/Game';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="App">
        <Game />
      </div>
    </QueryClientProvider>
  );
}

export default App;