import React, { useState } from 'react';
import { useLogin, useSignUp, useLogout, useCurrentUser } from '../integrations/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/ui/use-toast";

export const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const signUp = useSignUp();
  const logout = useLogout();
  const { data: currentUser, isLoading } = useCurrentUser();
  const { toast } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      toast({
        title: "Login Successful",
        description: "Welcome back!",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      await signUp.mutateAsync({ email, password });
      toast({
        title: "Sign Up Successful",
        description: "Please check your email to confirm your account.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      toast({
        title: "Logout Successful",
        description: "You have been logged out.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (currentUser) {
    return (
      <div>
        <p>Logged in as: {currentUser.email}</p>
        <Button onClick={handleLogout}>Logout</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <div className="space-x-2">
        <Button type="submit">Login</Button>
        <Button type="button" onClick={handleSignUp}>Sign Up</Button>
      </div>
    </form>
  );
};