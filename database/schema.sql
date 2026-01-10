-- ============================================
-- Forzeo Client Dashboard - Database Schema v2.0
-- ============================================
-- 
-- Production-ready multi-tenant SaaS schema with:
-- - Organizations (tenants) with billing
-- - Clients (brands being tracked)
-- - Prompts with niche/super-niche categories
-- - Audit results with full metrics
-- - Citations tracking
-- - API usage and cost tracking
-- - User management and permissions
-- 
-- Security Features:
-- - Row Level Security (RLS) on all tables
-- - Audit logging
-- - Input validation via constraints
-- - Secure defaults
-- 
-- @version 2.0.0
-- @author Forzeo Team
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUMS
-- ============================================

-- Prompt category enum for type safety
CREATE TYPE prompt_category AS ENUM (
  'broad',
  'niche', 
  'super_niche',
  'long_tail',
  'comparison',
  'problem',
  'feature',
  'local',
  'custom',
  'imported',
  'default'
);

-- Sentiment enum
CREATE TYPE sentiment_type AS ENUM ('positive', 'neutral', 'negative');

-- Plan types
CREATE TYPE plan_type AS ENUM ('free', 'starter', 'pro', 'enterprise');

-- User roles
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- ============================================
-- ORGANIZATIONS (Tenants)
-- ============================================
-- Top-level entity for multi-tenancy
-- Each organization can have multiple clients/brands

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 100),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  plan plan_type DEFAULT 'free',
  
  -- Billing info
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_email TEXT,
  
  -- Usage limits based on plan
  max_clients INTEGER DEFAULT 3,
  max_prompts_per_client INTEGER DEFAULT 50,
  max_audits_per_month INTEGER DEFAULT 100,
  
  -- Settings (JSONB for flexibility)
  settings JSONB DEFAULT '{
    "default_models": ["chatgpt", "google_ai_overview"],
    "notification_email": null,
    "weekly_reports": false,
    "timezone": "UTC"
  }'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;

-- ============================================
-- USERS
-- ============================================
-- User accounts linked to Supabase Auth

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- ============================================
-- ORGANIZATION MEMBERS
-- ============================================
-- Links users to organizations with roles

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role DEFAULT 'member',
  
  -- Invitation tracking
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id)
);

-- Indexes for member lookups
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- ============================================
-- CLIENTS (Brands)
-- ============================================
-- Brands/companies being tracked for AI visibility

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 100),
  brand_name TEXT NOT NULL CHECK (char_length(brand_name) >= 1),
  brand_domain TEXT, -- e.g., "juleo.club"
  brand_tags TEXT[] DEFAULT '{}', -- Alternative names to detect
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  
  -- Targeting
  target_region TEXT DEFAULT 'United States',
  location_code INTEGER DEFAULT 2840 CHECK (location_code > 0),
  industry TEXT DEFAULT 'Custom',
  
  -- Competitors to track
  competitors TEXT[] DEFAULT '{}',
  
  -- UI customization
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6' CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  
  -- Client-specific settings
  settings JSONB DEFAULT '{
    "default_models": null,
    "auto_run_on_add": false,
    "notification_email": null,
    "weekly_report": false
  }'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  UNIQUE(organization_id, slug)
);

-- Indexes for client lookups
CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(organization_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_industry ON clients(industry) WHERE deleted_at IS NULL;

-- ============================================
-- PROMPTS
-- ============================================
-- Search queries to analyze for visibility
-- Supports niche, super-niche, and other categories

CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Prompt content
  prompt_text TEXT NOT NULL CHECK (char_length(prompt_text) >= 5 AND char_length(prompt_text) <= 500),
  
  -- Category classification (niche/super-niche support)
  category prompt_category DEFAULT 'custom',
  
  -- Metadata
  is_custom BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  tags TEXT[] DEFAULT '{}',
  
  -- Audit tracking
  last_audited_at TIMESTAMPTZ,
  audit_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate prompts per client
  UNIQUE(client_id, prompt_text)
);

