import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingAction, setLoadingAction] = useState(null); // 'signin' | 'signup' | null
  const { toast } = useToast();

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoadingAction('signup');
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Account Created", description: "Check your email for the confirmation link!" });
      }
    } catch (err) {
      toast({ title: "Network error", description: "Couldn't reach the server. Please try again.", variant: "destructive" });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoadingAction('signin');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Sign In Failed", description: error.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Network error", description: "Couldn't reach the server. Please try again.", variant: "destructive" });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="min-h-screen relative bg-gradient-to-b from-night-800 to-night-950 worn flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-7xl mb-4">🧸</div>
          <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-brass-200 via-brass-300 to-brass-200 mb-2">Terrible Teddies</h1>
          <p className="text-plush-300">Stuffed animals. Unstuffed grudges.</p>
          <p className="text-plush-400/80 text-xs mt-2">
            18+ — contains profanity, cartoon fluff violence, and bears with substance-abuse issues.
          </p>
        </div>
        <div className="relative bg-night-800/60 backdrop-blur rounded-2xl p-8 border border-plush-700/40 stitched shadow-2xl">
          <form onSubmit={handleSignIn}>
            <label htmlFor="auth-email" className="sr-only">Email</label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              aria-label="Email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 bg-white/10 border-white/30 text-white placeholder:text-white/50"
              required
            />
            <label htmlFor="auth-password" className="sr-only">Password</label>
            <Input
              id="auth-password"
              type="password"
              autoComplete="current-password"
              aria-label="Password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-6 bg-white/10 border-white/30 text-white placeholder:text-white/50"
              minLength={6}
              required
            />
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={!!loadingAction}
                className="flex-1 bg-brass-500 hover:bg-brass-600 text-night-950 font-display font-bold py-3"
              >
                {loadingAction === 'signin' ? 'Signing in…' : 'Sign In'}
              </Button>
              <Button
                type="button"
                onClick={handleSignUp}
                disabled={!!loadingAction}
                variant="outline"
                className="flex-1 border-plush-400/40 text-white hover:bg-white/10 font-display font-bold py-3"
              >
                {loadingAction === 'signup' ? 'Creating…' : 'Sign Up'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;