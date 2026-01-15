-- ============================================
-- FIX SPECIFIC AGENCY USER ACCOUNT
-- ============================================
-- The system is healthy (new users can sign up).
-- The agency@solstium.com user account is corrupted.
-- We will delete it so you can re-register it cleanly.

-- 1. Delete the specific corrupted user (and their profile)
DELETE FROM auth.users WHERE email = 'agency@solstium.com';

-- 2. Verify deletion
SELECT id, email FROM auth.users WHERE email = 'agency@solstium.com';
-- (Should return 0 rows)

-- ============================================
-- INSTRUCTIONS AFTER RUNNING THIS:
-- ============================================
-- 1. Go to your app login screen: http://localhost:5173/
-- 2. Click "Sign up" (NOT Sign In)
-- 3. Sign up with:
--    Email: agency@solstium.com
--    Password: SolstiumAgency2026!
-- 4. It should succeed now!
-- 5. AFTER you sign up, come back here and run STEP 3 below to restore "agency" role.

-- ============================================
-- STEP 3: RESTORE AGENCY ROLE (Run AFTER Signup)
-- ============================================
/*
UPDATE public.profiles
SET role = 'agency', is_active = true
WHERE email = 'agency@solstium.com';
*/
