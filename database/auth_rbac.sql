-- ============================================
-- USER AUTHENTICATION & RBAC SCHEMA
-- ============================================
-- This migration adds role-based access control with data isolation
-- Run this script in Supabase SQL Editor

-- 1. CREATE USER ROLE ENUM
-- ============================================
-- Drop existing enum if it exists (this will fail if tables are using it)
DO $$ 
BEGIN
  -- Drop the enum if it exists and no tables are using it
  DROP TYPE IF EXISTS user_role CASCADE;
  
  -- Create the enum
  CREATE TYPE user_role AS ENUM ('admin', 'user');
  
EXCEPTION
  WHEN OTHERS THEN
    -- If drop fails, the enum might be in use, just continue
    RAISE NOTICE 'user_role enum may already exist or be in use';
END $$;

-- 2. CREATE OR MODIFY PROFILES TABLE
-- ============================================
-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add role column to existing profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Create trigger to auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- 3. CREATE USER_CLIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_clients_user ON user_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clients_client ON user_clients(client_id);

-- Enable RLS on user_clients
ALTER TABLE user_clients ENABLE ROW LEVEL SECURITY;

-- 4. CREATE HELPER FUNCTIONS
-- ============================================

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_uuid 
    AND role = 'admin'
    AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to assign user to client
CREATE OR REPLACE FUNCTION assign_user_to_client(
  p_user_id UUID,
  p_client_id UUID,
  p_granted_by UUID DEFAULT auth.uid()
)
RETURNS void AS $$
BEGIN
  -- Only admins can assign users to clients
  IF NOT is_admin(p_granted_by) THEN
    RAISE EXCEPTION 'Only admins can assign users to clients';
  END IF;
  
  INSERT INTO user_clients (user_id, client_id, granted_by)
  VALUES (p_user_id, p_client_id, p_granted_by)
  ON CONFLICT (user_id, client_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove user from client
CREATE OR REPLACE FUNCTION remove_user_from_client(
  p_user_id UUID,
  p_client_id UUID
)
RETURNS void AS $$
BEGIN
  -- Only admins can remove user access
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can remove user access';
  END IF;
  
  DELETE FROM user_clients 
  WHERE user_id = p_user_id 
  AND client_id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS POLICIES - USER_CLIENTS
-- ============================================

-- Admins can see all user-client associations
CREATE POLICY "Admins can view all user_clients"
ON user_clients FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Users can only see their own associations
CREATE POLICY "Users can view own associations"
ON user_clients FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only admins can insert/update/delete
CREATE POLICY "Admins can manage user_clients"
ON user_clients FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- 6. RLS POLICIES - CLIENTS
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view all clients" ON clients;
DROP POLICY IF EXISTS "Users can view assigned clients" ON clients;

-- Admins see all clients
CREATE POLICY "Admins can view all clients"
ON clients FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Normal users only see their assigned clients
CREATE POLICY "Users can view assigned clients"
ON clients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_clients
    WHERE user_clients.client_id = clients.id
    AND user_clients.user_id = auth.uid()
  )
);

-- Only admins can modify clients
CREATE POLICY "Admins can modify clients"
ON clients FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update clients"
ON clients FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete clients"
ON clients FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- 7. RLS POLICIES - PROMPTS
-- ============================================

DROP POLICY IF EXISTS "Users can access prompts for their clients" ON prompts;

CREATE POLICY "Users can access prompts for their clients"
ON prompts FOR ALL
TO authenticated
USING (
  is_admin(auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM user_clients
    WHERE user_clients.client_id = prompts.client_id
    AND user_clients.user_id = auth.uid()
  )
);

-- 8. RLS POLICIES - AUDIT_RESULTS
-- ============================================

DROP POLICY IF EXISTS "Users can access audit_results for their clients" ON audit_results;

CREATE POLICY "Users can access audit_results for their clients"
ON audit_results FOR ALL
TO authenticated
USING (
  is_admin(auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM user_clients
    WHERE user_clients.client_id = audit_results.client_id
    AND user_clients.user_id = auth.uid()
  )
);

-- 9. RLS POLICIES - CAMPAIGNS
-- ============================================

DROP POLICY IF EXISTS "Admin only campaigns access" ON campaigns;

CREATE POLICY "Admin only campaigns access"
ON campaigns FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- 10. RLS POLICIES - SCHEDULES
-- ============================================

DROP POLICY IF EXISTS "Admin only schedules access" ON prompt_schedules;
DROP POLICY IF EXISTS "Admin only schedule_runs access" ON schedule_runs;

CREATE POLICY "Admin only schedules access"
ON prompt_schedules FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Admin only schedule_runs access"
ON schedule_runs FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- 11. RLS POLICIES - TAVILY_RESULTS
-- ============================================

DROP POLICY IF EXISTS "Users can access tavily_results for their clients" ON tavily_results;

CREATE POLICY "Users can access tavily_results for their clients"
ON tavily_results FOR ALL
TO authenticated
USING (
  is_admin(auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM user_clients
    WHERE user_clients.client_id = tavily_results.client_id
    AND user_clients.user_id = auth.uid()
  )
);

-- 12. ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tavily_results ENABLE ROW LEVEL SECURITY;

-- 13. GRANT PERMISSIONS
-- ============================================

GRANT ALL ON user_clients TO authenticated;
GRANT USAGE ON SEQUENCE user_clients_id_seq TO authenticated;

-- 14. CREATE PROFILES FOR EXISTING USERS
-- ============================================
-- If you have existing auth.users, create their profiles
INSERT INTO profiles (id, email, full_name)
SELECT 
  id, 
  email,
  raw_user_meta_data->>'full_name'
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- 15. CREATE ADMIN USER & ASSIGN BRANDS
-- ============================================
-- IMPORTANT: Replace 'your-admin-email@example.com' with your actual admin email

-- Set first user as admin (uncomment and modify email)
-- UPDATE profiles 
-- SET role = 'admin' 
-- WHERE email = 'your-admin-email@example.com';

-- Assign all existing clients to admin (run after setting admin)
-- INSERT INTO user_clients (user_id, client_id, granted_by)
-- SELECT 
--   (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1),
--   id,
--   (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)
-- FROM clients
-- ON CONFLICT (user_id, client_id) DO NOTHING;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify installation
SELECT 'Migration completed successfully!' AS status;
SELECT 'Total users: ' || COUNT(*) FROM profiles;
SELECT 'Total clients: ' || COUNT(*) FROM clients;
SELECT 'Admin users: ' || COUNT(*) FROM profiles WHERE role = 'admin';
