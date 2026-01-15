-- ============================================================
-- FORZEO PLATFORM — COMPLETE PRODUCTION SCHEMA
-- ============================================================
-- Single-file setup for a fresh Supabase project.
-- Includes:
-- 1. Extensions & Enums
-- 2. Base Tables (Orgs, Profiles, Clients)
-- 3. Core Logic (Prompts, Campaigns, Audits)
-- 4. Intelligence Layers (Citations, Signals, Tavily)
-- 5. Helper Functions & Triggers
-- 6. Row Level Security (RBAC + Client Access)
-- ============================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';

-- ======================
-- 1. EXTENSIONS
-- ======================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ======================
-- 2. ENUMS
-- ======================
DO $$ BEGIN
  CREATE TYPE prompt_category AS ENUM (
    'broad','niche','super_niche','long_tail',
    'comparison','problem','feature','local',
    'custom','imported','default'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sentiment_type AS ENUM ('positive','neutral','negative');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE plan_type AS ENUM ('free','starter','pro','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ======================
-- 3. FUNCTIONS (Early Declarations)
-- ======================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================
-- 4. TABLES
-- ======================

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan plan_type DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_email TEXT,
  max_clients INT DEFAULT 3,
  max_prompts_per_client INT DEFAULT 50,
  max_audits_per_month INT DEFAULT 100,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Profiles (Replaces Users table for RBAC)
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

-- Organization Members (Links users to organizations)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  brand_domain TEXT,
  brand_tags TEXT[] DEFAULT '{}',
  slug TEXT NOT NULL,
  target_region TEXT DEFAULT 'United States',
  location_code INT DEFAULT 2840,
  industry TEXT DEFAULT 'Custom',
  competitors TEXT[] DEFAULT '{}',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (organization_id, slug)
);

-- User-Client Association (For Permissions)
CREATE TABLE IF NOT EXISTS user_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- Prompts
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  category prompt_category DEFAULT 'custom',
  is_custom BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 5,
  tags TEXT[] DEFAULT '{}',
  last_audited_at TIMESTAMPTZ,
  audit_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, prompt_text)
);

-- Prompt Versions
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  version INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  total_prompts INT DEFAULT 0,
  completed_prompts INT DEFAULT 0,
  avg_sov NUMERIC,
  avg_rank NUMERIC,
  total_citations INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Audit Results
CREATE TABLE IF NOT EXISTS audit_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  prompt_version_id UUID REFERENCES prompt_versions(id),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  triggering_signal_id UUID,
  prompt_text TEXT NOT NULL,
  prompt_category prompt_category,
  brand_name TEXT,
  brand_tags TEXT[],
  competitors TEXT[],
  models_used TEXT[],
  share_of_voice INT DEFAULT 0,
  visibility_score INT DEFAULT 0,
  trust_index INT DEFAULT 0,
  average_rank DECIMAL(5,2),
  total_models_checked INT DEFAULT 0,
  visible_in INT DEFAULT 0,
  cited_in INT DEFAULT 0,
  total_citations INT DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  model_results JSONB DEFAULT '[]',
  summary JSONB DEFAULT '{}',
  top_sources JSONB DEFAULT '[]',
  top_competitors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Model Costs
CREATE TABLE IF NOT EXISTS model_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_result_id UUID REFERENCES audit_results(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  tokens_used INT,
  cost DECIMAL(10,6)
);

