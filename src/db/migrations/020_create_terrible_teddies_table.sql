-- Drop the function if it exists to avoid conflicts
DROP FUNCTION IF EXISTS create_terrible_teddies_table();

-- Create or replace the function to create the terrible_teddies table
CREATE OR REPLACE FUNCTION create_terrible_teddies_table()
RETURNS void AS $$
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

    RAISE NOTICE 'Table terrible_teddies created successfully';
  ELSE
    -- If the table exists, ensure all columns are present
    BEGIN
      ALTER TABLE public.terrible_teddies
      ADD COLUMN IF NOT EXISTS name TEXT NOT NULL,
      ADD COLUMN IF NOT EXISTS title TEXT NOT NULL,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS attack INTEGER NOT NULL,
      ADD COLUMN IF NOT EXISTS defense INTEGER NOT NULL,
      ADD COLUMN IF NOT EXISTS special_move TEXT NOT NULL,
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Error adding columns: %', SQLERRM;
    END;

    RAISE NOTICE 'Table terrible_teddies already exists, columns checked/added';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to ensure the table is created
SELECT create_terrible_teddies_table();

-- Drop the function after execution to clean up
DROP FUNCTION IF EXISTS create_terrible_teddies_table();