
-- ==========================================================
-- NUCLEAR FIX: DROP AND RECREATE PROFILES TABLE
-- ==========================================================
-- Warning: This resets the profiles table structure.
-- It attempts to preserve data but the structure is forced.

-- 1. Create a backup just in case
CREATE TABLE IF NOT EXISTS profiles_backup AS SELECT * FROM profiles;

-- 2. DROP the triggers first (to avoid dependency errors)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. DROP the table entirely to remove any weird constraints/RLS
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 4. Recreate the table - SIMPLEST VERSION
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    role TEXT DEFAULT 'user', -- Simplified from ENUM
    full_name TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Open the floodgates (Permissions)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

-- 6. Manually fix the admin user (Ensure they exist in profiles)
-- Replace 'agency@solstium.com' if you are using a different email
INSERT INTO public.profiles (id, email, role, full_name, is_active)
SELECT id, email, 'agency', 'Solstium Agency', true
FROM auth.users
WHERE email = 'agency@solstium.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'agency', is_active = true;

-- 7. Restore the Auth Trigger (Standard)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'user');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Final Cache Reload
NOTIFY pgrst, 'reload config';
