-- ============================================
-- FIX AGENCY LOGIN - Database Schema Repair
-- ============================================
-- Run this in Supabase Dashboard > SQL Editor > New Query

-- 1. Disable RLS temporarily (most common cause of auth issues)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. Ensure the trigger function handles exceptions gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'user'),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log but don't fail the auth flow
  RAISE WARNING 'handle_new_user exception: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure agency user exists in profiles table
INSERT INTO public.profiles (id, email, role, full_name, is_active)
SELECT id, email, 'agency', 'Solstium Agency', true
FROM auth.users
WHERE email = 'agency@solstium.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'agency', is_active = true;

-- 4. Grant permissions to allow auth flow
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

-- 5. Reload PostgREST cache
NOTIFY pgrst, 'reload config';

-- 6. Verify the fix worked
SELECT id, email, role, is_active FROM profiles WHERE email = 'agency@solstium.com';
