CREATE TABLE public.battles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player1_id UUID REFERENCES auth.users(id),
  player2_id UUID REFERENCES auth.users(id),
  player1_teddy_id UUID REFERENCES public.terrible_teddies(id),
  player2_teddy_id UUID REFERENCES public.terrible_teddies(id),
  player1_health INTEGER DEFAULT 30,
  player2_health INTEGER DEFAULT 30,
  current_turn UUID,
  status TEXT DEFAULT 'ongoing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow players to view their own battles
CREATE POLICY "Players can view their own battles" ON public.battles
  FOR SELECT
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Create policy to allow players to update their own battles
CREATE POLICY "Players can update their own battles" ON public.battles
  FOR UPDATE
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);