-- Citations
CREATE TABLE IF NOT EXISTS citations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_result_id UUID REFERENCES audit_results(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  domain TEXT NOT NULL,
  position INT,
  snippet TEXT,
  model TEXT NOT NULL,
  is_brand_source BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Citation Intelligence
CREATE TABLE IF NOT EXISTS citation_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citation_id UUID REFERENCES citations(id) ON DELETE CASCADE,
    audit_result_id UUID REFERENCES audit_results(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    title TEXT,
    model TEXT,
    is_reachable BOOLEAN,
    http_status INTEGER,
    last_verified_at TIMESTAMPTZ,
    is_hallucinated BOOLEAN DEFAULT FALSE,
    hallucination_type TEXT,
    hallucination_reason TEXT,
    citation_category TEXT DEFAULT 'other',
    subcategory TEXT,
    opportunity_level TEXT DEFAULT 'medium',
    brand_mentioned_in_source BOOLEAN DEFAULT FALSE,
    competitor_mentions TEXT[],
    sentiment sentiment_type,
    ai_analysis JSONB DEFAULT '{}',
    analysis_status TEXT DEFAULT 'pending',
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Citation Recommendations
CREATE TABLE IF NOT EXISTS citation_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citation_intelligence_id UUID REFERENCES citation_intelligence(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    recommendation_type TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT,
    generated_content TEXT,
    content_type TEXT,
    action_items TEXT[],
    estimated_effort TEXT,
    is_actioned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RSS Feeds
CREATE TABLE IF NOT EXISTS rss_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rss_url TEXT NOT NULL,
  feed_type TEXT DEFAULT 'google_alert',
  topic TEXT,
  brand_keywords TEXT[],
  competitor_keywords TEXT[],
  is_active BOOLEAN DEFAULT true,
  poll_interval_hours INT DEFAULT 6,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fresh Signals
CREATE TABLE IF NOT EXISTS fresh_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  feed_id UUID REFERENCES rss_feeds(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  title TEXT,
  content_snippet TEXT,
  published_at TIMESTAMPTZ,
  source_domain TEXT,
  brand_mentions TEXT[],
  competitor_mentions TEXT[],
  freshness_score FLOAT DEFAULT 0,
  authority_score FLOAT DEFAULT 0,
  relevance_score FLOAT DEFAULT 0,
  influence_score FLOAT DEFAULT 0,
  processing_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, url_hash)
);

-- Signal Correlations
CREATE TABLE IF NOT EXISTS signal_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES fresh_signals(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_text TEXT,
  tavily_rank INT,
  tavily_appears BOOLEAN DEFAULT false,
  classification TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tavily Results (New)
CREATE TABLE IF NOT EXISTS tavily_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  query TEXT NOT NULL,
  answer TEXT,
  sources JSONB DEFAULT '[]'::jsonb,
  raw_content JSONB,
  search_depth TEXT DEFAULT 'advanced',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recommendations (General)
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  recommendation_type TEXT,
  priority TEXT DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  action_items TEXT[],
  is_read BOOLEAN DEFAULT false,
  is_actioned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recommendation Sources
CREATE TABLE IF NOT EXISTS recommendation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
  source_type TEXT CHECK (source_type IN ('audit','citation','signal')),
  source_id UUID,
  confidence_score FLOAT DEFAULT 0.5
);

-- Domain Authority
CREATE TABLE IF NOT EXISTS domain_authority (
  domain TEXT PRIMARY KEY,
  authority_bucket TEXT DEFAULT 'unknown',
  authority_score FLOAT DEFAULT 0.5,
  domain_type TEXT,
  is_trusted BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS domain_authority_history (
  domain TEXT,
  authority_score FLOAT,
  measured_at TIMESTAMPTZ DEFAULT now()
);

-- Schedules
CREATE TABLE IF NOT EXISTS prompt_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  interval_value INTEGER NOT NULL CHECK (interval_value > 0),
  interval_unit TEXT NOT NULL CHECK (interval_unit IN ('seconds', 'minutes', 'hours', 'days')),
  is_active BOOLEAN DEFAULT true,
  include_tavily BOOLEAN DEFAULT true,
  models TEXT[] DEFAULT ARRAY['chatgpt', 'google_ai_overview'],
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  total_runs INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES prompt_schedules(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  share_of_voice INTEGER DEFAULT 0,
  visibility_score INTEGER DEFAULT 0,
  average_rank DECIMAL(4,2),
  total_citations INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  model_results JSONB DEFAULT '[]'::jsonb,
  tavily_results JSONB,
  sources JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Execution Events
CREATE TABLE IF NOT EXISTS execution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  entity_type TEXT,
  entity_id UUID,
  event_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API Usage Tracking (for billing)
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  api_name TEXT NOT NULL,
  endpoint TEXT,
  request_count INTEGER DEFAULT 1,
  cost DECIMAL(10,6) DEFAULT 0,
  prompt_text TEXT,
  models_used TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_org ON api_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_date ON api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_api ON api_usage(api_name);

-- Audit Log (for security/compliance)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Scheduled Audits (for recurring audits)
CREATE TABLE IF NOT EXISTS scheduled_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 28),
  hour_utc INTEGER DEFAULT 9 CHECK (hour_utc >= 0 AND hour_utc <= 23),
  prompt_filter JSONB DEFAULT '{"categories": ["broad", "niche"], "active_only": true}'::jsonb,
  models TEXT[] DEFAULT ARRAY['chatgpt', 'google_ai_overview'],
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_client ON scheduled_audits(client_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled_audits(next_run_at) WHERE is_active = true;

-- ======================
-- 5. INDEXES
-- ======================
CREATE INDEX IF NOT EXISTS idx_full_profile_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_clients_lookup ON user_clients(user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_prompts_client ON prompts(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_client ON audit_results(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_campaign ON audit_results(campaign_id);
CREATE INDEX IF NOT EXISTS idx_citations_audit ON citations(audit_result_id);
CREATE INDEX IF NOT EXISTS idx_fresh_signals_client ON fresh_signals(client_id);
CREATE INDEX IF NOT EXISTS idx_tavily_results_client ON tavily_results(client_id);

-- ======================
-- 6. TRIGGERS
-- ======================
-- Apply update_updated_at trigger to all relevant tables
CREATE TRIGGER update_orgs_ts BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_profiles_ts BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_clients_ts BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_prompts_ts BEFORE UPDATE ON prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_campaigns_ts BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_citation_intel_ts BEFORE UPDATE ON citation_intelligence FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_rss_feeds_ts BEFORE UPDATE ON rss_feeds FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_schedules_ts BEFORE UPDATE ON prompt_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_fresh_signals_ts BEFORE UPDATE ON fresh_signals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_recommendations_ts BEFORE UPDATE ON recommendations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_citation_recs_ts BEFORE UPDATE ON citation_recommendations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_scheduled_audits_ts BEFORE UPDATE ON scheduled_audits FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-Create Profile Trigger
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

-- ======================
-- 7. ROW LEVEL SECURITY (RLS)
-- ======================
-- Helper: Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_uuid 
    AND role = 'admin'
    AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Enable RLS on ALL Tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE fresh_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tavily_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_audits ENABLE ROW LEVEL SECURITY;

-- 7.1 Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 7.2 User Clients (Permissions)
CREATE POLICY "Admins can view all user_clients" ON user_clients FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Users can view own associations" ON user_clients FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage user_clients" ON user_clients FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
-- Allow users to link themselves to created brands
CREATE POLICY "Users can create client associations" ON user_clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 7.3 Clients
CREATE POLICY "Admins can view all clients" ON clients FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Users can view assigned clients" ON clients FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = clients.id AND user_clients.user_id = auth.uid()));
CREATE POLICY "Admins can manage clients" ON clients FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
-- Allow users to create brands (New Policy)
CREATE POLICY "Users can create clients" ON clients FOR INSERT TO authenticated WITH CHECK (true);

-- 7.4 Prompts
CREATE POLICY "Users can access prompts for their clients" ON prompts FOR ALL TO authenticated USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = prompts.client_id AND user_clients.user_id = auth.uid()));

-- 7.5 Audit Results & Citations
CREATE POLICY "Users can access audit_results for their clients" ON audit_results FOR ALL TO authenticated USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = audit_results.client_id AND user_clients.user_id = auth.uid()));
CREATE POLICY "Users can access citations for their clients" ON citations FOR ALL TO authenticated USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = citations.client_id AND user_clients.user_id = auth.uid()));

-- 7.6 Campaigns
CREATE POLICY "Users can access campaigns for their clients" ON campaigns FOR ALL TO authenticated USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = campaigns.client_id AND user_clients.user_id = auth.uid()));

