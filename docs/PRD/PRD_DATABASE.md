# Database Architecture - Complete Specification

**Total Tables:** 27  
**Total Indexes:** 40+  
**Total RLS Policies:** 28+  
**Total Functions:** 15  
**Total Triggers:** 12

---

## Core Schema (Multi-Tenant Foundation)

### 1. organizations
**Purpose:** Root tenant entity for multi-tenancy

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan plan_type DEFAULT 'free',
  max_clients INTEGER DEFAULT 3,
  max_prompts_per_client INTEGER DEFAULT 50,
  max_audits_per_month INTEGER DEFAULT 100,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_email TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

### 2. profiles (User Management)
**Links to:** `auth.users`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'agency', 'user')),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Roles:**
- `admin` - Full platform access, unlimited resources
- `agency` - Max 5 brands, 15 prompts/brand, cannot delete brands
- `user` - Unlimited brands, 30 prompts/brand

**Auto-Create Trigger:**
```sql
CREATE TRIGGER create_profile_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION create_user_profile();
```

### 3. organization_members
**Purpose:** Links users to organizations with roles
**NEW TABLE** (was missing from master_schema.sql)

```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
```

**Org Roles:**
- `owner` - Full control over organization
- `admin` - Manage members & clients
- `member` - Edit assigned clients
- `viewer` - Read-only access


```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  brand_domain TEXT,
  brand_tags TEXT[],
  target_region TEXT DEFAULT 'United States',
  location_code INTEGER DEFAULT 2840,
  industry TEXT DEFAULT 'Custom',
  competitors TEXT[],
  primary_color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_user ON clients(user_id);
CREATE INDEX idx_clients_org ON clients(organization_id);
```

### 4. prompts (Search Queries)

```sql
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  category TEXT DEFAULT 'custom',
  location_code INTEGER,
  location_name TEXT,
  is_active BOOLEAN DEFAULT true,
  is_custom BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, prompt_text)
);

CREATE INDEX idx_prompts_client ON prompts(client_id);
CREATE INDEX idx_prompts_active ON prompts(is_active) WHERE is_active = true;
```

---

## Audit & Results Schema

### 5. audit_results (Core Metrics Storage)

```sql
CREATE TABLE audit_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  brand_name TEXT,
  models_used TEXT[],
  
  -- Core Metrics
  share_of_voice INTEGER DEFAULT 0,
  average_rank DECIMAL(5,2),
  total_citations INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6),
  
  -- JSONB Data
  model_results JSONB,
  summary JSONB,
  top_competitors JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_client ON audit_results(client_id);
CREATE INDEX idx_audit_prompt ON audit_results(prompt_id);
CREATE INDEX idx_audit_created ON audit_results(created_at DESC);
```

**model_results JSONB Schema:**
```json
[
  {
    "model": "chatgpt",
    "model_name": "ChatGPT",
    "success": true,
    "brand_mentioned": true,
    "brand_mention_count": 3,
    "brand_rank": 2,
    "citations": [
      {"url": "https://...", "domain": "example.com", "title": "..."}
    ],
    "competitors_found": [
      {"name": "Competitor", "count": 5, "rank": 1}
    ],
    "api_cost": 0.05,
    "raw_response": "Full text..."
  }
]
```

### 6. citations (Extracted URLs)

```sql
CREATE TABLE citations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_result_id UUID REFERENCES audit_results(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT,
  position INTEGER,
  model TEXT NOT NULL,
  is_brand_source BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_citations_audit ON citations(audit_result_id);
CREATE INDEX idx_citations_domain ON citations(domain);
```

---

## Citation Intelligence Schema

### 7. citation_intelligence (Deep Analysis)

```sql
CREATE TABLE citation_intelligence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  citation_id UUID,
  audit_result_id UUID REFERENCES audit_results(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT,
  model TEXT,
  
  -- Verification
  is_reachable BOOLEAN,
  http_status INTEGER,
  last_verified_at TIMESTAMPTZ,
  
  -- Hallucination Detection
  is_hallucinated BOOLEAN DEFAULT false,
  hallucination_type TEXT,
  hallucination_reason TEXT,
  
  -- Classification
  citation_category TEXT DEFAULT 'other',
  subcategory TEXT,
  opportunity_level TEXT DEFAULT 'medium',
  
  -- Brand Analysis
  brand_mentioned_in_source BOOLEAN DEFAULT false,
  competitor_mentions TEXT[],
  source_sentiment TEXT,
  
  -- AI Analysis
  ai_analysis JSONB,
  analysis_status TEXT DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_citation_intel_client ON citation_intelligence(client_id);
CREATE INDEX idx_citation_intel_category ON citation_intelligence(citation_category);
CREATE INDEX idx_citation_intel_opportunity ON citation_intelligence(opportunity_level);
```

