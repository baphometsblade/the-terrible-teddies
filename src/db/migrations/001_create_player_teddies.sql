-- Create the player_teddies table
CREATE TABLE public.player_teddies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID NOT NULL,
  teddy_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add an index for faster queries
CREATE INDEX idx_player_teddies_player_id ON public.player_teddies(player_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.player_teddies ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see only their own teddies
CREATE POLICY "Users can view own teddies" ON public.player_teddies
  FOR SELECT USING (auth.uid() = player_id);

-- Policy to allow users to insert their own teddies
CREATE POLICY "Users can insert own teddies" ON public.player_teddies
  FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Policy to allow users to update their own teddies
CREATE POLICY "Users can update own teddies" ON public.player_teddies
  FOR UPDATE USING (auth.uid() = player_id);

-- Policy to allow users to delete their own teddies
CREATE POLICY "Users can delete own teddies" ON public.player_teddies
  FOR DELETE USING (auth.uid() = player_id);