CREATE TABLE IF NOT EXISTS player_achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(player_id, achievement_id)
);

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_player_achievements_player_id ON player_achievements(player_id);

-- Set up RLS policies
ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their own achievements"
  ON player_achievements FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players can unlock achievements"
  ON player_achievements FOR INSERT
  WITH CHECK (auth.uid() = player_id);