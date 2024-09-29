CREATE OR REPLACE FUNCTION public.create_table_if_not_exists(
  table_name text,
  table_definition text
)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1) THEN
    EXECUTE 'CREATE TABLE ' || quote_ident($1) || ' (' || $2 || ')';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;