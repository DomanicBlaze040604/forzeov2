-- ============================================
-- FIX PERMISSIONS AND SCHEMA CACHE
-- ============================================

-- 1. Ensure the authenticated role has access to the public schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- 2. Grant access to profiles table explicitly
GRANT ALL ON TABLE profiles TO authenticated;
GRANT SELECT ON TABLE profiles TO anon;

-- 3. Grant access to other key tables
GRANT ALL ON TABLE user_clients TO authenticated;
GRANT ALL ON TABLE clients TO authenticated;
GRANT ALL ON TABLE agency_brands TO authenticated;

-- 4. Reload the schema cache (Crucial for "Database error querying schema" errors)
NOTIFY pgrst, 'reload config';

-- 5. Just in case, verify the profile exists and is correct
-- This select is just for verifying in the results pane if running manually
SELECT * FROM profiles WHERE email = 'agency@solstium.com';
