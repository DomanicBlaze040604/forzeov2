-- ============================================
-- RBAC MIGRATION - SIMPLIFIED (No Enum Conflicts)
-- ============================================
-- This version uses TEXT instead of enum to avoid conflicts
-- Run this in Supabase SQL Editor

-- Step 1: Create profiles table (using TEXT for role)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- Step 3: Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 4: Profiles RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Step 5: Create trigger for auto-profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 6: Create profiles for existing users
INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id, 
  email,
  COALESCE(raw_user_meta_data->>'full_name', '') as full_name,
  'user' as role
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.users.id);

-- Step 7: Create user_clients table
CREATE TABLE IF NOT EXISTS user_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- Step 8: Create indexes for user_clients
CREATE INDEX IF NOT EXISTS idx_user_clients_user ON user_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clients_client ON user_clients(client_id);

-- Step 9: Enable RLS on user_clients
ALTER TABLE user_clients ENABLE ROW LEVEL SECURITY;

-- Step 10: Helper functions
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_uuid 
    AND role = 'admin'
    AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Step 11: RLS Policies for user_clients
DROP POLICY IF EXISTS "Admins can view all user_clients" ON user_clients;
DROP POLICY IF EXISTS "Users can view own associations" ON user_clients;
DROP POLICY IF EXISTS "Admins can manage user_clients" ON user_clients;

CREATE POLICY "Admins can view all user_clients"
ON user_clients FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own associations"
ON user_clients FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage user_clients"
ON user_clients FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Step 12: RLS Policies for clients
DROP POLICY IF EXISTS "Admins can view all clients" ON clients;
DROP POLICY IF EXISTS "Users can view assigned clients" ON clients;
DROP POLICY IF EXISTS "Admins can modify clients" ON clients;
DROP POLICY IF EXISTS "Admins can update clients" ON clients;
DROP POLICY IF EXISTS "Admins can delete clients" ON clients;

CREATE POLICY "Admins can view all clients"
ON clients FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

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

CREATE POLICY "Admins can modify clients"
ON clients FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Step 13: RLS Policies for prompts
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

-- Step 14: RLS Policies for audit_results
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

-- Step 15: RLS for campaigns (admin only)
DROP POLICY IF EXISTS "Admin only campaigns access" ON campaigns;

CREATE POLICY "Admin only campaigns access"
ON campaigns FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- Step 16: RLS for schedules (admin only)
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

-- Step 17: RLS for tavily_results
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

-- Step 18: Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tavily_results ENABLE ROW LEVEL SECURITY;

-- Step 19: Grant permissions
GRANT ALL ON user_clients TO authenticated;

-- ============================================
-- SUCCESS! Now run these commands separately:
-- ============================================

-- 1. Set yourself as admin (replace with your email)
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';

-- 2. Verify you're admin
-- SELECT id, email, role FROM profiles WHERE role = 'admin';

-- 3. Assign all existing clients to admin
-- INSERT INTO user_clients (user_id, client_id, granted_by)
-- SELECT 
--   (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1),
--   id,
--   (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)
-- FROM clients
-- ON CONFLICT (user_id, client_id) DO NOTHING;

-- 4. Verify the assignments
-- SELECT COUNT(*) FROM user_clients;

SELECT 'RBAC Migration completed successfully!' as message,
       (SELECT COUNT(*) FROM profiles) as total_profiles,
       (SELECT COUNT(*) FROM profiles WHERE role = 'admin') as admin_count,
       (SELECT COUNT(*) FROM user_clients) as client_assignments;
