CREATE OR REPLACE FUNCTION public.run_sql_migration(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;