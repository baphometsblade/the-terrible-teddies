import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from './pages/Index';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
          <Routes>
            <Route path="/" element={<Index />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;