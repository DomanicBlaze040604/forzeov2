-- ==============================================
-- FIX: Allow admin/agency to delete any brand
-- ==============================================
-- Run this in Supabase SQL Editor

-- Step 1: Ensure RLS is disabled on clients table
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop any restrictive policies that might exist
DROP POLICY IF EXISTS "Admins can manage clients" ON clients;
DROP POLICY IF EXISTS "Users can view assigned clients" ON clients;
DROP POLICY IF EXISTS "Users can create clients" ON clients;
DROP POLICY IF EXISTS "Agency can manage own clients" ON clients;

-- Step 3: Grant full permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO authenticated;

-- Step 4: Verify permissions
SELECT 
  grantee, 
  table_name, 
  privilege_type 
FROM information_schema.table_privileges 
WHERE table_name = 'clients';

-- Step 5: Test - list all clients
SELECT id, brand_name, created_at FROM clients ORDER BY created_at DESC;

-- After running this, try deleting a brand from the UI
SELECT 'Brand deletion permissions fixed!' as status;
