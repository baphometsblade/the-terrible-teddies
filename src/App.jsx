import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from './pages/Index';
import Battle from './components/Battle';
import Shop from './components/Shop';
import Profile from './components/Profile';
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

function App() {
  console.log('Rendering App component');
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
          <nav className="bg-purple-600 p-4">
            <ul className="flex justify-center space-x-4">
              <li><Button variant="ghost" asChild><a href="/">Home</a></Button></li>
              <li><Button variant="ghost" asChild><a href="/battle">Battle</a></Button></li>
              <li><Button variant="ghost" asChild><a href="/shop">Shop</a></Button></li>
              <li><Button variant="ghost" asChild><a href="/profile">Profile</a></Button></li>
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