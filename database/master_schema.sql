-- ============================================================
-- FORZEO PLATFORM — MASTER SCHEMA v1.0
-- ============================================================
-- Single-file setup for a FRESH Supabase project
-- 
-- INSTRUCTIONS:
-- 1. Create a new Supabase project
-- 2. Go to SQL Editor
-- 3. Paste this entire file and run
-- 4. Done! All tables, functions, triggers are created
--
-- FEATURES:
-- ✅ All core tables (profiles, clients, prompts, audits)
-- ✅ Agency role support (admin, agency, user)
-- ✅ Auto-create profile on signup
-- ✅ RLS DISABLED by default (enable in production)
-- ✅ Indexes for performance
-- ✅ Helper functions and views
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
-- 3. HELPER FUNCTIONS
-- ======================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================
-- 4. CORE TABLES
-- ======================

-- PROFILES (User accounts with roles)
-- Roles: 'admin' (full access), 'agency' (5 brands, 10 prompts/brand), 'user' (1 brand)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'agency', 'user')),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORGANIZATIONS (For multi-tenant enterprise)
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

-- CLIENTS (Brands)
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

-- USER-CLIENT ASSOCIATION (Permissions)
CREATE TABLE IF NOT EXISTS user_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- PROMPTS
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  location_code INT,
  location_name TEXT,
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

-- PROMPT VERSIONS (History)
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  version INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- CAMPAIGNS
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

-- AUDIT RESULTS
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

-- MODEL COSTS
CREATE TABLE IF NOT EXISTS model_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_result_id UUID REFERENCES audit_results(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  tokens_used INT,
  cost DECIMAL(10,6)
);

-- CITATIONS
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

-- ======================
-- 5. INTELLIGENCE TABLES
-- ======================

-- CITATION INTELLIGENCE
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

-- CITATION RECOMMENDATIONS
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

-- ======================
-- 6. SIGNALS & FEEDS
-- ======================

-- RSS FEEDS
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

-- FRESH SIGNALS
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

-- TAVILY RESULTS
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

-- ======================
-- 7. SCHEDULES
-- ======================

-- PROMPT SCHEDULES
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

-- SCHEDULE RUNS
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

-- ======================
-- 8. TRACKING TABLES
-- ======================

-- DOMAIN AUTHORITY
CREATE TABLE IF NOT EXISTS domain_authority (
  domain TEXT PRIMARY KEY,
  authority_bucket TEXT DEFAULT 'unknown',
  authority_score FLOAT DEFAULT 0.5,
  domain_type TEXT,
  is_trusted BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- API USAGE
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

-- RECOMMENDATIONS
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

-- ======================
-- 9. INDEXES
-- ======================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_clients_lookup ON user_clients(user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_prompts_client ON prompts(client_id);
CREATE INDEX IF NOT EXISTS idx_prompts_location ON prompts(location_code);
CREATE INDEX IF NOT EXISTS idx_audit_results_client ON audit_results(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_campaign ON audit_results(campaign_id);
CREATE INDEX IF NOT EXISTS idx_citations_audit ON citations(audit_result_id);
CREATE INDEX IF NOT EXISTS idx_citations_client ON citations(client_id);
CREATE INDEX IF NOT EXISTS idx_fresh_signals_client ON fresh_signals(client_id);
CREATE INDEX IF NOT EXISTS idx_tavily_results_client ON tavily_results(client_id);
CREATE INDEX IF NOT EXISTS idx_usage_date ON api_usage(created_at DESC);

-- ======================
-- 10. TRIGGERS
-- ======================

-- Auto-update timestamps
DROP TRIGGER IF EXISTS update_profiles_ts ON profiles;
CREATE TRIGGER update_profiles_ts BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_clients_ts ON clients;
CREATE TRIGGER update_clients_ts BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_prompts_ts ON prompts;
CREATE TRIGGER update_prompts_ts BEFORE UPDATE ON prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_campaigns_ts ON campaigns;
CREATE TRIGGER update_campaigns_ts BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-Create Profile on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'user',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    last_login_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ======================
-- 11. HELPER FUNCTIONS
-- ======================

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_uuid 
    AND role = 'admin'
    AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is agency
CREATE OR REPLACE FUNCTION is_agency(user_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_uuid 
    AND role = 'agency'
    AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Get user role
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = user_uuid AND is_active = true;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Sync all auth users to profiles
CREATE OR REPLACE FUNCTION sync_auth_to_profiles()
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, is_active, created_at)
  SELECT 
    au.id,
    au.email,
    'user',
    true,
    au.created_at
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE p.id IS NULL
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- 12. ROW LEVEL SECURITY
-- ======================
-- RLS is DISABLED by default for easier development
-- Enable in production by uncommenting the ALTER TABLE statements

-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_clients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_results ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE citations ENABLE ROW LEVEL SECURITY;

-- Grant permissions to service role (for edge functions)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ======================
-- 13. SEED DATA
-- ======================

-- Pre-populate known high-authority domains
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

-- ======================
-- POST-SETUP INSTRUCTIONS
-- ======================
-- After running this schema:
-- 
-- 1. Create your first admin user via Supabase Auth UI or Dashboard
-- 2. Run this SQL to make them admin:
--    UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
-- 
-- 3. For agency users:
--    UPDATE profiles SET role = 'agency' WHERE email = 'agency@email.com';
-- 
-- 4. To sync any existing auth users to profiles:
--    SELECT sync_auth_to_profiles();
-- ======================

SELECT 'FORZEO Master Schema v1.0 installed successfully!' as status;
SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public';