**Categories:**
- `ugc` - Reddit, Quora, Social
- `competitor_blog` - Competitor content
- `press_media` - Forbes, TechCrunch
- `app_store` - Play Store, App Store
- `wikipedia` - Wikipedia
- `brand_owned` - Client's domain
- `other` - General

**Opportunity Levels:**
- `easy` - Direct action (UGC, own site)
- `medium` - Outreach required (press)
- `difficult` - High barriers (Wikipedia)

### 8. citation_recommendations

```sql
CREATE TABLE citation_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  citation_intelligence_id UUID REFERENCES citation_intelligence(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  
  recommendation_type TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  
  -- Groq-generated content
  generated_content TEXT,
  content_type TEXT,
  generation_prompt TEXT,
  
  action_items TEXT[],
  estimated_effort TEXT,
  
  is_viewed BOOLEAN DEFAULT false,
  is_actioned BOOLEAN DEFAULT false,
  actioned_at TIMESTAMPTZ,
  
  regeneration_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Campaigns Schema

### 9. campaigns (Batch Audits)

```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  total_prompts INTEGER DEFAULT 0,
  completed_prompts INTEGER DEFAULT 0,
  
  -- Auto-calculated via trigger
  avg_sov NUMERIC,
  avg_rank NUMERIC,
  total_citations INTEGER,
  total_cost DECIMAL(10,6),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_campaign_stats
AFTER INSERT OR UPDATE ON audit_results
FOR EACH ROW
WHEN (NEW.campaign_id IS NOT NULL)
EXECUTE FUNCTION update_campaign_stats_from_audit();
```

---

## Signals Schema (Fresh Content Tracking)

### 10. rss_feeds

```sql
CREATE TABLE rss_feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rss_url TEXT NOT NULL,
  feed_type TEXT DEFAULT 'google_alert',
  topic TEXT,
  brand_keywords TEXT[],
  competitor_keywords TEXT[],
  is_active BOOLEAN DEFAULT true,
  poll_interval_hours INTEGER DEFAULT 6,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 11. fresh_signals

```sql
CREATE TABLE fresh_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  
  -- Scoring (0.0-1.0)
  freshness_score FLOAT DEFAULT 0,
  authority_score FLOAT DEFAULT 0,
  relevance_score FLOAT DEFAULT 0,
  influence_score FLOAT DEFAULT 0,
  
  processing_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, url_hash)
);

CREATE INDEX idx_signals_influence ON fresh_signals(influence_score DESC);
CREATE INDEX idx_signals_published ON fresh_signals(published_at DESC);
```

**Influence Score Formula:**
```
influence_score = (authority * 0.4) + (freshness * 0.3) + (relevance * 0.3)
```

### 12. signal_correlations

```sql
CREATE TABLE signal_correlations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signal_id UUID REFERENCES fresh_signals(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_text TEXT,
  
  tavily_search_id TEXT,
  tavily_appears BOOLEAN DEFAULT false,
  tavily_rank INTEGER,
  
  classification TEXT DEFAULT 'unknown',
  ai_first_appearance_at TIMESTAMPTZ,
  propagation_lag_days INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 13. domain_authority

```sql
CREATE TABLE domain_authority (
  domain TEXT PRIMARY KEY,
  authority_bucket TEXT DEFAULT 'unknown',
  authority_score FLOAT DEFAULT 0.5,
  domain_type TEXT,
  is_trusted BOOLEAN DEFAULT false
);

-- Pre-populated high-authority domains
INSERT INTO domain_authority (domain, authority_score, is_trusted) VALUES
  ('nytimes.com', 0.95, true),
  ('wsj.com', 0.95, true),
  ('bbc.com', 0.9, true),
  ('wikipedia.org', 0.95, true),
  ('forbes.com', 0.8, true),
  ('techcrunch.com', 0.75, true);
```

---

## v3.0 Enhancement Tables

### 14. prompt_versions (Version History)

```sql
CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
```

### 15. model_costs (Per-Model Cost Tracking)

```sql
CREATE TABLE model_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_result_id UUID REFERENCES audit_results(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  tokens_used INTEGER,
  cost DECIMAL(10,6)
);
```

### 16. execution_events (Audit Trail)

```sql
CREATE TABLE execution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  entity_type TEXT,
  entity_id UUID,
  event_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 17. recommendation_sources
**Purpose:** Multi-source recommendation tracking
**NEW TABLE** (was missing from master_schema.sql)

```sql
CREATE TABLE recommendation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
  source_type TEXT CHECK (source_type IN ('audit','citation','signal')),
  source_id UUID,
  confidence_score FLOAT DEFAULT 0.5
);
```

