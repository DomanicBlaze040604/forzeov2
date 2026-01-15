-- ============================================
-- AGENCY ROLE SCHEMA MIGRATION
-- ============================================
-- This migration adds agency role support with multi-brand management
-- Run this script in Supabase SQL Editor after auth_rbac.sql

-- 1. UPDATE USER ROLE ENUM TO INCLUDE AGENCY
-- ============================================
-- Note: This requires recreating the enum

DO $$ 
BEGIN
  -- First, check if 'agency' value already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'agency' 
    AND enumtypid = 'user_role'::regtype
  ) THEN
    -- Add 'agency' to the enum
    ALTER TYPE user_role ADD VALUE 'agency' AFTER 'admin';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add agency to user_role enum, it may already exist';
END $$;

-- 2. CREATE AGENCY_BRANDS TABLE
-- ============================================
-- This table tracks which brands/clients an agency user manages
CREATE TABLE IF NOT EXISTS agency_brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(agency_user_id, client_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agency_brands_user ON agency_brands(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_brands_client ON agency_brands(client_id);
CREATE INDEX IF NOT EXISTS idx_agency_brands_active ON agency_brands(is_active);

-- Enable RLS on agency_brands
ALTER TABLE agency_brands ENABLE ROW LEVEL SECURITY;

-- 3. HELPER FUNCTIONS FOR AGENCY
-- ============================================

-- Function to check if user is agency
CREATE OR REPLACE FUNCTION is_agency(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_uuid 
    AND role = 'agency'
    AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user has admin or agency role
CREATE OR REPLACE FUNCTION is_admin_or_agency(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_uuid 
    AND role IN ('admin', 'agency')
    AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to assign brand to agency user (admin only)
CREATE OR REPLACE FUNCTION assign_brand_to_agency(
  p_agency_user_id UUID,
  p_client_id UUID,
  p_added_by UUID DEFAULT auth.uid()
)
RETURNS void AS $$
BEGIN
  -- Only admins can assign brands to agency users
  IF NOT is_admin(p_added_by) THEN
    RAISE EXCEPTION 'Only admins can assign brands to agency users';
  END IF;
  
  -- Verify the user is an agency user
  IF NOT is_agency(p_agency_user_id) THEN
    RAISE EXCEPTION 'Target user must have agency role';
  END IF;
  
  INSERT INTO agency_brands (agency_user_id, client_id, added_by)
  VALUES (p_agency_user_id, p_client_id, p_added_by)
  ON CONFLICT (agency_user_id, client_id) 
  DO UPDATE SET is_active = true, added_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove brand from agency user (admin only)
CREATE OR REPLACE FUNCTION remove_brand_from_agency(
  p_agency_user_id UUID,
  p_client_id UUID
)
RETURNS void AS $$
BEGIN
  -- Only admins can remove brand access
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can remove brand access from agency users';
  END IF;
  
  UPDATE agency_brands 
  SET is_active = false
  WHERE agency_user_id = p_agency_user_id 
  AND client_id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS POLICIES FOR AGENCY_BRANDS
-- ============================================

-- Admins can see all agency brand associations
CREATE POLICY "Admins can view all agency_brands"
ON agency_brands FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Agency users can see their own brand associations
CREATE POLICY "Agency users can view own brands"
ON agency_brands FOR SELECT
TO authenticated
USING (agency_user_id = auth.uid());

-- Only admins can manage agency_brands
CREATE POLICY "Admins can manage agency_brands"
ON agency_brands FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- 5. UPDATE CLIENT ACCESS POLICIES FOR AGENCY
-- ============================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Agency users can view assigned brands" ON clients;

-- Agency users can see their assigned brands
CREATE POLICY "Agency users can view assigned brands"
ON clients FOR SELECT
TO authenticated
USING (
  is_agency(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM agency_brands
    WHERE agency_brands.client_id = clients.id
    AND agency_brands.agency_user_id = auth.uid()
    AND agency_brands.is_active = true
  )
);

-- 6. UPDATE PROMPTS ACCESS FOR AGENCY
-- ============================================

-- Drop and recreate the policy to include agency access
DROP POLICY IF EXISTS "Users can access prompts for their clients" ON prompts;

CREATE POLICY "Users can access prompts for their clients"
ON prompts FOR ALL
TO authenticated
USING (
  is_admin(auth.uid())
  OR
  -- Normal users via user_clients
  EXISTS (
    SELECT 1 FROM user_clients
    WHERE user_clients.client_id = prompts.client_id
    AND user_clients.user_id = auth.uid()
  )
  OR
  -- Agency users via agency_brands
  (is_agency(auth.uid()) AND EXISTS (
    SELECT 1 FROM agency_brands
    WHERE agency_brands.client_id = prompts.client_id
    AND agency_brands.agency_user_id = auth.uid()
    AND agency_brands.is_active = true
  ))
);

-- 7. UPDATE AUDIT_RESULTS ACCESS FOR AGENCY
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
  OR
  (is_agency(auth.uid()) AND EXISTS (
    SELECT 1 FROM agency_brands
    WHERE agency_brands.client_id = audit_results.client_id
    AND agency_brands.agency_user_id = auth.uid()
    AND agency_brands.is_active = true
  ))
);

-- 8. UPDATE TAVILY_RESULTS ACCESS FOR AGENCY
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
  OR
  (is_agency(auth.uid()) AND EXISTS (
    SELECT 1 FROM agency_brands
    WHERE agency_brands.client_id = tavily_results.client_id
    AND agency_brands.agency_user_id = auth.uid()
    AND agency_brands.is_active = true
  ))
);

-- 9. GRANT PERMISSIONS
-- ============================================

GRANT ALL ON agency_brands TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

SELECT 'Agency schema migration completed successfully!' AS status;
