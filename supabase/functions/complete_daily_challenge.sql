CREATE OR REPLACE FUNCTION public.complete_daily_challenge(player_teddy_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
  challenge_completed BOOLEAN;
  reward_coins INTEGER := 50; -- Set the reward amount
BEGIN
  -- Get the user_id
  user_id := auth.uid();

  -- Check if the user has already completed today's challenge
  SELECT EXISTS (
    SELECT 1
    FROM daily_challenge_completions
    WHERE player_id = user_id AND completion_date = CURRENT_DATE
  ) INTO challenge_completed;

  IF challenge_completed THEN
    RETURN json_build_object('success', false, 'message', 'You have already completed today''s challenge');
  END IF;

  -- Record the completion
  INSERT INTO daily_challenge_completions (player_id, player_teddy_id, completion_date)
  VALUES (user_id, player_teddy_id, CURRENT_DATE);

  -- Award coins to the player
  UPDATE players
  SET coins = coins + reward_coins
  WHERE id = user_id;

  RETURN json_build_object('success', true, 'reward_coins', reward_coins);
END;
$$;