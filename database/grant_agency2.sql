-- ============================================
-- ENABLE VERIFICATION ACCOUNT (agency2)
-- ============================================

-- 1. Confirm Email & Set Role for agency2@solstium.com
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'agency2@solstium.com';

-- 2. Ensure Profile Exists with Agency Role
INSERT INTO public.profiles (id, email, role, full_name, is_active)
SELECT id, email, 'agency', 'Agency verification', true
FROM auth.users
WHERE email = 'agency2@solstium.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'agency', is_active = true;

-- 3. Just for good measure, make sure is_active is true
UPDATE public.profiles 
SET is_active = true 
WHERE email = 'agency2@solstium.com';
