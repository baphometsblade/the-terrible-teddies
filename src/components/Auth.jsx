import React, { useState } from 'react';
import { useLogin, useSignUp, useLogout, useCurrentUser } from '../integrations/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const login = useLogin();
  const signUp = useSignUp();
  const logout = useLogout();
  const { data: currentUser, isLoading } = useCurrentUser();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        await signUp.mutateAsync({ email, password });
        toast({
          title: "Sign Up Successful",
          description: "Please check your email to confirm your account.",
          variant: "success",
        });
      } else {
        await login.mutateAsync({ email, password });
        toast({
          title: "Login Successful",
          description: "Welcome back!",
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: isSignUp ? "Sign Up Failed" : "Login Failed",
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
      <Card>
        <CardHeader>
          <CardTitle>User Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">Logged in as: {currentUser.email}</p>
          <Button onClick={handleLogout}>Logout</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isSignUp ? "Sign Up" : "Login"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Button type="submit" className="w-full">{isSignUp ? "Sign Up" : "Login"}</Button>
            <Button 
              type="button" 
              variant="outline" 
              className="w-full"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? "Already have an account? Login" : "Don't have an account? Sign Up"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
