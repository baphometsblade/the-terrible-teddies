import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from './index.js';
import { useQueryClient } from '@tanstack/react-query';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";

const SupabaseAuthContext = createContext();

export const SupabaseAuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SupabaseAuthContext.Provider value={{ session, loading }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};

export const useSupabaseAuth = () => {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
};

export const SupabaseAuthUI = () => {
  const { session } = useSupabaseAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } else {
      queryClient.clear();
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
        variant: "success",
      });
    }
  };

  if (session) {
    return (
      <div className="p-4 bg-white rounded shadow">
        <p className="mb-4">Logged in as: {session.user.email}</p>
        <Button onClick={handleSignOut}>Sign Out</Button>
      </div>
    );
  }

  return (
    <Auth
      supabaseClient={supabase}
      appearance={{ theme: ThemeSupa }}
      providers={['google', 'github']}
      onlyThirdPartyProviders={true}
    />
  );
};

export { SupabaseAuthProvider as SupabaseProvider };