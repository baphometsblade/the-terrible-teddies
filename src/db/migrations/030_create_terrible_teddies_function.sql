-- Drop the function if it exists to avoid conflicts
DROP FUNCTION IF EXISTS create_terrible_teddies_table();

-- Create or replace the function to create the terrible_teddies table
CREATE OR REPLACE FUNCTION create_terrible_teddies_table()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.terrible_teddies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    attack INTEGER NOT NULL,
    defense INTEGER NOT NULL,
    special_move TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
END;
$$ LANGUAGE plpgsql;

-- Execute the function to ensure the table is created
SELECT create_terrible_teddies_table();

-- Drop the function after execution to clean up
DROP FUNCTION IF EXISTS create_terrible_teddies_table();