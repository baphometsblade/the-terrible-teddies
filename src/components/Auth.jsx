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
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-7xl mb-4">🧸</div>
          <h1 className="text-4xl font-bold text-white mb-2">Terrible Teddies</h1>
          <p className="text-purple-300">The card game where bears bite back</p>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20 shadow-2xl">
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
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
              >
                {loadingAction === 'signin' ? 'Signing in…' : 'Sign In'}
              </Button>
              <Button
                type="button"
                onClick={handleSignUp}
                disabled={!!loadingAction}
                variant="outline"
                className="flex-1 border-white/30 text-white hover:bg-white/10 font-bold py-3"
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