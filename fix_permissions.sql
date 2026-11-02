-- ==============================================================================
-- RETAIL NEXT - FIX SUPABASE TABLE PERMISSIONS & ROW LEVEL SECURITY
-- ==============================================================================
-- Run this in your Supabase Project:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste this file & Click "Run"
-- ==============================================================================

-- 1. Grant usage on schema public to all Supabase roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Grant all privileges on all existing tables in public schema
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 3. Grant all privileges on all sequences in public schema
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 4. Grant all privileges on all routines/functions in public schema
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 5. Ensure any tables/sequences created in the future automatically inherit permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

-- 6. Ensure RLS policies exist for service_role and authenticated users across all tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service role bypass %I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Service role bypass %I" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated full access %I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Allow authenticated full access %I" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;

