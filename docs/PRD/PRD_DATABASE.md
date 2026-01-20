# Database Architecture - Complete Specification

**Total Tables:** 27  
**Total Indexes:** 40+  
**Total RLS Policies:** 28+  
**Total Functions:** 12  
**Total Triggers:** 8

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
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. profiles (User Management)
**Links to:** `auth.users`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user', -- 'admin' | 'agency' | 'user'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
```

**Auto-Create Trigger:**
```sql
CREATE TRIGGER create_profile_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION create_user_profile();
```

### 3. clients (Brands)
**Purpose:** Represents each tracked brand

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

---

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
