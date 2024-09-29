-- Create the terrible_teddies table
CREATE TABLE public.terrible_teddies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  attack INTEGER NOT NULL,
  defense INTEGER NOT NULL,
  special_move TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the players table
CREATE TABLE public.players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,
  coins INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  rank TEXT DEFAULT 'Novice',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the player_teddies table
CREATE TABLE public.player_teddies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id),
  teddy_id UUID REFERENCES public.terrible_teddies(id),
  level INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the battles table
CREATE TABLE public.battles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player1_id UUID REFERENCES public.players(id),
  player2_id UUID REFERENCES public.players(id),
  player1_teddy_id UUID REFERENCES public.terrible_teddies(id),
  player2_teddy_id UUID REFERENCES public.terrible_teddies(id),
  player1_health INTEGER DEFAULT 30,
  player2_health INTEGER DEFAULT 30,
  current_turn UUID,
  status TEXT DEFAULT 'ongoing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the player_submissions table
CREATE TABLE public.player_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  attack INTEGER NOT NULL,
  defense INTEGER NOT NULL,
  special_move TEXT NOT NULL,
  image_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security on all tables
ALTER TABLE public.terrible_teddies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_teddies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_submissions ENABLE ROW LEVEL SECURITY;

-- Create policies for each table
CREATE POLICY "Allow read access for all authenticated users" ON public.terrible_teddies FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access for own data" ON public.players FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow update for own data" ON public.players FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow read access for own teddies" ON public.player_teddies FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id));
CREATE POLICY "Allow insert for own teddies" ON public.player_teddies FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id));

CREATE POLICY "Allow read access for own battles" ON public.battles FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.players WHERE id IN (player1_id, player2_id)));
CREATE POLICY "Allow update for own battles" ON public.battles FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM public.players WHERE id IN (player1_id, player2_id)));

CREATE POLICY "Allow read access for own submissions" ON public.player_submissions FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id));
CREATE POLICY "Allow insert for own submissions" ON public.player_submissions FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id));