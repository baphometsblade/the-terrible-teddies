-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create terrible_teddies table
CREATE TABLE IF NOT EXISTS public.terrible_teddies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    username TEXT UNIQUE NOT NULL,
    coins INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    rank TEXT DEFAULT 'Novice',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create player_teddies table
CREATE TABLE IF NOT EXISTS public.player_teddies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES public.players(id),
    teddy_id UUID REFERENCES public.terrible_teddies(id),
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create battles table
CREATE TABLE IF NOT EXISTS public.battles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player1_id UUID REFERENCES public.players(id),
    player2_id UUID REFERENCES public.players(id),
    player1_teddy_id UUID REFERENCES public.terrible_teddies(id),
    player2_teddy_id UUID REFERENCES public.terrible_teddies(id),
    winner_id UUID REFERENCES public.players(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_items table
CREATE TABLE IF NOT EXISTS public.shop_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    type TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create player_submissions table
CREATE TABLE IF NOT EXISTS public.player_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES public.players(id),
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    attack INTEGER NOT NULL,
    defense INTEGER NOT NULL,
    special_move TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create seasonal_events table
CREATE TABLE IF NOT EXISTS public.seasonal_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create function to purchase a teddy bear
CREATE OR REPLACE FUNCTION public.purchase_teddy(
    player_id UUID,
    teddy_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    teddy_price INTEGER := 100; -- Set a default price, adjust as needed
    player_coins INTEGER;
BEGIN
    -- Get player's current coins
    SELECT coins INTO player_coins FROM public.players WHERE id = player_id;
    
    -- Check if player has enough coins
    IF player_coins >= teddy_price THEN
        -- Deduct coins and add teddy to player's collection
        UPDATE public.players SET coins = coins - teddy_price WHERE id = player_id;
        INSERT INTO public.player_teddies (player_id, teddy_id) VALUES (player_id, teddy_id);
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to start a battle
CREATE OR REPLACE FUNCTION public.start_battle(
    player1_id UUID,
    player2_id UUID,
    player1_teddy_id UUID,
    player2_teddy_id UUID
) RETURNS UUID AS $$
DECLARE
    battle_id UUID;
BEGIN
    INSERT INTO public.battles (player1_id, player2_id, player1_teddy_id, player2_teddy_id)
    VALUES (player1_id, player2_id, player1_teddy_id, player2_teddy_id)
    RETURNING id INTO battle_id;
    
    RETURN battle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to submit a player-created teddy
CREATE OR REPLACE FUNCTION public.submit_teddy(
    player_id UUID,
    name TEXT,
    title TEXT,
    description TEXT,
    attack INTEGER,
    defense INTEGER,
    special_move TEXT
) RETURNS UUID AS $$
DECLARE
    submission_id UUID;
BEGIN
    INSERT INTO public.player_submissions (player_id, name, title, description, attack, defense, special_move)
    VALUES (player_id, name, title, description, attack, defense, special_move)
    RETURNING id INTO submission_id;
    
    RETURN submission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.terrible_teddies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_teddies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_events ENABLE ROW LEVEL SECURITY;

-- Create policies for each table
CREATE POLICY "Allow read access for all authenticated users" ON public.terrible_teddies FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access for own player data" ON public.players FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow update access for own player data" ON public.players FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow read access for own teddies" ON public.player_teddies FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id));
CREATE POLICY "Allow insert access for own teddies" ON public.player_teddies FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id));

CREATE POLICY "Allow read access for own battles" ON public.battles FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.players WHERE id IN (player1_id, player2_id)));

CREATE POLICY "Allow read access for all authenticated users" ON public.shop_items FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access for own submissions" ON public.player_submissions FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id));
CREATE POLICY "Allow insert access for own submissions" ON public.player_submissions FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id));

CREATE POLICY "Allow read access for all authenticated users" ON public.seasonal_events FOR SELECT USING (auth.role() = 'authenticated');