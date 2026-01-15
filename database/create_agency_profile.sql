-- ============================================
-- FIX MISSING PROFILE FOR AGENCY USER
-- ============================================

INSERT INTO public.profiles (id, email, role, full_name, is_active)
SELECT id, email, 'agency', 'Solstium Agency', true
FROM auth.users 
WHERE email = 'agency@solstium.com';
