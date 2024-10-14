-- Drop the function if it exists to avoid conflicts
DROP FUNCTION IF EXISTS create_terrible_teddies_table();

-- Create or replace the function to create the terrible_teddies table
CREATE OR REPLACE FUNCTION create_terrible_teddies_table()
RETURNS boolean AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'terrible_teddies') THEN
    -- Create the table if it doesn't exist
    CREATE TABLE public.terrible_teddies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      attack INTEGER NOT NULL,
      defense INTEGER NOT NULL,
      special_move TEXT NOT NULL,
      image_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create index for faster queries
    CREATE INDEX idx_terrible_teddies_name ON public.terrible_teddies(name);

    -- Enable Row Level Security (RLS)
    ALTER TABLE public.terrible_teddies ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "Allow read access for all authenticated users" 
      ON public.terrible_teddies FOR SELECT 
      USING (auth.role() = 'authenticated');

    CREATE POLICY "Allow full access for admins" 
      ON public.terrible_teddies
      USING (auth.jwt() ->> 'role' = 'admin');

    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;