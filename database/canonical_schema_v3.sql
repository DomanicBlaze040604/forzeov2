-- ============================================================
-- FORZEO PLATFORM — FINAL CANONICAL DATABASE SCHEMA (v3.0)
-- ============================================================
-- This is an improved, normalized schema with:
-- - Prompt versioning support
-- - Model cost tracking
-- - Better recommendation sourcing
-- - Domain authority history
-- - Execution event logging
-- - Consolidated signal intelligence
-- ============================================================

-- ======================
-- EXTENSIONS
-- ======================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ======================
-- ENUMS
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

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner','admin','member','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ======================
-- ORGANIZATIONS & USERS
-- ======================
CREATE TABLE organizations (
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

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role user_role DEFAULT 'member',
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (organization_id, user_id)
);

-- ======================
-- CLIENTS & PROMPTS
-- ======================
CREATE TABLE clients (
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

CREATE TABLE prompts (
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

-- NEW: Prompt versioning for tracking changes
CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  version INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- ======================
-- CAMPAIGNS & AUDITS
-- ======================
CREATE TABLE campaigns (
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

CREATE TABLE audit_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  prompt_version_id UUID REFERENCES prompt_versions(id), -- NEW: Track which version was audited
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  triggering_signal_id UUID, -- NEW: If triggered by a fresh signal
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

-- NEW: Separate table for model costs for better analytics
CREATE TABLE model_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_result_id UUID REFERENCES audit_results(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  tokens_used INT,
  cost DECIMAL(10,6)
);

-- ======================
-- CITATIONS & INTELLIGENCE
-- ======================
CREATE TABLE citations (
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

CREATE TABLE citation_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citation_id UUID REFERENCES citations(id) ON DELETE CASCADE,
  audit_result_id UUID REFERENCES audit_results(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  is_reachable BOOLEAN,
  http_status INT,
  is_hallucinated BOOLEAN DEFAULT false,
  hallucination_type TEXT,
  citation_category TEXT,
  opportunity_level TEXT DEFAULT 'medium',
  brand_mentioned BOOLEAN DEFAULT false,
  competitor_mentions TEXT[],
  sentiment sentiment_type,
  ai_analysis JSONB,
  analysis_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ======================
-- SIGNAL INTELLIGENCE
-- ======================
CREATE TABLE rss_feeds (
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

CREATE TABLE fresh_signals (
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

CREATE TABLE signal_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES fresh_signals(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_text TEXT,
  tavily_rank INT,
  tavily_appears BOOLEAN DEFAULT false,
  classification TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ======================
-- RECOMMENDATIONS
-- ======================
CREATE TABLE recommendations (
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

-- NEW: Track which sources contributed to each recommendation
CREATE TABLE recommendation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
  source_type TEXT CHECK (source_type IN ('audit','citation','signal')),
  source_id UUID,
  confidence_score FLOAT DEFAULT 0.5
);

-- ======================
-- DOMAIN AUTHORITY
-- ======================
CREATE TABLE domain_authority (
  domain TEXT PRIMARY KEY,
  authority_bucket TEXT DEFAULT 'unknown',
  authority_score FLOAT DEFAULT 0.5,
  domain_type TEXT,
  is_trusted BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- NEW: Track authority score changes over time
CREATE TABLE domain_authority_history (
  domain TEXT,
  authority_score FLOAT,
  measured_at TIMESTAMPTZ DEFAULT now()
);

-- ======================
-- SCHEDULING & EXECUTION
-- ======================
CREATE TABLE prompt_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  interval_value INT NOT NULL,
  interval_unit TEXT CHECK (interval_unit IN ('seconds','minutes','hours','days')),
  models TEXT[],
  include_tavily BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  total_runs INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE schedule_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES prompt_schedules(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID,
  status TEXT DEFAULT 'running',
  total_cost DECIMAL(10,6),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- NEW: Generic execution event log for debugging and monitoring
CREATE TABLE execution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  entity_type TEXT,
  entity_id UUID,
  event_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ======================
-- HELPER FUNCTIONS
-- ======================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_organizations_updated
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clients_updated
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_prompts_updated
  BEFORE UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_campaigns_updated
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_rss_feeds_updated
  BEFORE UPDATE ON rss_feeds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_schedules_updated
  BEFORE UPDATE ON prompt_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ======================
-- INDEXES
-- ======================
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_clients_org ON clients(organization_id);
CREATE INDEX idx_prompts_client ON prompts(client_id);
CREATE INDEX idx_audit_results_client ON audit_results(client_id);
CREATE INDEX idx_audit_results_prompt ON audit_results(prompt_id);
CREATE INDEX idx_audit_results_campaign ON audit_results(campaign_id);
CREATE INDEX idx_citations_audit ON citations(audit_result_id);
CREATE INDEX idx_citation_intel_client ON citation_intelligence(client_id);
CREATE INDEX idx_fresh_signals_client ON fresh_signals(client_id);
CREATE INDEX idx_recommendations_client ON recommendations(client_id);

-- ======================
-- NOTES & IMPROVEMENTS
-- ======================
-- v3.0 Enhancements:
-- 1. prompt_versions: Track prompt changes over time
-- 2. model_costs: Separate cost tracking per model
-- 3. recommendation_sources: Link recommendations to multiple sources
-- 4. domain_authority_history: Track authority changes
-- 5. execution_events: Debug/monitoring event log
-- 6. triggering_signal_id: Link audits triggered by fresh signals
--
-- Future Considerations:
-- - Add RLS policies (currently disabled for simplicity)
-- - Add campaign stats trigger (from complete_schema.sql)
-- - Add views for analytics (citation_intelligence_summary, signal_stats)
-- - Add scheduled audit support
