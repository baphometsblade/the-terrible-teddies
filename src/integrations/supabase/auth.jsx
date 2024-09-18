import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from './index.js';
import { useQueryClient } from '@tanstack/react-query';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Button } from '@/components/ui/button';

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  };

  if (session) {
    return (
      <div>
        <p>Logged in as: {session.user.email}</p>
        <Button onClick={handleSignOut}>Sign Out</Button>
      </div>
    );
  }

  return (
    <Auth
      supabaseClient={supabase}
      appearance={{ theme: ThemeSupa }}
      providers={['google', 'github']}
    />
  );
};

// Export SupabaseAuthProvider as SupabaseProvider for consistency
export { SupabaseAuthProvider as SupabaseProvider };