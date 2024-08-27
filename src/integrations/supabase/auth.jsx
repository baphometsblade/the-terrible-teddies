import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from './index.js';
import { useQueryClient } from '@tanstack/react-query';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Button } from '@/components/ui/button';

const SupabaseAuthContext = createContext();

export const SupabaseAuthProvider = ({ children }) => {
  // ... (rest of the component code)
};

export const useSupabaseAuth = () => {
  // ... (rest of the hook code)
};

export const SupabaseAuthUI = () => {
  // ... (rest of the component code)
};

// Export SupabaseAuthProvider as SupabaseProvider for consistency
export { SupabaseAuthProvider as SupabaseProvider };