### 18. domain_authority_history
**Purpose:** Track authority score changes over time
**NEW TABLE** (was missing from master_schema.sql)

```sql
CREATE TABLE domain_authority_history (
  domain TEXT,
  authority_score FLOAT,
  measured_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_domain_history ON domain_authority_history(domain, measured_at DESC);
```

### 19. tavily_results

```sql
CREATE TABLE tavily_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  query TEXT NOT NULL,
  answer TEXT,
  sources JSONB DEFAULT '[]',
  raw_content JSONB,
  search_depth TEXT DEFAULT 'advanced',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tavily_client ON tavily_results(client_id);
```

### 20. recommendations (General)

```sql
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
```

### 21. prompt_schedules
**Purpose:** Recurring audit scheduling

```sql
CREATE TABLE prompt_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
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
```

### 22. schedule_runs

```sql
CREATE TABLE schedule_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID REFERENCES prompt_schedules(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  share_of_voice INTEGER DEFAULT 0,
  visibility_score INTEGER DEFAULT 0,
  average_rank DECIMAL(4,2),
  total_citations INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  model_results JSONB DEFAULT '[]',
  tavily_results JSONB,
  sources JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### 23. api_usage
**Purpose:** API cost tracking for billing

```sql
CREATE TABLE api_usage (
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

CREATE INDEX idx_usage_org ON api_usage(organization_id);
CREATE INDEX idx_usage_date ON api_usage(created_at DESC);
CREATE INDEX idx_usage_api ON api_usage(api_name);
```

### 24. audit_log
**Purpose:** Security and compliance logging
**NEW TABLE** (was missing from master_schema.sql)

```sql
CREATE TABLE audit_log (
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

CREATE INDEX idx_audit_log_org ON audit_log(organization_id, created_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
```

### 25. scheduled_audits
**Purpose:** Recurring audit automation (daily/weekly/monthly)
**NEW TABLE** (was missing from master_schema.sql)

```sql
CREATE TABLE scheduled_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 28),
  hour_utc INTEGER DEFAULT 9 CHECK (hour_utc >= 0 AND hour_utc <= 23),
  prompt_filter JSONB DEFAULT '{"categories": ["broad", "niche"], "active_only": true}',
  models TEXT[] DEFAULT ARRAY['chatgpt', 'google_ai_overview'],
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_client ON scheduled_audits(client_id) WHERE is_active = true;
CREATE INDEX idx_scheduled_next ON scheduled_audits(next_run_at) WHERE is_active = true;
```

### 26. user_clients
**Purpose:** User-client permissions (not counted in main tables, part of core)

```sql
CREATE TABLE user_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

CREATE INDEX idx_user_clients_lookup ON user_clients(user_id, client_id);
```

---

## Additional Helper Functions

### calculate_influence_score

```sql
CREATE FUNCTION calculate_influence_score(
  p_freshness_score FLOAT,
  p_authority_score FLOAT,
  p_relevance_score FLOAT
) RETURNS FLOAT AS $$
BEGIN
  RETURN (p_authority_score * 0.4) + (p_freshness_score * 0.3) + (p_relevance_score * 0.3);
END;
$$ LANGUAGE plpgsql;
```

### get_client_visibility_summary

```sql
CREATE FUNCTION get_client_visibility_summary(p_client_id UUID, days INTEGER DEFAULT 30)
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
```

### get_due_rss_feeds

```sql
CREATE FUNCTION get_due_rss_feeds()
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
```



## RLS Policies (Row Level Security)

### Standard User Policies
```sql
-- Users can only view their own clients
CREATE POLICY "Users view own clients"
ON clients FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own clients
CREATE POLICY "Users create own clients"
ON clients FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### Admin Policies
```sql
-- Admins can view all profiles
CREATE POLICY "Admins view all profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

### Agency Policies
```sql
-- Agency users limited to 5 clients max (enforced in app logic)
-- Agency users limited to 15 prompts per client (enforced in app logic)
```

---

## Relationships Diagram

```
organizations (1) ──< clients (N)
clients (1) ──< prompts (N)
clients (1) ──< campaigns (N)
prompts (1) ──< audit_results (N)
campaigns (1) ──< audit_results (N)
audit_results (1) ──< citations (N)
citations (1) ──< citation_intelligence (1)
citation_intelligence (1) ──< citation_recommendations (N)
clients (1) ──< rss_feeds (N)
rss_feeds (1) ──< fresh_signals (N)
fresh_signals (1) ──< signal_correlations (N)
```

---

**Setup Instructions:**
1. Run `database/master_schema.sql` in Supabase SQL Editor
2. Verify all 27 tables created
3. Check RLS policies enabled
4. Create first admin user:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
   ```