-- 7.7 Intelligence (Citations, Signals, Tavily)
CREATE POLICY "Users can access citation_intelligence" ON citation_intelligence FOR ALL TO authenticated USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = citation_intelligence.client_id AND user_clients.user_id = auth.uid()));
CREATE POLICY "Users can access citation_recommendations" ON citation_recommendations FOR ALL TO authenticated USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = citation_recommendations.client_id AND user_clients.user_id = auth.uid()));
CREATE POLICY "Users can access rss_feeds" ON rss_feeds FOR ALL TO authenticated USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = rss_feeds.client_id AND user_clients.user_id = auth.uid()));
CREATE POLICY "Users can access fresh_signals" ON fresh_signals FOR ALL TO authenticated USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = fresh_signals.client_id AND user_clients.user_id = auth.uid()));
CREATE POLICY "Users can access tavily_results" ON tavily_results FOR ALL TO authenticated USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = tavily_results.client_id AND user_clients.user_id = auth.uid()));

-- 7.8 Recommendations (General)
CREATE POLICY "Users can access recommendations" ON recommendations FOR ALL TO authenticated USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = recommendations.client_id AND user_clients.user_id = auth.uid()));

-- 7.9 Schedules
CREATE POLICY "Users can access schedules" ON prompt_schedules FOR ALL TO authenticated USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = prompt_schedules.client_id AND user_clients.user_id = auth.uid()));
CREATE POLICY "Users can access schedule_runs" ON schedule_runs FOR ALL TO authenticated USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = schedule_runs.client_id AND user_clients.user_id = auth.uid()));

