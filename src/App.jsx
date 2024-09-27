import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from './pages/Index';
import Battle from './components/Battle';
import Shop from './components/Shop';
import Profile from './components/Profile';
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
          <nav className="bg-purple-600 p-4">
            <ul className="flex justify-center space-x-4">
              <li><Link to="/"><Button variant="ghost">Home</Button></Link></li>
              <li><Link to="/battle"><Button variant="ghost">Battle</Button></Link></li>
              <li><Link to="/shop"><Button variant="ghost">Shop</Button></Link></li>
              <li><Link to="/profile"><Button variant="ghost">Profile</Button></Link></li>
            </ul>
          </nav>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/battle" element={<Battle />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;