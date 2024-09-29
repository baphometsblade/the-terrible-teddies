CREATE OR REPLACE FUNCTION public.get_daily_challenge()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  challenge JSON;
BEGIN
  -- Check if a challenge exists for today
  SELECT row_to_json(dc) INTO challenge
  FROM daily_challenges dc
  WHERE dc.date = CURRENT_DATE;

  -- If no challenge exists, generate a new one
  IF challenge IS NULL THEN
    INSERT INTO daily_challenges (date, title, description, opponent_teddy_id)
    VALUES (
      CURRENT_DATE,
      'Daily Teddy Showdown',
      'Defeat today''s special opponent to earn bonus coins!',
      (SELECT id FROM terrible_teddies ORDER BY RANDOM() LIMIT 1)
    )
    RETURNING row_to_json(daily_challenges.*) INTO challenge;
  END IF;

  -- Fetch the opponent teddy details
  challenge := challenge || jsonb_build_object(
    'opponent_teddy', (
      SELECT row_to_json(tt)
      FROM terrible_teddies tt
      WHERE tt.id = (challenge->>'opponent_teddy_id')::uuid
    )
  );

  RETURN challenge;
END;
$$;