-- 7.10 Organization Members
CREATE POLICY "Users can view members of their organizations" ON organization_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY "Admins can manage organization members" ON organization_members FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- 7.11 API Usage (Admin only)
CREATE POLICY "Admins can view api_usage" ON api_usage FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Service role can insert api_usage" ON api_usage FOR INSERT TO service_role WITH CHECK (true);

-- 7.12 Audit Log (Admin only)
CREATE POLICY "Admins can view audit_log" ON audit_log FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 7.13 Scheduled Audits
CREATE POLICY "Users can access scheduled_audits" ON scheduled_audits FOR ALL TO authenticated USING (is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM user_clients WHERE user_clients.client_id = scheduled_audits.client_id AND user_clients.user_id = auth.uid()));

-- Grant permissions to Service Role (for edge functions)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ======================
-- 8. ADDITIONAL HELPER FUNCTIONS
-- ======================

-- Function to get RSS feeds due for polling
CREATE OR REPLACE FUNCTION get_due_rss_feeds()
RETURNS SETOF rss_feeds AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM rss_feeds
    WHERE is_active = true
    AND (
        last_polled_at IS NULL
        OR last_polled_at + (poll_interval_hours || ' hours')::interval <= now()
    )
    ORDER BY last_polled_at ASC NULLS FIRST
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate influence score for signals
CREATE OR REPLACE FUNCTION calculate_influence_score(
    p_freshness_score FLOAT,
    p_authority_score FLOAT,
    p_relevance_score FLOAT
) RETURNS FLOAT AS $$
BEGIN
    -- Weighted combination: Authority (40%), Freshness (30%), Relevance (30%)
    RETURN (p_authority_score * 0.4) + (p_freshness_score * 0.3) + (p_relevance_score * 0.3);
