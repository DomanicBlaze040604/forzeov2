-- ============================================
-- ISOLATE AUTH FIX - Debug 500 Error
-- ============================================

-- 1. DROP ALL TRIGGERS on auth.users causing side effects
-- This stops the DB from trying to create/update profiles during login
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. DISABLE RLS on profiles explicitly
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 3. ENSURE Agency Profile Exists (Manually)
-- We do this manually since we disabled the auto-trigger
INSERT INTO public.profiles (id, email, role, full_name, is_active)
SELECT id, email, 'agency', 'Solstium Agency', true
FROM auth.users
WHERE email = 'agency@solstium.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'agency', is_active = true, email = 'agency@solstium.com';

-- 4. GRANT PERMISSIONS
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

-- 5. RELOAD CONFIG
NOTIFY pgrst, 'reload config';

-- 6. VERIFY
SELECT id, email, role FROM profiles WHERE email = 'agency@solstium.com';
