-- ============================================
-- FORZEO COMPLETE DATABASE SCHEMA
-- ============================================
-- This is a SINGLE consolidated schema file.
-- Run this ONCE in Supabase SQL Editor.
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- SECTION 0: DROP EXISTING TABLES (FRESH START)
-- ============================================
-- Drop in reverse dependency order (CASCADE handles triggers)

DROP TABLE IF EXISTS recommendations CASCADE;
DROP TABLE IF EXISTS signal_correlations CASCADE;
DROP TABLE IF EXISTS fresh_signals CASCADE;
DROP TABLE IF EXISTS rss_feeds CASCADE;
DROP TABLE IF EXISTS domain_authority CASCADE;
DROP TABLE IF EXISTS schedule_runs CASCADE;
DROP TABLE IF EXISTS prompt_schedules CASCADE;
DROP TABLE IF EXISTS tavily_results CASCADE;
DROP TABLE IF EXISTS scheduled_audits CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS api_usage CASCADE;
DROP TABLE IF EXISTS citations CASCADE;
DROP TABLE IF EXISTS forzeo_citations CASCADE;
DROP TABLE IF EXISTS audit_results CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS prompts CASCADE;
DROP TABLE IF EXISTS forzeo_prompts CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS forzeo_api_usage CASCADE;

-- ============================================
-- SECTION 1: ENUMS
-- ============================================

DO $$ BEGIN
    CREATE TYPE prompt_category AS ENUM (
      'broad', 'niche', 'super_niche', 'long_tail',
      'comparison', 'problem', 'feature', 'local',
      'custom', 'imported', 'default'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE sentiment_type AS ENUM ('positive', 'neutral', 'negative');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE plan_type AS ENUM ('free', 'starter', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- SECTION 2: CORE TABLES
-- ============================================

-- Organizations (Tenants)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan plan_type DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_email TEXT,
  max_clients INTEGER DEFAULT 3,
  max_prompts_per_client INTEGER DEFAULT 50,
  max_audits_per_month INTEGER DEFAULT 100,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Organization Members
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role DEFAULT 'member',
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Clients (Brands)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  brand_domain TEXT,
  brand_tags TEXT[] DEFAULT '{}',
  slug TEXT NOT NULL,
  target_region TEXT DEFAULT 'United States',
  location_code INTEGER DEFAULT 2840,
  industry TEXT DEFAULT 'Custom',
  competitors TEXT[] DEFAULT '{}',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Prompts
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  category prompt_category DEFAULT 'custom',
  is_custom BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5,
  tags TEXT[] DEFAULT '{}',
  last_audited_at TIMESTAMPTZ,
  audit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, prompt_text)
);

-- ============================================
-- SECTION 3: CAMPAIGNS
-- ============================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  total_prompts INT DEFAULT 0,
  completed_prompts INT DEFAULT 0,
  avg_sov NUMERIC,
  avg_rank NUMERIC,
  total_citations INT
);

-- ============================================
-- SECTION 4: AUDIT RESULTS
-- ============================================

CREATE TABLE IF NOT EXISTS audit_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  prompt_category TEXT DEFAULT 'custom',
  brand_name TEXT,
  brand_tags TEXT[] DEFAULT '{}',
  competitors TEXT[] DEFAULT '{}',
  models_used TEXT[] DEFAULT '{}',
  share_of_voice INTEGER DEFAULT 0,
  visibility_score INTEGER DEFAULT 0,
  trust_index INTEGER DEFAULT 0,
  average_rank DECIMAL(5,2),
  total_models_checked INTEGER DEFAULT 0,
  visible_in INTEGER DEFAULT 0,
  cited_in INTEGER DEFAULT 0,
  total_citations INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  model_results JSONB DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  top_sources JSONB DEFAULT '[]'::jsonb,
  top_competitors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Citations
