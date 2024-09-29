-- Create the players table
CREATE TABLE IF NOT EXISTS public.players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,
  coins INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  rank TEXT DEFAULT 'Novice',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow users to see only their own data
CREATE POLICY "Users can view own player data" ON public.players
  FOR SELECT USING (auth.uid() = user_id);

-- Create a policy to allow users to update their own data
CREATE POLICY "Users can update own player data" ON public.players
  FOR UPDATE USING (auth.uid() = user_id);

-- Create a policy to allow users to insert their own data
CREATE POLICY "Users can insert own player data" ON public.players
  FOR INSERT WITH CHECK (auth.uid() = user_id);