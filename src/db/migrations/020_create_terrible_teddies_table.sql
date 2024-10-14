-- Check if the table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'terrible_teddies') THEN
        -- Create the terrible_teddies table if it doesn't exist
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
    ELSE
        -- Add any missing columns if the table already exists
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
        EXCEPTION
            WHEN duplicate_column THEN
                -- Do nothing, column already exists
        END;
    END IF;
END $$;

-- Add an index for faster queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_terrible_teddies_name ON public.terrible_teddies(name);

-- Enable Row Level Security (RLS) if not already enabled
ALTER TABLE public.terrible_teddies ENABLE ROW LEVEL SECURITY;

-- Create or replace the policy for read access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'terrible_teddies'
        AND policyname = 'Allow read access for all authenticated users'
    ) THEN
        CREATE POLICY "Allow read access for all authenticated users" ON public.terrible_teddies
            FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Create or replace the policy for admin access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'terrible_teddies'
        AND policyname = 'Allow full access for admins'
    ) THEN
        CREATE POLICY "Allow full access for admins" ON public.terrible_teddies
            USING (auth.jwt() ->> 'role' = 'admin');
    END IF;
END $$;