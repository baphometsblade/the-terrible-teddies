import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { SupabaseProvider } from './integrations/supabase/auth';
import Home from './components/Home';
import Header from './components/Header';

function App() {
  return (
    <SupabaseProvider>
      <Router>
        <div className="App bg-gray-100 min-h-screen">
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </div>
      </Router>
      <Toaster />
    </SupabaseProvider>
  );
}

export default App;