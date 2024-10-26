-- Insert new teddy bears
INSERT INTO public.teddy_metadata (
  id, name, title, description, element, rarity, 
  attack, defense, special_move, special_move_description, 
  placeholder_image
)
VALUES 
  ('disco-bear', 'Disco Bear', 'The Groove Master', 
   'A funky bear who never stopped living in the 70s. His dance moves are lethal!',
   'light', 'epic', 6, 6, 'Disco Inferno',
   'Dazzles opponents with spectacular dance moves, reducing their accuracy',
   'https://images.unsplash.com/photo-1525268771113-32d9e9021a97'),
  -- Add all other new teddies here
  ('zen-master', 'Zen Master', 'The Enlightened One',
   'A peaceful bear who fights only when necessary, using the power of inner peace.',
   'light', 'legendary', 5, 9, 'Tranquil Mind',
   'Nullifies opponent''s negative effects through meditation',
   'https://images.unsplash.com/photo-1517783999520-f068d7431a60')
ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  element = EXCLUDED.element,
  rarity = EXCLUDED.rarity,
  attack = EXCLUDED.attack,
  defense = EXCLUDED.defense,
  special_move = EXCLUDED.special_move,
  special_move_description = EXCLUDED.special_move_description,
  placeholder_image = EXCLUDED.placeholder_image;