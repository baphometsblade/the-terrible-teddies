-- Function to purchase a teddy bear
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

-- Function to start a battle
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

-- Function to submit a player-created teddy
CREATE OR REPLACE FUNCTION public.submit_teddy(
  player_id UUID,
  name TEXT,
  title TEXT,
  description TEXT,
  attack INTEGER,
  defense INTEGER,
  special_move TEXT,
  image_url TEXT
) RETURNS UUID AS $$
DECLARE
  submission_id UUID;
BEGIN
  INSERT INTO public.player_submissions (player_id, name, title, description, attack, defense, special_move, image_url)
  VALUES (player_id, name, title, description, attack, defense, special_move, image_url)
  RETURNING id INTO submission_id;
  
  RETURN submission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;