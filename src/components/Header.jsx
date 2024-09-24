import React from 'react';
import { Button } from "@/components/ui/button";
import { useSupabaseAuth } from '../integrations/supabase/auth';

export const Header = () => {
  const { session, logout } = useSupabaseAuth();

  return (
    <header className="bg-purple-900 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">Terrible Teddies</h1>
        <nav>
          {session ? (
            <Button onClick={logout} variant="outline" className="text-white border-white hover:bg-purple-700">
              Logout
            </Button>
          ) : (
            <Button href="/auth" variant="outline" className="text-white border-white hover:bg-purple-700">
              Login
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
};
