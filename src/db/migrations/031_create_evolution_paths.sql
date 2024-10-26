CREATE TABLE IF NOT EXISTS evolution_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_teddy_id UUID REFERENCES terrible_teddies(id),
  evolved_name TEXT NOT NULL,
  required_level INTEGER NOT NULL,
  required_battles INTEGER NOT NULL,
  required_special_moves INTEGER NOT NULL,
  new_ability JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add evolution-related columns to terrible_teddies table
ALTER TABLE terrible_teddies
ADD COLUMN IF NOT EXISTS evolution_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS battles_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS special_moves_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS evolved_from TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_evolution_paths_base_teddy_id ON evolution_paths(base_teddy_id);

-- Add some initial evolution paths
INSERT INTO evolution_paths (evolved_name, required_level, required_battles, required_special_moves, new_ability)
VALUES
  ('Mystic Moonbear', 10, 20, 15, '{"name": "Lunar Blessing", "description": "Heals all friendly teddies and increases their defense for 2 turns", "energyCost": 3, "cooldown": 4}'::jsonb),
  ('Infernal Teddylord', 15, 30, 25, '{"name": "Stuffing Inferno", "description": "Deals massive damage to all enemy teddies and applies a burning effect", "energyCost": 4, "cooldown": 5}'::jsonb),
  ('Quantum Plushie', 20, 40, 35, '{"name": "Timeline Split", "description": "Creates a copy of this teddy with temporary invulnerability", "energyCost": 5, "cooldown": 6}'::jsonb);