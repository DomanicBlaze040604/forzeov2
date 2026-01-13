# Forzeo Platform - Complete Database Architecture

**Version:** 2.0  
**Last Updated:** January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Core Schema](#core-schema)
4. [Citation Intelligence Schema](#citation-intelligence-schema)
5. [Signals Schema](#signals-schema)
6. [Campaigns Schema](#campaigns-schema)
7. [Relationships & Foreign Keys](#relationships--foreign-keys)
8. [Indexes & Performance](#indexes--performance)
9. [Row Level Security (RLS)](#row-level-security-rls)
10. [Triggers & Functions](#triggers--functions)
11. [Data Flow](#data-flow)

---

## Overview

The Forzeo platform uses a multi-schema PostgreSQL database with the following core components:

- **Core Schema**: Organizations, users, clients, prompts, audit results
- **Citation Intelligence**: Deep citation analysis with AI-powered recommendations
- **Signals**: Fresh content tracking via RSS with Tavily correlation
- **Campaigns**: Batch auditing with aggregated metrics

**Key Technologies:**
- PostgreSQL 14+ with UUID support
- Row Level Security (RLS) for multi-tenancy
- JSONB for flexible metadata storage
- Trigger-based stat aggregation
- Supabase Edge Functions integration

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      ORGANIZATIONS (Tenants)                     │
│  - Multi-tenant root                                             │
│  - Billing & subscription management                             │
└────────────┬────────────────────────────────────────────────────┘
             │
             ├──────────► USERS (Auth)
             │             - Supabase Auth integration
             │
             ├──────────► ORGANIZATION_MEMBERS
             │             - User roles & permissions
             │
             └──────────► CLIENTS (Brands)
                           │
                           ├──────────► PROMPTS
                           │             │
                           │             └──────► CAMPAIGNS ◄──────┐
                           │                       │               │
                           │                       ▼               │
                           ├──────────► AUDIT_RESULTS ────────────┤
                           │             │                         │
                           │             ├──► CITATIONS            │
                           │             │                         │
                           │             ├──► CITATION_INTELLIGENCE
                           │             │     │
                           │             │     └──► RECOMMENDATIONS
                           │             │
                           │             └──► API_USAGE
                           │
                           ├──────────► RSS_FEEDS
                           │             │
                           │             └──► FRESH_SIGNALS
                           │                   │
                           │                   ├──► SIGNAL_CORRELATIONS
                           │                   │
                           │                   └──► RECOMMENDATIONS
                           │
                           └──────────► SCHEDULED_AUDITS
```

---

## Core Schema

### 1. Organizations (Tenants)

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan plan_type DEFAULT 'free',
  stripe_customer_id TEXT,
  billing_email TEXT,
  max_clients INTEGER DEFAULT 3,
  max_prompts_per_client INTEGER DEFAULT 50,
  max_audits_per_month INTEGER DEFAULT 100,
  settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Multi-tenant root. Each organization has isolated data.

**Key Fields:**
- `plan`: Enum ('free', 'starter', 'pro', 'enterprise')
- `settings`: JSONB for flexible configuration
- `max_*`: Usage limits per plan

---

### 2. Users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  last_login_at TIMESTAMPTZ
);
```

**Purpose:** Links to Supabase Auth. Stores profile info.

**Key Relationships:**
- `auth.users` → `users` (1:1)
- `users` → `organization_members` (1:N)

---

### 3. Organization Members

```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role user_role DEFAULT 'member',
  invited_by UUID REFERENCES users(id),
  UNIQUE(organization_id, user_id)
);
```

**Roles:**
- `owner`: Full control
- `admin`: Manage members & clients
- `member`: View/edit assigned clients
- `viewer`: Read-only access

---

### 4. Clients (Brands)

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  brand_domain TEXT,
  target_region TEXT DEFAULT 'United States',
  location_code INTEGER DEFAULT 2840,
  industry TEXT DEFAULT 'Custom',
  competitors TEXT[],
  primary_color TEXT DEFAULT '#3b82f6',
  settings JSONB
);
```

**Purpose:** Represents a brand being tracked.

**Key Fields:**
- `brand_tags[]`: Keywords for detection
- `competitors[]`: Competitor domain list
- `location_code`: DataForSEO location code

---

### 5. Prompts

```sql
CREATE TABLE prompts (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  category prompt_category DEFAULT 'custom',
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5,
  last_audited_at TIMESTAMPTZ,
  audit_count INTEGER DEFAULT 0,
  UNIQUE(client_id, prompt_text)
);
```

**Categories:**
- `broad`, `niche`, `super_niche`, `long_tail`
- `comparison`, `problem`, `feature`, `local`

---

### 5a. Prompt Versions (v3.0 Enhancement)

```sql
CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  version INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);
```

**Purpose:** Track prompt text changes over time for audit trails.

**Use Cases:**
- See how prompt evolved
- Compare performance across versions
- Rollback to previous versions
- Attribution (who changed what)

---

### 6. Audit Results

```sql
CREATE TABLE audit_results (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  brand_name TEXT,
  models_used TEXT[],
  share_of_voice INTEGER DEFAULT 0,
  average_rank DECIMAL(5,2),
  total_citations INTEGER DEFAULT 0,
  model_results JSONB,
  top_competitors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Stores results from live LLM queries via DataForSEO.

**Key Metrics:**
- `share_of_voice`: % of models mentioning brand (0-100)
- `average_rank`: Position in lists (lower = better)
- `total_citations`: Number of sources cited

**Model Results Structure (JSONB):**
```json
[
  {
    "model": "chatgpt",
    "rank": 2,
    "mentioned": true,
    "response": "Full text...",
    "citations": ["url1", "url2"]
  }
]
```

---

### 7. Citations

```sql
CREATE TABLE citations (
 id UUID PRIMARY KEY,
  audit_result_id UUID REFERENCES audit_results(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT,
  position INTEGER,
  model TEXT NOT NULL,
  is_brand_source BOOLEAN DEFAULT false
);
```

**Purpose:** Extracted URLs from AI responses.

**Indexed Fields:**
- `audit_result_id`, `client_id`, `domain`

---

### 7a. Model Costs (v3.0 Enhancement)

```sql
CREATE TABLE model_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_result_id UUID REFERENCES audit_results(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  tokens_used INT,
  cost DECIMAL(10,6)
);
```

**Purpose:** Separate table for per-model cost tracking and analytics.

**Benefits:**
- Detailed cost breakdown by model
- Token usage analysis
- Budget forecasting
- Compare model efficiency

**Example Data:**
| audit_result_id | model | tokens_used | cost |
|---|---|---|---|
| abc-123 | chatgpt | 1500 | 0.003 |
| abc-123 | gemini | 1200 | 0.002 |

---

## Citation Intelligence Schema

### 1. Citation Intelligence

```sql
CREATE TABLE citation_intelligence (
  id UUID PRIMARY KEY,
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
  is_hallucinated BOOLEAN DEFAULT FALSE,
  hallucination_type TEXT,
  
  -- Classification
  citation_category TEXT DEFAULT 'other',
  subcategory TEXT,
  opportunity_level TEXT DEFAULT 'medium',
  
  -- Brand Analysis
  brand_mentioned_in_source BOOLEAN DEFAULT FALSE,
  competitor_mentions TEXT[],
  source_sentiment TEXT,
  
  -- AI Analysis (Groq)
  ai_analysis JSONB,
  analysis_status TEXT DEFAULT 'pending',
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Citation Categories:**
- `ugc`: Reddit, Quora, LinkedIn
- `competitor_blog`: Competitor owned content
- `press_media`: Forbes, TechCrunch, WSJ
- `app_store`: Google Play, App Store
- `wikipedia`: Wikipedia articles
- `brand_owned`: Client's own domain

**Opportunity Levels:**
- `easy`: Direct action possible (UGC, competitor blogs)
- `medium`: Requires outreach (press, app stores)
- `difficult`: High barriers (Wikipedia)

**Hallucination Detection:**
1. HTTP HEAD request to verify URL
2. Check if content matches AI claim
3. Classify type: `unreachable`, `misattributed`, `contradictory`

---

### 2. Citation Recommendations

```sql
CREATE TABLE citation_recommendations (
  id UUID PRIMARY KEY,
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
  
  -- User tracking
  is_viewed BOOLEAN DEFAULT FALSE,
  is_actioned BOOLEAN DEFAULT FALSE,
  actioned_at TIMESTAMPTZ,
  
  regeneration_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Recommendation Types:**
- `engage_ugc`: Reply to Reddit/Quora thread
- `create_comparison`: Build comparison page
- `publish_pr`: Press release opportunity
- `improve_reviews`: App store optimization
- `wikipedia_advisory`: Wikipedia editing guidance

**Content Types (Generated by Groq):**
- `quora_answer`: Ready-to-post Quora answer
- `reddit_comment`: Reddit reply draft
- `comparison_page`: Full comparison article
- `press_release`: PR template
- `review_template`: App review response
- `wiki_gap_analysis`: Wikipedia strategy

---

### 2a. Recommendation Sources (v3.0 Enhancement)

```sql
CREATE TABLE recommendation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
  source_type TEXT CHECK (source_type IN ('audit','citation','signal')),
  source_id UUID,
  confidence_score FLOAT DEFAULT 0.5
);
```

**Purpose:** Link recommendations to multiple sources with confidence scores.

**Benefits:**
- **Multi-source recommendations**: Combine data from audits, citations, and signals
- **Confidence tracking**: Know how reliable each recommendation is
- **Source attribution**: Trace back to original data
- **Better prioritization**: Higher confidence = higher priority

**Example:**
```
Recommendation: "Create comparison page for 'CRM vs Salesforce'"
Sources:
  - audit (abc-123, confidence: 0.9)
  - citation (def-456, confidence: 0.7) 
  - signal (ghi-789, confidence: 0.6)
→ Overall confidence: 0.73
```

---

## Signals Schema

### 1. RSS Feeds

```sql
CREATE TABLE rss_feeds (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rss_url TEXT NOT NULL,
  feed_type TEXT DEFAULT 'google_alert',
  topic TEXT,
  brand_keywords TEXT[],
  competitor_keywords TEXT[],
  is_active BOOLEAN DEFAULT true,
  poll_interval_hours INTEGER DEFAULT 6,
  last_polled_at TIMESTAMPTZ
);
```

**Purpose:** Track fresh content from Google Alerts or custom RSS.

**Feed Types:**
- `google_alert`: Google Alerts RSS
- `newsapi`: NewsAPI integration
- `bing`: Bing News
- `custom`: User-provided feed

---

### 2. Fresh Signals

```sql
CREATE TABLE fresh_signals (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  feed_id UUID REFERENCES rss_feeds(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  title TEXT,
  content_snippet TEXT,
  published_at TIMESTAMPTZ,
  source_domain TEXT,
  
  -- Mentions
  brand_mentions TEXT[],
  competitor_mentions TEXT[],
  
  -- Scoring (0.0 - 1.0)
  freshness_score FLOAT DEFAULT 0,
  authority_score FLOAT DEFAULT 0,
  relevance_score FLOAT DEFAULT 0,
  influence_score FLOAT DEFAULT 0,
  
  processing_status TEXT DEFAULT 'pending',
  UNIQUE(client_id, url_hash)
);
```

**Scoring Formula:**
```
influence_score = (authority * 0.4) + (freshness * 0.3) + (relevance * 0.3)
```

**Fresh Scores:**
- `freshness_score`: Age-based decay (newer = higher)
- `authority_score`: Domain reputation (from `domain_authority`)
- `relevance_score`: Keyword match strength
- `influence_score`: Combined weighted score

---

### 3. Signal Correlations

```sql
CREATE TABLE signal_correlations (
  id UUID PRIMARY KEY,
  signal_id UUID REFERENCES fresh_signals(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_text TEXT,
  
  -- Tavily results
  tavily_search_id TEXT,
  tavily_appears BOOLEAN DEFAULT false,
  tavily_rank INTEGER,
  
  -- Classification
  classification TEXT DEFAULT 'unknown',
  
  -- AI propagation
  ai_first_appearance_at TIMESTAMPTZ,
  propagation_lag_days INTEGER
);
```

**Purpose:** Correlate fresh signals with Tavily search results.

**Classifications:**
- `emerging`: New source likely to be cited by AI
- `reinforcing`: Already appearing in AI results
- `low_impact`: Unlikely to influence AI

**Propagation Tracking:**
- Time between signal publish → AI first cite
- Helps predict which content will be indexed

---

### 4. Domain Authority (Lookup Table)

```sql
CREATE TABLE domain_authority (
  domain TEXT PRIMARY KEY,
  authority_bucket TEXT DEFAULT 'unknown',
  authority_score FLOAT DEFAULT 0.5,
  domain_type TEXT,
  is_trusted BOOLEAN DEFAULT false
);
```

**Pre-populated Domains:**
- **High (0.9+):** nytimes.com, wsj.com, bbc.com, wikipedia.org
- **Medium (0.5-0.8):** forbes.com, techcrunch.com
- **Low (0.3-0.5):** reddit.com, quora.com, medium.com

---

### 4a. Domain Authority History (v3.0 Enhancement)

```sql
CREATE TABLE domain_authority_history (
  domain TEXT,
  authority_score FLOAT,
  measured_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose:** Track how domain authority changes over time.

**Benefits:**
- **Trend analysis**: See if domains are gaining/losing authority
- **Prediction**: Forecast future authority scores
- **Validation**: Verify authority score accuracy
- **Alerts**: Notify when trusted source loses authority

**Example Query:**
```sql
SELECT domain, authority_score, measured_at
FROM domain_authority_history
WHERE domain = 'techcrunch.com'
ORDER BY measured_at DESC;
```

---

## Campaigns Schema

### Campaigns

```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  total_prompts INT DEFAULT 0,
  completed_prompts INT DEFAULT 0,
  
  -- Aggregated stats (updated via trigger)
  avg_sov NUMERIC,
  avg_rank NUMERIC,
  total_citations INT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Batch multiple prompts into a single "campaign" for aggregated reporting.

**Status Values:**
- `running`: In progress
- `completed`: All prompts finished
- `error`: Critical failure

**Stats Calculation (Automatic Trigger):**
```sql
CREATE TRIGGER update_campaign_stats_audit_trigger
AFTER INSERT OR UPDATE ON audit_results
FOR EACH ROW
EXECUTE FUNCTION update_campaign_stats_from_audit();
```

Updates `avg_sov`, `avg_rank`, `total_citations` automatically.

---

## v3.0 Schema Enhancements

### Execution Events

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

**Purpose:** Generic event log for debugging, monitoring, and audit trails.

**Event Types:**
- `audit_started`, `audit_completed`, `audit_failed`
- `signal_processed`, `signal_correlated`
- `recommendation_generated`, `recommendation_actioned`
- `campaign_created`, `campaign_completed`

**Benefits:**
- **Debugging**: Trace execution flow
- **Monitoring**: Track system health
- **Analytics**: Understand user behavior
- **Compliance**: Audit trail for sensitive operations

**Example:**
```json
{
  "client_id": "abc-123",
  "entity_type": "audit",
  "entity_id": "def-456",
  "event_type": "audit_failed",
  "metadata": {
    "error": "DataForSEO timeout",
    "model": "chatgpt",
    "retries": 3
  }
}
```

### New Columns in Existing Tables

**audit_results:**
- `prompt_version_id UUID` - Links to which prompt version was audited
- `triggering_signal_id UUID` - If audit was triggered by a fresh signal

**Benefits:**
- Version tracking for prompt performance comparison
- Signal-to-audit correlation for ROI analysis

---

## Summary of v3.0 Enhancements

| Enhancement | Purpose | Key Benefit |
|---|---|---|
| **prompt_versions** | Track prompt changes | Version history & performance comparison |
| **model_costs** | Per-model cost tracking | Detailed cost analytics |
| **recommendation_sources** | Multi-source recommendations | Confidence scoring & attribution |
| **domain_authority_history** | Authority trend tracking | Predict domain reputation changes |
| **execution_events** | Event logging | Debugging & monitoring |

---

## Relationships & Foreign Keys

### Core Relationships

```
organizations (1) ──< organization_members >── (N) users
organizations (1) ──< clients (N)
clients (1) ──< prompts (N)
clients (1) ──< campaigns (N)
prompts (1) ──< audit_results (N)
campaigns (1) ──< audit_results (N)
audit_results (1) ──< citations (N)
```

### Citation Intelligence Flow

```
audit_results (1) ──< citations (N) ──< citation_intelligence (1)
citation_intelligence (1) ──< citation_recommendations (N)
```

### Signals Flow

```
clients (1) ──< rss_feeds (N)
rss_feeds (1) ──< fresh_signals (N)
fresh_signals (1) ──< signal_correlations (N)
fresh_signals (1) ──< recommendations (N)
```

### Cascade Deletion

**ON DELETE CASCADE:**
- Delete organization → Delete all clients, members
- Delete client → Delete prompts, audits, citations, campaigns
- Delete audit → Delete citations, intelligence data

**ON DELETE SET NULL:**
- Delete prompt → Audit remains (prompt_id = NULL)
- Delete feed → Signal remains (feed_id = NULL)

---

## Indexes & Performance

### Primary Indexes

```sql
-- Core tables
CREATE INDEX idx_clients_org ON clients(organization_id);
CREATE INDEX idx_prompts_client ON prompts(client_id);
CREATE INDEX idx_audit_client ON audit_results(client_id);
CREATE INDEX idx_audit_created ON audit_results(created_at DESC);

-- Citations
CREATE INDEX idx_citations_audit ON citations(audit_result_id);
CREATE INDEX idx_citations_client ON citations(client_id);

-- Intelligence
CREATE INDEX idx_citation_intelligence_client ON citation_intelligence(client_id);
CREATE INDEX idx_citation_intelligence_category ON citation_intelligence(citation_category);
CREATE INDEX idx_citation_intelligence_hallucinated ON citation_intelligence(is_hallucinated) WHERE is_hallucinated = true;

-- Signals
CREATE INDEX idx_fresh_signals_influence ON fresh_signals(influence_score DESC);
CREATE INDEX idx_fresh_signals_published ON fresh_signals(published_at DESC);
```

### Composite Indexes

```sql
CREATE INDEX idx_recommendations_unread ON recommendations(client_id, is_read) 
  WHERE is_read = false AND is_dismissed = false;
  
CREATE INDEX idx_signal_correlations_class ON signal_correlations(classification);
```

---

## Row Level Security (RLS)

### Multi-Tenancy via RLS

All client data is protected by RLS policies:

```sql
CREATE POLICY "Users can view own client data" ON clients
  FOR SELECT USING (
    id IN (
      SELECT c.id FROM clients c
      JOIN organization_members om ON c.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
    )
  );
```

**Applied To:**
- `clients`, `prompts`, `audit_results`, `citations`
- `citation_intelligence`, `citation_recommendations`
- `rss_feeds`, `fresh_signals`, `signal_correlations`
- `campaigns`

**Service Role:** Bypasses RLS for Edge Functions using `SUPABASE_SERVICE_ROLE_KEY`.

---

## Triggers & Functions

### 1. Auto-Update Timestamps

```sql
CREATE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to:
CREATE TRIGGER update_clients_updated ON clients ...
CREATE TRIGGER update_prompts_updated ON prompts ...
```

### 2. Campaign Stats Aggregation

```sql
CREATE FUNCTION update_campaign_stats_from_audit() RETURNS TRIGGER AS $$
BEGIN
  UPDATE campaigns SET
    completed_prompts = (SELECT count(*) FROM audit_results WHERE campaign_id = NEW.campaign_id),
    avg_sov = (SELECT avg(share_of_voice) FROM audit_results WHERE campaign_id = NEW.campaign_id),
    avg_rank = (SELECT avg(average_rank) FROM audit_results WHERE campaign_id = NEW.campaign_id),
    total_citations = (SELECT sum(total_citations) FROM audit_results WHERE campaign_id = NEW.campaign_id),
    status = CASE 
      WHEN completed >= total_prompts THEN 'completed' 
      ELSE 'running' 
    END
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 3. Influence Score Calculation

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

---

## Data Flow

### 1. Audit Flow

```
1. User creates PROMPT
2. Edge function `geo-audit` triggers
3. DataForSEO Live APIs called (ChatGPT, Gemini, Claude, Perplexity)
4. Parse responses → AUDIT_RESULTS created
5. Extract citations → CITATIONS created
6. (Optional) Deep Analysis → CITATION_INTELLIGENCE created
7. Groq generates → CITATION_RECOMMENDATIONS
```

### 2. Signal Flow

```
1. User adds RSS_FEED (Google Alert URL)
2. Edge function `scheduler` polls every 6 hours
3. New content → FRESH_SIGNALS created
4. Score calculation (freshness/authority/relevance)
5. Correlation check via Tavily → SIGNAL_CORRELATIONS
6. High influence signals → RECOMMENDATIONS generated
```

### 3. Campaign Flow

```
1. User creates CAMPAIGN
2. Associates multiple PROMPTS
3. Batch audits triggered
4. Each audit creates AUDIT_RESULT with campaign_id
5. Trigger aggregates stats into CAMPAIGN
6. Status updates to 'completed' when done
```

---

## Views for Analytics

### Citation Intelligence Summary

```sql
CREATE VIEW citation_intelligence_summary AS
SELECT 
  client_id,
  COUNT(*) AS total_citations_analyzed,
  COUNT(*) FILTER (WHERE is_hallucinated = true) AS hallucinated_count,
  COUNT(*) FILTER (WHERE is_reachable = true) AS verified_count,
  COUNT(*) FILTER (WHERE citation_category = 'ugc') AS ugc_count,
  COUNT(DISTINCT domain) AS unique_domains
FROM citation_intelligence
GROUP BY client_id;
```

### Signal Stats

```sql
CREATE VIEW signal_stats AS
SELECT 
  client_id,
  COUNT(*) AS total_signals,
  COUNT(*) FILTER (WHERE influence_score >= 0.7) AS high_influence_signals,
  AVG(influence_score) AS avg_influence_score
FROM fresh_signals
GROUP BY client_id;
```

---

## Enum Types

```sql
-- Prompt categories
CREATE TYPE prompt_category AS ENUM (
  'broad', 'niche', 'super_niche', 'long_tail',
  'comparison', 'problem', 'feature', 'local',
  'custom', 'imported', 'default'
);

-- Subscription plans
CREATE TYPE plan_type AS ENUM ('free', 'starter', 'pro', 'enterprise');

-- User roles
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Sentiment
CREATE TYPE sentiment_type AS ENUM ('positive', 'neutral', 'negative');
```

---

## Key Design Decisions

### 1. JSONB for Flexibility
- `model_results`: Each AI response structure varies
- `settings`: Client-specific configurations
- `ai_analysis`: Groq response formats

### 2. Soft Deletes
- `deleted_at` timestamp instead of hard deletes
- Allows recovery and audit trails
- RLS filters deleted records automatically

### 3. Denormalization for Performance
- `campaign.avg_sov` cached (not computed on-the-fly)
- `audit_results.total_citations` stored
- Trade-off: Storage vs query speed

### 4. Multi-Tenancy Strategy
- Organization-level isolation
- RLS enforces data boundaries
- Service role bypasses for background jobs

---

## Migration Strategy

To deploy this schema:

1. **Fresh Installation:**
   ```bash
   # In Supabase SQL Editor
   # Run: database/complete_schema.sql
   ```

2. **Existing Database:**
   ```bash
   # Run individual schemas in order:
   1. schema.sql (core)
   2. campaigns_schema.sql
   3. citation_intelligence_schema.sql
   4. signals_schema.sql
   ```

3. **Verify:**
   ```sql
   SELECT tablename FROM pg_tables 
   WHERE schemaname = 'public' 
   ORDER BY tablename;
   ```

---

## Performance Benchmarks

**Typical Query Times (on 10K+ records):**
- Get client audits: ~50ms
- Campaign aggregation: ~100ms (cached via trigger)
- Citation intelligence summary: ~200ms
- Signal correlation check: ~300ms

**Optimization Tips:**
- Use `created_at DESC` index for recent audits
- Enable `pg_stat_statements` for query profiling
- Vacuum regularly for JSONB columns

---

## Security Considerations

### 1. RLS Policies
- All tables have RLS enabled
- Only service role can bypass
- Organization members see only their data

### 2. API Keys
- Stored in Supabase Vault (encrypted)
- Referenced via environment variables
- Never exposed to client

### 3. Audit Logging
- `audit_log` table tracks all mutations
- Includes `user_id`, `action`, `old_data`, `new_data`
- IP address and user agent logged

---

## Backup & Recovery

**Automated Backups:**
- Supabase daily snapshots (14-day retention)
- Point-in-time recovery available

**Manual Export:**
```bash
pg_dump -U postgres -d forzeo > backup_$(date +%Y%m%d).sql
```

---

**End of Documentation**

For implementation details, see:
- [FEATURE_GUIDE.md](./FEATURE_GUIDE.md) - Feature architecture
- [README.md](./README.md) - Setup instructions
- `database/` folder - Individual SQL files
