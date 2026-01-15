-- ============================================
-- FIX AGENCY ROLE CONSTRAINT
-- ============================================
-- The profiles table has a CHECK constraint that only allows 'admin' or 'user'.
-- We need to update this constraint to allow 'agency' as well.

-- 1. Drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Add the updated constraint including 'agency'
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'user', 'agency'));

-- 3. Now you can set the role to 'agency'
-- (Run the previous role update command again after running this script)
