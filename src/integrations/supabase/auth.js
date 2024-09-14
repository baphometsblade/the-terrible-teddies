import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from './index.js';
import { useQueryClient } from '@tanstack/react-query';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from 'react-router-dom';

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

export const useCurrentUser = () => {
  const { session } = useSupabaseAuth();
  return { data: session?.user || null };
};

export const SupabaseAuthUI = () => {
  const { session } = useSupabaseAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  console.log('SupabaseAuthUI rendered, session:', session);

  useEffect(() => {
    console.log('SupabaseAuthUI useEffect - session changed:', session);
  }, [session]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    console.log('Attempting sign in with email:', email);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      console.log('Sign in successful, data:', data);
      toast({
        title: "Signed In",
        description: "You have successfully signed in.",
        variant: "success",
      });
      navigate('/');
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    console.log('Attempting sign up with email:', email);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      console.log('Sign up successful, data:', data);
      toast({
        title: "Signed Up",
        description: "Please check your email to confirm your account.",
        variant: "success",
      });
    } catch (error) {
      console.error('Sign up error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    console.log('Attempting sign out');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log('Sign out successful');
      queryClient.clear();
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
        variant: "success",
      });
      navigate('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
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
    <div className="p-4 bg-white rounded shadow">
      <form onSubmit={handleSignIn} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <Button type="submit" className="w-full">Sign In</Button>
      </form>
      <Button onClick={handleSignUp} className="w-full mt-2">Sign Up</Button>
    </div>
  );
};

export { SupabaseAuthProvider as SupabaseProvider };
