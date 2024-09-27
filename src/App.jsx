import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider, useSupabaseAuth } from './integrations/supabase/auth';
import Index from './pages/Index';
import GameBoard from './components/GameBoard';
import Shop from './components/Shop';
import Profile from './components/Profile';
import { Auth } from './components/Auth';
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

const PrivateRoute = ({ children }) => {
  const { session } = useSupabaseAuth();
  return session ? children : <Navigate to="/auth" replace />;
};

function App() {
  const { session } = useSupabaseAuth();

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App min-h-screen bg-gradient-to-b from-purple-100 to-pink-100">
          <nav className="bg-purple-600 p-4">
            <ul className="flex justify-center space-x-4">
              <li><Button variant="ghost" asChild><a href="/">Home</a></Button></li>
              <li><Button variant="ghost" asChild><a href="/game">Play</a></Button></li>
              <li><Button variant="ghost" asChild><a href="/shop">Shop</a></Button></li>
              <li><Button variant="ghost" asChild><a href="/profile">Profile</a></Button></li>
              {!session && <li><Button variant="ghost" asChild><a href="/auth">Login</a></Button></li>}
            </ul>
          </nav>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/game" element={<PrivateRoute><GameBoard /></PrivateRoute>} />
            <Route path="/shop" element={<PrivateRoute><Shop /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/auth" element={<Auth />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

const AppWithSupabase = () => (
  <SupabaseProvider>
    <App />
  </SupabaseProvider>
);

export default AppWithSupabase;