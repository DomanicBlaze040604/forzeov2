-- ==============================================
-- FIX: Isolate agency brands while allowing deletion
-- ==============================================
-- Run this in Supabase SQL Editor INSTEAD of fix_brand_deletion.sql

-- Step 1: Enable RLS on clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies
DROP POLICY IF EXISTS "Admins can manage clients" ON clients;
DROP POLICY IF EXISTS "Users can view assigned clients" ON clients;
DROP POLICY IF EXISTS "Users can create clients" ON clients;
DROP POLICY IF EXISTS "Agency can manage own clients" ON clients;
DROP POLICY IF EXISTS "allow_all_clients" ON clients;

-- Step 3: Create proper policies

-- Admins can do everything
CREATE POLICY "Admins full access" ON clients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true));

-- Agency/Users can only see clients they have access to via user_clients
CREATE POLICY "Users view own clients" ON clients FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = clients.id AND user_clients.user_id = auth.uid())
  );

-- Agency/Users can create new clients
CREATE POLICY "Users can create clients" ON clients FOR INSERT TO authenticated
  WITH CHECK (true);

-- Agency/Users can update their own clients
CREATE POLICY "Users update own clients" ON clients FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = clients.id AND user_clients.user_id = auth.uid())
  );

-- Agency/Users can delete their own clients
CREATE POLICY "Users delete own clients" ON clients FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = clients.id AND user_clients.user_id = auth.uid())
  );

-- Step 4: Also ensure user_clients has proper RLS
ALTER TABLE user_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own associations" ON user_clients;
DROP POLICY IF EXISTS "Users can create client associations" ON user_clients;

CREATE POLICY "View own associations" ON user_clients FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Create own associations" ON user_clients FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Delete own associations" ON user_clients FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Step 5: Verify policies
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients';

SELECT 'Agency brand isolation fixed!' as status;
