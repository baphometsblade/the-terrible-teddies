-- Create daily_challenges table
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  opponent_teddy_id UUID NOT NULL REFERENCES public.terrible_teddies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create daily_challenge_completions table
CREATE TABLE IF NOT EXISTS public.daily_challenge_completions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES auth.users(id),
  player_teddy_id UUID NOT NULL REFERENCES public.player_teddies(id),
  completion_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (player_id, completion_date)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_challenges_date ON public.daily_challenges(date);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_completions_player_date ON public.daily_challenge_completions(player_id, completion_date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenge_completions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access for all authenticated users" ON public.daily_challenges
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for authenticated users" ON public.daily_challenge_completions
  FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Allow read own completions" ON public.daily_challenge_completions
  FOR SELECT USING (auth.uid() = player_id);