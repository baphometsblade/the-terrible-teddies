import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useSupabaseAuth = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('useSupabaseAuth effect running');
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Fetched session:', session);
        setSession(session);
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session);
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
};