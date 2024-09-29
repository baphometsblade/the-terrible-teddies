-- Add foreign key constraint to player_teddies table
ALTER TABLE public.player_teddies
ADD CONSTRAINT fk_terrible_teddies
FOREIGN KEY (teddy_id)
REFERENCES public.terrible_teddies(id);

-- Create index for faster lookups
CREATE INDEX idx_player_teddies_teddy_id ON public.player_teddies(teddy_id);