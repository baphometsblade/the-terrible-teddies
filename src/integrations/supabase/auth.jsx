import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

const SupabaseAuthContext = createContext();

export const SupabaseProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const getSession = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (error) {
        // A rejection here used to strand `loading` at true forever, and the
        // app's boot gate renders on exactly that flag — so the player would
        // sit on the loading screen for the rest of the session with no error
        // and no way out. supabase-js resolves rather than throws for the
        // ordinary offline case (it retries internally and then hands back a
        // null session), but "the one await that can never be allowed to
        // reject" deserves better than an assumption about someone else's
        // error contract. Treat a throw as "not signed in": the login screen
        // is at least a screen the player can act on.
        console.error('Failed to restore session:', error);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      queryClient.invalidateQueries('user');
    });

    getSession();

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [queryClient]);

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    queryClient.invalidateQueries('user');
  };

  const value = {
    session,
    loading,
    logout,
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
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

export const SupabaseAuthProvider = SupabaseProvider;