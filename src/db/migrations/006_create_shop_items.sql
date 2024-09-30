-- Create the shop_items table
CREATE TABLE IF NOT EXISTS public.shop_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  type TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add some sample items
INSERT INTO public.shop_items (name, description, price, type, image_url)
VALUES
  ('Standard Bear Pack', 'Contains 5 random bears', 500, 'pack', 'https://example.com/standard_pack.png'),
  ('Premium Bear Pack', 'Contains 10 random bears with a guaranteed rare', 1000, 'pack', 'https://example.com/premium_pack.png'),
  ('Golden Card Frame', 'A luxurious frame for your favorite bear', 250, 'cosmetic', 'https://example.com/golden_frame.png'),
  ('Energy Boost', 'Instantly refill your energy in battle', 100, 'consumable', 'https://example.com/energy_boost.png'),
  ('Legendary Bear Pack', 'Contains 5 bears with a guaranteed legendary', 2000, 'pack', 'https://example.com/legendary_pack.png'),
  ('Rainbow Aura', 'A colorful aura for your bear', 300, 'cosmetic', 'https://example.com/rainbow_aura.png'),
  ('XP Booster', 'Double XP for your next 5 battles', 150, 'consumable', 'https://example.com/xp_booster.png'),
  ('Seasonal Halloween Pack', 'Limited edition spooky bears', 1500, 'pack', 'https://example.com/halloween_pack.png'),
  ('Neon Card Border', 'Make your cards glow with this neon border', 200, 'cosmetic', 'https://example.com/neon_border.png'),
  ('Lucky Charm', 'Increases rare bear drop rate for your next pack opening', 300, 'consumable', 'https://example.com/lucky_charm.png');

-- Enable Row Level Security (RLS)
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow read access for all authenticated users
CREATE POLICY "Allow read access for all authenticated users" ON public.shop_items
  FOR SELECT USING (auth.role() = 'authenticated');