CREATE TABLE IF NOT EXISTS citations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_result_id UUID NOT NULL REFERENCES audit_results(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  domain TEXT NOT NULL,
  position INTEGER,
  snippet TEXT,
  model TEXT NOT NULL,
  is_brand_source BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Usage
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

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled Audits
CREATE TABLE IF NOT EXISTS scheduled_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER,
  day_of_month INTEGER,
  hour_utc INTEGER DEFAULT 9,
  prompt_filter JSONB DEFAULT '{}'::jsonb,
  models TEXT[] DEFAULT ARRAY['chatgpt', 'google_ai_overview'],
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SECTION 5: TAVILY & SCHEDULING
-- ============================================

-- Tavily Results
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
  max_results INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt Schedules
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

-- Schedule Runs
CREATE TABLE IF NOT EXISTS schedule_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES prompt_schedules(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  share_of_voice INTEGER DEFAULT 0,
  visibility_score INTEGER DEFAULT 0,
  average_rank DECIMAL(4,2),
  total_citations INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  model_results JSONB DEFAULT '[]'::jsonb,
  tavily_results JSONB,
  sources JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- SECTION 6: SIGNALS (Fresh Intelligence)
-- ============================================

-- RSS Feeds
CREATE TABLE IF NOT EXISTS rss_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rss_url TEXT NOT NULL,
  feed_type TEXT DEFAULT 'google_alert',
  topic TEXT,
  brand_keywords TEXT[],
  competitor_keywords TEXT[],
  is_active BOOLEAN DEFAULT true,
  last_polled_at TIMESTAMPTZ,
  last_poll_status TEXT,
  last_poll_error TEXT,
  etag TEXT,
  last_modified TEXT,
  poll_interval_hours INTEGER DEFAULT 6,
  items_fetched_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fresh Signals
CREATE TABLE IF NOT EXISTS fresh_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  feed_id UUID REFERENCES rss_feeds(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  title TEXT,
  content_snippet TEXT,
  published_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ DEFAULT now(),
  source_domain TEXT,
  matched_topic TEXT,
  brand_mentions TEXT[],
  competitor_mentions TEXT[],
  content_type TEXT,
  sentiment TEXT,
  freshness_score FLOAT DEFAULT 0,
  authority_score FLOAT DEFAULT 0,
  relevance_score FLOAT DEFAULT 0,
  influence_score FLOAT DEFAULT 0,
  processing_status TEXT DEFAULT 'pending',
  correlation_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, url_hash)
);

-- Signal Correlations
CREATE TABLE IF NOT EXISTS signal_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES fresh_signals(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prompt_text TEXT,
  tavily_search_id TEXT,
  tavily_appears BOOLEAN DEFAULT false,
  tavily_rank INTEGER,
  tavily_result_count INTEGER DEFAULT 0,
  classification TEXT DEFAULT 'unknown',
  classification_reason TEXT,
  ai_first_appearance_at TIMESTAMPTZ,
  propagation_lag_days INTEGER,
  adjacent_domains TEXT[],
  relevance_overlap FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recommendations
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES fresh_signals(id) ON DELETE SET NULL,
  correlation_id UUID REFERENCES signal_correlations(id) ON DELETE SET NULL,
  recommendation_type TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  evidence TEXT,
  action_items TEXT[],
  urgency_days INTEGER,
  source_domain TEXT,
  source_url TEXT,
  matched_prompt TEXT,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  dismissed_reason TEXT,
  is_actioned BOOLEAN DEFAULT false,
  actioned_at TIMESTAMPTZ,
  action_notes TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Domain Authority
CREATE TABLE IF NOT EXISTS domain_authority (
  domain TEXT PRIMARY KEY,
  authority_bucket TEXT DEFAULT 'unknown',
  authority_score FLOAT DEFAULT 0.5,
  domain_type TEXT,
  is_trusted BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pre-populate some known domains
INSERT INTO domain_authority (domain, authority_bucket, authority_score, domain_type, is_trusted) VALUES
  ('nytimes.com', 'high', 0.95, 'news', true),
  ('wsj.com', 'high', 0.95, 'news', true),
  ('bbc.com', 'high', 0.95, 'news', true),
  ('reuters.com', 'high', 0.95, 'news', true),
  ('forbes.com', 'high', 0.9, 'news', true),
  ('techcrunch.com', 'high', 0.85, 'news', true),
  ('wikipedia.org', 'high', 0.95, 'education', true),
  ('reddit.com', 'medium', 0.6, 'ugc', false),
  ('quora.com', 'medium', 0.55, 'ugc', false),
  ('medium.com', 'medium', 0.5, 'blog', false)
ON CONFLICT (domain) DO NOTHING;

-- ============================================
-- SECTION 7: INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prompts_client ON prompts(client_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_audit_client ON audit_results(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_prompt ON audit_results(prompt_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_results_campaign_id ON audit_results(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_citations_audit ON citations(audit_result_id);
CREATE INDEX IF NOT EXISTS idx_citations_client ON citations(client_id);
CREATE INDEX IF NOT EXISTS idx_usage_org ON api_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_tavily_client ON tavily_results(client_id);
CREATE INDEX IF NOT EXISTS idx_schedules_client ON prompt_schedules(client_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_runs_schedule ON schedule_runs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_runs_client ON schedule_runs(client_id);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_client ON rss_feeds(client_id);
CREATE INDEX IF NOT EXISTS idx_fresh_signals_client ON fresh_signals(client_id);
CREATE INDEX IF NOT EXISTS idx_signal_correlations_signal ON signal_correlations(signal_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_client ON recommendations(client_id);

-- ============================================
-- SECTION 8: HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_prompts_updated_at ON prompts;
CREATE TRIGGER update_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_prompt_schedules_updated_at ON prompt_schedules;
CREATE TRIGGER update_prompt_schedules_updated_at
  BEFORE UPDATE ON prompt_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Campaign stats trigger
CREATE OR REPLACE FUNCTION update_campaign_stats_from_audit() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE campaigns
  SET
    completed_prompts = (SELECT count(*) FROM audit_results WHERE campaign_id = NEW.campaign_id),
    avg_sov = (SELECT avg(share_of_voice) FROM audit_results WHERE campaign_id = NEW.campaign_id),
    avg_rank = (SELECT avg(average_rank) FROM audit_results WHERE campaign_id = NEW.campaign_id),
    total_citations = (SELECT COALESCE(sum(total_citations), 0) FROM audit_results WHERE campaign_id = NEW.campaign_id),
    updated_at = NOW(),
    status = CASE 
      WHEN (SELECT count(*) FROM audit_results WHERE campaign_id = NEW.campaign_id) >= total_prompts THEN 'completed' 
      ELSE 'running' 
    END
  WHERE id = NEW.campaign_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_campaign_stats_audit_trigger ON audit_results;
CREATE TRIGGER update_campaign_stats_audit_trigger
AFTER INSERT OR UPDATE ON audit_results
FOR EACH ROW
EXECUTE FUNCTION update_campaign_stats_from_audit();

-- ============================================
-- SECTION 9: DISABLE RLS FOR SIMPLICITY
-- ============================================
-- (You can enable RLS later with proper policies)

ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE prompts DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE citations DISABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_audits DISABLE ROW LEVEL SECURITY;
ALTER TABLE tavily_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE rss_feeds DISABLE ROW LEVEL SECURITY;
ALTER TABLE fresh_signals DISABLE ROW LEVEL SECURITY;
ALTER TABLE signal_correlations DISABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations DISABLE ROW LEVEL SECURITY;
ALTER TABLE domain_authority DISABLE ROW LEVEL SECURITY;

-- ============================================
-- SECTION 10: GRANTS
-- ============================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================
-- SUCCESS!
-- ============================================
SELECT 'Forzeo complete schema deployed successfully!' as status;
