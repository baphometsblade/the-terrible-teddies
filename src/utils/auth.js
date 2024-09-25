import { supabase } from '../lib/supabase';

export async function signUp(email, password) {
  const { user, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    console.error('Error signing up:', error);
    return null;
  }
  return user;
}

export async function signIn(email, password) {
  const { user, error } = await supabase.auth.signIn({ email, password });
  if (error) {
    console.error('Error signing in:', error);
    return null;
  }
  return user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
  }
}