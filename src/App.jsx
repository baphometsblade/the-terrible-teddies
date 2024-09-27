import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Index from './pages/Index';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 text-white">
          <Routes>
            <Route path="/" element={<Index />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;