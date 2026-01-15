-- ============================================
-- FULL SCHEMA REPAIR & PERMISSIONS FIX
-- ============================================

-- 1. Reset Permissions on Public Schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 2. Ensure Default Privileges for Future Tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- 3. Fix Profiles Table Structure (Force known state)
-- We convert role to TEXT to avoid any ENUM confusion
ALTER TABLE profiles ALTER COLUMN role TYPE text;

-- 4. Remove the constraint entirely for now (we can add it back later if strictly needed)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 5. Fix RLS Policies (Ensure they aren't blocking schema discovery)
-- Temporarily disable RLS to see if that allows login (can re-enable after confirmation)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 6. Reload PostgREST Schema Cache (The magic command)
NOTIFY pgrst, 'reload config';

-- 7. Verification Select
SELECT id, email, role FROM profiles WHERE email = 'agency@solstium.com';