-- Indexes for prompt queries
CREATE INDEX IF NOT EXISTS idx_prompts_client ON prompts(client_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(client_id, category);
CREATE INDEX IF NOT EXISTS idx_prompts_priority ON prompts(client_id, priority DESC);

-- ============================================
-- AUDIT RESULTS
-- ============================================
-- Complete audit results with all metrics

CREATE TABLE IF NOT EXISTS audit_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  
  -- Prompt snapshot (in case prompt is deleted)
  prompt_text TEXT NOT NULL,
  prompt_category prompt_category DEFAULT 'custom',
  
  -- Brand info snapshot
  brand_name TEXT NOT NULL,
  brand_tags TEXT[] DEFAULT '{}',
  competitors TEXT[] DEFAULT '{}',
  
  -- Models used
  models_used TEXT[] DEFAULT '{}',
  
  -- Summary metrics
  share_of_voice INTEGER DEFAULT 0 CHECK (share_of_voice >= 0 AND share_of_voice <= 100),
  visibility_score INTEGER DEFAULT 0 CHECK (visibility_score >= 0 AND visibility_score <= 100),
  trust_index INTEGER DEFAULT 0 CHECK (trust_index >= 0 AND trust_index <= 100),
  average_rank DECIMAL(4,2),
  
  -- Counts
  total_models_checked INTEGER DEFAULT 0,
  visible_in INTEGER DEFAULT 0,
  cited_in INTEGER DEFAULT 0,
  total_citations INTEGER DEFAULT 0,
  
  -- Cost tracking
  total_cost DECIMAL(10,6) DEFAULT 0,
  
  -- Detailed results (JSONB for flexibility)
  model_results JSONB DEFAULT '[]'::jsonb,
  top_sources JSONB DEFAULT '[]'::jsonb,
  top_competitors JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_client ON audit_results(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_prompt ON audit_results(prompt_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_results(client_id, prompt_category);
CREATE INDEX IF NOT EXISTS idx_audit_sov ON audit_results(client_id, share_of_voice DESC);

-- Note: Partial indexes with NOW() are not supported in Supabase
-- Use application-level filtering for recent audits instead

-- ============================================
-- CITATIONS
-- ============================================
-- Denormalized citation tracking for fast queries

CREATE TABLE IF NOT EXISTS citations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_result_id UUID NOT NULL REFERENCES audit_results(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Citation data
  url TEXT NOT NULL,
  title TEXT,
  domain TEXT NOT NULL,
  position INTEGER,
  snippet TEXT,
  
  -- Source info
  model TEXT NOT NULL,
  is_brand_source BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for citation queries
CREATE INDEX IF NOT EXISTS idx_citations_audit ON citations(audit_result_id);
CREATE INDEX IF NOT EXISTS idx_citations_client ON citations(client_id);
CREATE INDEX IF NOT EXISTS idx_citations_domain ON citations(domain);
CREATE INDEX IF NOT EXISTS idx_citations_brand ON citations(client_id, is_brand_source) WHERE is_brand_source = true;

-- ============================================
-- API USAGE TRACKING
-- ============================================
-- Track API calls and costs for billing

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  
  -- API details
  api_name TEXT NOT NULL, -- dataforseo_serp, dataforseo_ai, groq, etc.
  endpoint TEXT,
  
  -- Usage metrics
  request_count INTEGER DEFAULT 1,
  cost DECIMAL(10,6) DEFAULT 0,
  
  -- Request metadata
  prompt_text TEXT,
  models_used TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for usage queries
CREATE INDEX IF NOT EXISTS idx_usage_org ON api_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_date ON api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_api ON api_usage(api_name);

-- Note: date_trunc is not IMMUTABLE, use application-level aggregation instead

-- ============================================
-- AUDIT LOG
-- ============================================
-- Track important actions for security/compliance

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Action details
  action TEXT NOT NULL, -- create, update, delete, export, etc.
  entity_type TEXT NOT NULL, -- client, prompt, audit_result, etc.
  entity_id UUID,
  
  -- Change data
  old_data JSONB,
  new_data JSONB,
  
  -- Request metadata
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- ============================================
-- SCHEDULED AUDITS
-- ============================================
-- For automated recurring audits

CREATE TABLE IF NOT EXISTS scheduled_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Schedule config
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 28),
  hour_utc INTEGER DEFAULT 9 CHECK (hour_utc >= 0 AND hour_utc <= 23),
  
  -- What to audit
  prompt_filter JSONB DEFAULT '{"categories": ["broad", "niche"], "active_only": true}'::jsonb,
  models TEXT[] DEFAULT ARRAY['chatgpt', 'google_ai_overview'],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for scheduled audit queries
CREATE INDEX IF NOT EXISTS idx_scheduled_client ON scheduled_audits(client_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled_audits(next_run_at) WHERE is_active = true;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_audits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY users_read_own ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid() = id);

-- Organization members can read their organizations
CREATE POLICY org_read_members ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- Organization owners/admins can update
CREATE POLICY org_update_admins ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Members can read their organization's clients
CREATE POLICY clients_read_members ON clients
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    AND deleted_at IS NULL
  );

-- Admins can manage clients
CREATE POLICY clients_manage_admins ON clients
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

-- Similar policies for other tables...
-- (Prompts, audit_results, citations follow client access)

CREATE POLICY prompts_access ON prompts
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN organization_members om ON c.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

CREATE POLICY audit_results_access ON audit_results
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN organization_members om ON c.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

CREATE POLICY citations_access ON citations
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN organization_members om ON c.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to log audit actions
CREATE OR REPLACE FUNCTION log_audit_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    organization_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit logging to important tables
CREATE TRIGGER audit_clients_changes
  AFTER INSERT OR UPDATE OR DELETE ON clients
  FOR EACH ROW EXECUTE FUNCTION log_audit_action();

-- Function to calculate monthly usage
CREATE OR REPLACE FUNCTION get_monthly_usage(org_id UUID, month_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  api_name TEXT,
  request_count BIGINT,
  total_cost DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.api_name,
    SUM(au.request_count)::BIGINT,
    SUM(au.cost)
  FROM api_usage au
  WHERE au.organization_id = org_id
    AND date_trunc('month', au.created_at) = date_trunc('month', month_date::TIMESTAMPTZ)
  GROUP BY au.api_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get client visibility summary
CREATE OR REPLACE FUNCTION get_client_visibility_summary(p_client_id UUID, days INTEGER DEFAULT 30)
RETURNS TABLE (
  avg_sov DECIMAL,
  avg_visibility_score DECIMAL,
  avg_trust_index DECIMAL,
  total_audits BIGINT,
  total_cost DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    AVG(share_of_voice)::DECIMAL,
    AVG(visibility_score)::DECIMAL,
    AVG(trust_index)::DECIMAL,
    COUNT(*)::BIGINT,
    SUM(total_cost)
  FROM audit_results
  WHERE client_id = p_client_id
    AND created_at > NOW() - (days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VIEWS
-- ============================================

-- View for client dashboard summary
CREATE OR REPLACE VIEW client_dashboard_summary AS
SELECT 
  c.id AS client_id,
  c.name AS client_name,
  c.brand_name,
  c.industry,
  c.target_region,
  COUNT(DISTINCT p.id) AS total_prompts,
  COUNT(DISTINCT ar.id) AS total_audits,
  AVG(ar.share_of_voice)::INTEGER AS avg_sov,
  AVG(ar.visibility_score)::INTEGER AS avg_visibility,
  AVG(ar.trust_index)::INTEGER AS avg_trust,
  SUM(ar.total_cost) AS total_cost,
  MAX(ar.created_at) AS last_audit_at
FROM clients c
LEFT JOIN prompts p ON c.id = p.client_id AND p.is_active = true
LEFT JOIN audit_results ar ON c.id = ar.client_id AND ar.created_at > NOW() - INTERVAL '30 days'
WHERE c.deleted_at IS NULL
GROUP BY c.id;

-- View for top citation sources
CREATE OR REPLACE VIEW top_citation_sources AS
SELECT 
  c.client_id,
  c.domain,
  COUNT(*) AS citation_count,
  COUNT(DISTINCT c.audit_result_id) AS audit_count,
  BOOL_OR(c.is_brand_source) AS includes_brand_source
FROM citations c
GROUP BY c.client_id, c.domain
ORDER BY citation_count DESC;

-- ============================================
-- SAMPLE DATA (Development Only)
-- ============================================

-- Uncomment to insert sample data for development

/*
-- Create demo organization
INSERT INTO organizations (id, name, slug, plan, max_clients, max_prompts_per_client) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Forzeo Demo', 'forzeo-demo', 'pro', 10, 100);

-- Create demo clients
INSERT INTO clients (organization_id, name, brand_name, brand_domain, brand_tags, slug, target_region, location_code, industry, competitors, primary_color) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Juleo Club', 'Juleo', 'juleo.club', ARRAY['Juleo Club', 'Trusted Singles Club'], 'juleo', 'India', 2356, 'Dating/Matrimony', ARRAY['Bumble', 'Hinge', 'Tinder', 'Shaadi', 'Aisle'], '#ec4899'),
  ('00000000-0000-0000-0000-000000000001', 'Jagota', 'Jagota', 'jagota.com', ARRAY['Jagota Brothers', 'Jagota Group'], 'jagota', 'Thailand', 2764, 'Food/Beverage', ARRAY['Sysco', 'US Foods', 'Makro', 'Metro'], '#f59e0b'),
  ('00000000-0000-0000-0000-000000000001', 'Post House Dental', 'Post House Dental', 'posthousedental.co.uk', ARRAY['Post House', 'PHD Surrey'], 'post-house-dental', 'Surrey, UK', 2826, 'Healthcare/Dental', ARRAY['Bupa Dental', 'MyDentist', 'Dental Care'], '#06b6d4'),
  ('00000000-0000-0000-0000-000000000001', 'Shoptheyn', 'Shoptheyn', 'shoptheyn.com', ARRAY['Shop Theyn', 'Theyn Fashion'], 'shoptheyn', 'India', 2356, 'E-commerce/Fashion', ARRAY['Myntra', 'Ajio', 'Amazon Fashion', 'Meesho'], '#8b5cf6');

-- Create sample prompts with categories
INSERT INTO prompts (client_id, prompt_text, category, is_custom, priority) 
SELECT 
  c.id,
  p.prompt_text,
  p.category::prompt_category,
  false,
  CASE p.category 
    WHEN 'broad' THEN 10
    WHEN 'niche' THEN 8
    WHEN 'super_niche' THEN 6
    ELSE 5
  END
FROM clients c
CROSS JOIN (VALUES
  ('Best dating apps in India 2025', 'broad'),
  ('Dating apps with ID verification India', 'niche'),
  ('Dating apps for Indian professionals looking for marriage', 'super_niche'),
  ('Juleo vs Bumble which is better', 'comparison'),
  ('How to find genuine profiles on dating apps', 'problem')
) AS p(prompt_text, category)
WHERE c.slug = 'juleo';
*/

-- ============================================
-- GRANTS (for service role)
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant all on tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
