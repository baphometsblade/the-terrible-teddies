-- Create public function to get all teddy bears
CREATE OR REPLACE FUNCTION public.get_all_teddy_bears()
RETURNS TABLE (
  id UUID,
  name TEXT,
  title TEXT,
  description TEXT,
  attack INTEGER,
  defense INTEGER,
  special_move TEXT,
  image_url TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM terrible_teddies;
$$;

-- Create public function to get a player's teddy bears
CREATE OR REPLACE FUNCTION public.get_player_teddy_bears(player_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  title TEXT,
  description TEXT,
  attack INTEGER,
  defense INTEGER,
  special_move TEXT,
  image_url TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT tt.*
  FROM terrible_teddies tt
  JOIN player_teddies pt ON tt.id = pt.teddy_id
  WHERE pt.player_id = player_id;
$$;

-- Create public function to purchase a teddy bear
CREATE OR REPLACE FUNCTION public.purchase_teddy_bear(player_id UUID, teddy_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  teddy_price INTEGER := 100; -- Set a default price, adjust as needed
  player_coins INTEGER;
BEGIN
  -- Get player's current coins
  SELECT coins INTO player_coins FROM players WHERE id = player_id;
  
  -- Check if player has enough coins
  IF player_coins >= teddy_price THEN
    -- Deduct coins and add teddy to player's collection
    UPDATE players SET coins = coins - teddy_price WHERE id = player_id;
    INSERT INTO player_teddies (player_id, teddy_id) VALUES (player_id, teddy_id);
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

-- Create public function to start a battle
CREATE OR REPLACE FUNCTION public.start_battle(player1_id UUID, player2_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  battle_id UUID;
BEGIN
  INSERT INTO battles (player1_id, player2_id, status)
  VALUES (player1_id, player2_id, 'in_progress')
  RETURNING id INTO battle_id;
  
  RETURN battle_id;
END;
$$;

-- Create public function to perform a battle action
CREATE OR REPLACE FUNCTION public.perform_battle_action(battle_id UUID, player_id UUID, action_type TEXT, target_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Implement battle logic here
  -- This is a placeholder and should be expanded based on game rules
  INSERT INTO battle_actions (battle_id, player_id, action_type, target_id)
  VALUES (battle_id, player_id, action_type, target_id);
  
  -- Check if the battle is over and update status if necessary
  -- This logic needs to be implemented based on game rules
  
  RETURN TRUE;
END;
$$;

-- Create public function to get battle result
CREATE OR REPLACE FUNCTION public.get_battle_result(battle_id UUID)
RETURNS TABLE (
  winner_id UUID,
  loser_id UUID,
  battle_status TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    CASE 
      WHEN player1_score > player2_score THEN player1_id
      WHEN player2_score > player1_score THEN player2_id
      ELSE NULL
    END as winner_id,
    CASE 
      WHEN player1_score < player2_score THEN player1_id
      WHEN player2_score < player1_score THEN player2_id
      ELSE NULL
    END as loser_id,
    status as battle_status
  FROM battles
  WHERE id = battle_id;
$$;

-- Create public function to evolve a teddy bear
CREATE OR REPLACE FUNCTION public.evolve_teddy_bear(player_id UUID, teddy_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_level INTEGER;
  evolution_cost INTEGER := 200; -- Set a default evolution cost, adjust as needed
  player_coins INTEGER;
BEGIN
  -- Get the current level of the teddy bear
  SELECT level INTO current_level FROM player_teddies WHERE player_id = player_id AND teddy_id = teddy_id;
  
  -- Get player's current coins
  SELECT coins INTO player_coins FROM players WHERE id = player_id;
  
  -- Check if the teddy can be evolved and player has enough coins
  IF current_level < 3 AND player_coins >= evolution_cost THEN
    -- Deduct coins and increase teddy's level
    UPDATE players SET coins = coins - evolution_cost WHERE id = player_id;
    UPDATE player_teddies SET level = level + 1 WHERE player_id = player_id AND teddy_id = teddy_id;
    
    -- Increase teddy's stats (this logic can be adjusted based on game design)
    UPDATE terrible_teddies 
    SET attack = attack + 2, defense = defense + 2 
    WHERE id = teddy_id;
    
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;