-- Add missing columns for leaderboard functionality
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0;

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS best_win_streak INTEGER DEFAULT 0;

-- Drop the old restrictive SELECT policy that only allowed reading own data
DROP POLICY IF EXISTS "Allow read access for own player data" ON public.players;

-- Create a public read policy for leaderboard data
-- This allows all authenticated users to read basic player stats for rankings
-- (required for leaderboard functionality)
CREATE POLICY "Allow authenticated read access" ON public.players
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Note: This policy allows reading all player records but RLS still protects
-- UPDATE/INSERT/DELETE operations. The existing update policy restricts
-- users to only modifying their own records.
