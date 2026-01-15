-- ============================================
-- FINAL RESTORATION & AGENCY CONFIRMATION
-- ============================================

-- 1. Confirm the Agency Email & Set Role (Overrides verification link)
UPDATE auth.users
SET email_confirmed_at = now(),
    encrypted_password = crypt('SolstiumAgency2026!', gen_salt('bf')) -- Ensure password is correct
WHERE email = 'agency@solstium.com';

INSERT INTO public.profiles (id, email, role, full_name, is_active)
SELECT id, email, 'agency', 'Solstium Agency', true
FROM auth.users
WHERE email = 'agency@solstium.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'agency', is_active = true;

-- 2. Restore System Security (Re-enable RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Restore Automation (Corrected Trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    'user', 
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail auth
  RAISE WARNING 'handle_new_user exception: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload config';

-- 5. Verification
SELECT id, email, role, is_active FROM profiles WHERE email = 'agency@solstium.com';
