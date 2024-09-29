-- Create terrible_teddies table
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

-- Create players table
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

-- Create player_teddies table
CREATE TABLE public.player_teddies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id),
  teddy_id UUID REFERENCES public.terrible_teddies(id),
  level INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create battles table
CREATE TABLE public.battles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player1_id UUID REFERENCES public.players(id),
  player2_id UUID REFERENCES public.players(id),
  winner_id UUID REFERENCES public.players(id),
  player1_teddy_id UUID REFERENCES public.terrible_teddies(id),
  player2_teddy_id UUID REFERENCES public.terrible_teddies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create player_submissions table
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

-- Create indexes for better performance
CREATE INDEX idx_player_teddies_player_id ON public.player_teddies(player_id);
CREATE INDEX idx_player_teddies_teddy_id ON public.player_teddies(teddy_id);
CREATE INDEX idx_battles_player1_id ON public.battles(player1_id);
CREATE INDEX idx_battles_player2_id ON public.battles(player2_id);
CREATE INDEX idx_player_submissions_player_id ON public.player_submissions(player_id);