END;
$$ LANGUAGE plpgsql;

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = user_uuid AND is_active = true;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

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
    SUM(ar.total_cost)
  FROM audit_results ar
  WHERE ar.client_id = p_client_id
    AND ar.created_at > NOW() - (days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get monthly usage (for billing)
CREATE OR REPLACE FUNCTION get_monthly_usage(org_id UUID, month_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
    total_audits BIGINT,
    total_prompts BIGINT,
    total_clients BIGINT,
    total_cost NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT ar.id)::BIGINT AS total_audits,
        COUNT(DISTINCT p.id)::BIGINT AS total_prompts,
        COUNT(DISTINCT c.id)::BIGINT AS total_clients,
        COALESCE(SUM(ar.total_cost), 0) AS total_cost
    FROM clients c
    LEFT JOIN prompts p ON p.client_id = c.id
    LEFT JOIN audit_results ar ON ar.client_id = c.id
        AND ar.created_at >= date_trunc('month', month_date)
        AND ar.created_at < date_trunc('month', month_date) + interval '1 month'
    WHERE c.organization_id = org_id AND c.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- 9. CAMPAIGN STATS TRIGGERS
-- ======================

-- Trigger function to update campaign stats based on audit_results
CREATE OR REPLACE FUNCTION update_campaign_stats_from_audit() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  WITH stats AS (
    SELECT
      count(*) as completed_count,
      avg(share_of_voice) as avg_sov,
      avg(average_rank) as avg_rank,
      sum(total_citations) as total_cits
    FROM audit_results
    WHERE campaign_id = NEW.campaign_id
  )
  UPDATE campaigns
  SET
    completed_prompts = (SELECT count(*) FROM audit_results WHERE campaign_id = NEW.campaign_id),
    avg_sov = COALESCE(stats.avg_sov, 0),
    avg_rank = stats.avg_rank,
    total_citations = COALESCE(stats.total_cits, 0),
    updated_at = NOW(),
    status = CASE 
      WHEN (SELECT count(*) FROM audit_results WHERE campaign_id = NEW.campaign_id) >= total_prompts THEN 'completed' 
      ELSE 'running' 
    END
  FROM stats
  WHERE id = NEW.campaign_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_campaign_stats_audit_trigger ON audit_results;
CREATE TRIGGER update_campaign_stats_audit_trigger
AFTER INSERT OR UPDATE ON audit_results
FOR EACH ROW
EXECUTE FUNCTION update_campaign_stats_from_audit();

-- Trigger function to update campaign stats based on schedule_runs
CREATE OR REPLACE FUNCTION update_campaign_stats_from_schedule() RETURNS TRIGGER AS $$
DECLARE
  v_campaign_id UUID;
BEGIN
  -- schedule_runs doesn't have campaign_id directly, skip if not applicable
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================
-- 10. VIEWS
-- ======================

-- Visibility history for charts (from schedule_runs)
CREATE OR REPLACE VIEW visibility_history AS
SELECT 
  sr.client_id,
  date_trunc('hour', sr.started_at) AS period,
  AVG(sr.share_of_voice)::INTEGER AS avg_sov,
  AVG(sr.visibility_score)::INTEGER AS avg_visibility,
  AVG(sr.average_rank)::DECIMAL(4,2) AS avg_rank,
  SUM(sr.total_citations)::INTEGER AS total_citations,
  SUM(sr.total_cost) AS total_cost,
  COUNT(*)::INTEGER AS run_count,
  MAX(sr.started_at) AS last_run
FROM schedule_runs sr
WHERE sr.status = 'completed'
GROUP BY sr.client_id, date_trunc('hour', sr.started_at)
ORDER BY period DESC;

-- Signal intelligence summary per client
CREATE OR REPLACE VIEW signal_stats AS
SELECT 
    client_id,
    COUNT(*) AS total_signals,
    COUNT(*) FILTER (WHERE processing_status = 'pending') AS pending_signals,
    COUNT(*) FILTER (WHERE influence_score >= 0.7) AS high_influence_signals,
    COUNT(*) FILTER (WHERE published_at >= now() - interval '7 days') AS signals_last_7d,
    AVG(influence_score) AS avg_influence_score,
    COUNT(DISTINCT source_domain) AS unique_domains
FROM fresh_signals
GROUP BY client_id;

-- Unread recommendations summary
CREATE OR REPLACE VIEW recommendation_summary AS
SELECT 
    client_id,
    COUNT(*) FILTER (WHERE priority = 'critical' AND NOT is_actioned AND NOT is_read) AS critical_unread,
    COUNT(*) FILTER (WHERE priority = 'high' AND NOT is_actioned AND NOT is_read) AS high_unread,
    COUNT(*) FILTER (WHERE NOT is_actioned AND NOT is_read) AS total_unread,
    COUNT(*) FILTER (WHERE is_actioned) AS actioned_count,
    COUNT(*) AS total_count
FROM recommendations
GROUP BY client_id;

-- Citation intelligence summary per client
CREATE OR REPLACE VIEW citation_intelligence_summary AS
SELECT 
    client_id,
    COUNT(*) AS total_citations_analyzed,
    COUNT(*) FILTER (WHERE is_hallucinated = true) AS hallucinated_count,
    COUNT(*) FILTER (WHERE is_reachable = true) AS verified_count,
    COUNT(*) FILTER (WHERE citation_category = 'ugc') AS ugc_count,
    COUNT(*) FILTER (WHERE citation_category = 'competitor_blog') AS competitor_count,
    COUNT(*) FILTER (WHERE citation_category = 'press_media') AS press_count,
    COUNT(*) FILTER (WHERE citation_category = 'app_store') AS app_store_count,
    COUNT(*) FILTER (WHERE citation_category = 'wikipedia') AS wikipedia_count,
    COUNT(*) FILTER (WHERE citation_category = 'brand_owned') AS brand_owned_count,
    COUNT(*) FILTER (WHERE brand_mentioned_in_source = true) AS brand_mentioned_count,
    COUNT(DISTINCT domain) AS unique_domains
FROM citation_intelligence
GROUP BY client_id;

-- Citation recommendation summary per client
CREATE OR REPLACE VIEW citation_recommendation_summary AS
SELECT 
    client_id,
    COUNT(*) AS total_recommendations,
    COUNT(*) FILTER (WHERE priority = 'critical') AS critical_count,
    COUNT(*) FILTER (WHERE priority = 'high') AS high_count,
    COUNT(*) FILTER (WHERE is_actioned = false) AS pending_count,
    COUNT(*) FILTER (WHERE is_actioned = true) AS completed_count,
    COUNT(*) FILTER (WHERE generated_content IS NOT NULL) AS with_content_count
FROM citation_recommendations
GROUP BY client_id;

-- Client dashboard summary view
CREATE OR REPLACE VIEW client_dashboard_summary AS
SELECT
    c.id as client_id,
    c.brand_name,
    COUNT(DISTINCT p.id) as total_prompts,
    COUNT(DISTINCT ar.id) as total_audits,
    COALESCE(AVG(ar.share_of_voice), 0)::INTEGER as avg_visibility,
    COALESCE(SUM(ar.total_citations), 0)::INTEGER as total_citations,
    MAX(ar.created_at) as last_audit_at
FROM clients c
LEFT JOIN prompts p ON p.client_id = c.id AND p.is_active = true
LEFT JOIN audit_results ar ON ar.client_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.brand_name;

-- Top citation sources view
CREATE OR REPLACE VIEW top_citation_sources AS
SELECT
    cit.client_id,
    cit.domain,
    COUNT(*) as citation_count,
    COUNT(DISTINCT cit.audit_result_id) as audit_count
FROM citations cit
GROUP BY cit.client_id, cit.domain
ORDER BY citation_count DESC;

-- ======================
-- 11. SEED DATA
-- ======================

-- Pre-populate known high-authority domains
INSERT INTO domain_authority (domain, authority_bucket, authority_score, domain_type, is_trusted) VALUES
    ('nytimes.com', 'high', 0.95, 'news', true),
    ('wsj.com', 'high', 0.95, 'news', true),
    ('bbc.com', 'high', 0.95, 'news', true),
    ('reuters.com', 'high', 0.95, 'news', true),
    ('forbes.com', 'high', 0.9, 'news', true),
    ('techcrunch.com', 'high', 0.85, 'news', true),
    ('theverge.com', 'high', 0.85, 'news', true),
    ('wired.com', 'high', 0.85, 'news', true),
    ('wikipedia.org', 'high', 0.95, 'education', true),
    ('gov.in', 'high', 0.95, 'government', true),
    ('reddit.com', 'medium', 0.6, 'ugc', false),
    ('quora.com', 'medium', 0.55, 'ugc', false),
    ('medium.com', 'medium', 0.5, 'blog', false)
ON CONFLICT (domain) DO NOTHING;

-- ======================
-- FINAL VERIFICATION
-- ======================
SELECT 'Complete Production Schema v2.0 applied successfully!' as status;
