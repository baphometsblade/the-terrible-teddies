-- Create teddy_metadata table
CREATE TABLE IF NOT EXISTS public.teddy_metadata (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  element TEXT NOT NULL,
  rarity TEXT NOT NULL,
  attack INTEGER NOT NULL,
  defense INTEGER NOT NULL,
  special_move TEXT NOT NULL,
  special_move_description TEXT NOT NULL,
  image_url TEXT,
  placeholder_image TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_teddy_metadata_name ON public.teddy_metadata(name);
CREATE INDEX IF NOT EXISTS idx_teddy_metadata_rarity ON public.teddy_metadata(rarity);

-- Enable Row Level Security
ALTER TABLE public.teddy_metadata ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access for all authenticated users"
  ON public.teddy_metadata FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin users to manage metadata"
  ON public.teddy_metadata
  USING (auth.jwt() ->> 'role' = 'admin');

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_teddy_metadata_updated_at
    BEFORE UPDATE ON public.teddy_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();