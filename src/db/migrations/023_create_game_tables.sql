-- Create daily_challenges table
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  opponent_teddy_id UUID REFERENCES public.terrible_teddies(id),
  reward_coins INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create player_challenge_completions table
CREATE TABLE IF NOT EXISTS public.player_challenge_completions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id),
  challenge_id UUID REFERENCES public.daily_challenges(id),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player_id, challenge_id)
);

-- Add level column to player_teddies table
ALTER TABLE public.player_teddies ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- Create function to get daily challenge
CREATE OR REPLACE FUNCTION public.get_daily_challenge()
RETURNS TABLE (
  id UUID,
  date DATE,
  opponent_teddy_id UUID,
  reward_coins INTEGER,
  opponent_teddy JSON
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id, 
    dc.date, 
    dc.opponent_teddy_id, 
    dc.reward_coins,
    row_to_json(tt.*) as opponent_teddy
  FROM 
    public.daily_challenges dc
  JOIN 
    public.terrible_teddies tt ON dc.opponent_teddy_id = tt.id
  WHERE 
    dc.date = CURRENT_DATE;
END;
$$;

-- Create function to complete daily challenge
CREATE OR REPLACE FUNCTION public.complete_daily_challenge(player_teddy_id UUID)
RETURNS TABLE (success BOOLEAN, reward_coins INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_player_id UUID;
  v_challenge_id UUID;
  v_reward_coins INTEGER;
BEGIN
  -- Get player_id from player_teddy_id
  SELECT player_id INTO v_player_id FROM public.player_teddies WHERE id = player_teddy_id;
  
  -- Get today's challenge
  SELECT id, reward_coins INTO v_challenge_id, v_reward_coins
  FROM public.daily_challenges
  WHERE date = CURRENT_DATE;
  
  -- Check if player has already completed the challenge
  IF EXISTS (
    SELECT 1 FROM public.player_challenge_completions
    WHERE player_id = v_player_id AND challenge_id = v_challenge_id
  ) THEN
    RETURN QUERY SELECT false::BOOLEAN, 0::INTEGER;
    RETURN;
  END IF;
  
  -- Record challenge completion
  INSERT INTO public.player_challenge_completions (player_id, challenge_id)
  VALUES (v_player_id, v_challenge_id);
  
  -- Award coins to player
  UPDATE public.players
  SET coins = coins + v_reward_coins
  WHERE id = v_player_id;
  
  RETURN QUERY SELECT true::BOOLEAN, v_reward_coins::INTEGER;
END;
$$;